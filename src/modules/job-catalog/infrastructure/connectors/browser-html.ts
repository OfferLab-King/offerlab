import { chromium, type Browser, type Page } from "playwright";

import { JobFetchError } from "./errors";
import { fetchText } from "./http-client";
import {
  captureConfigFrom,
  findJobArrays,
  matchesCapturePattern,
  normalizeCapturedJob,
  type CaptureConfig,
} from "./browser-api-capture";
import { extractJobDetail, extractJobLinks, type JobListingLink } from "./html-job-extraction";
import {
  limited,
  type ConnectorContext,
  type DiscoveredJob,
  type JobSourceConnector,
} from "./types";

/**
 * Minimal browser surface used by the connector so tests can inject a fake at
 * the browser-process boundary.
 */
export interface BrowserPage {
  goto(url: string, options?: Readonly<{ timeout?: number; waitUntil?: string }>): Promise<unknown>;
  waitForLoadState(state: string, options?: Readonly<{ timeout?: number }>): Promise<void>;
  waitForTimeout(ms: number): Promise<void>;
  onResponse(handler: (url: string, contentType: string, body: string) => void): void;
  content(): Promise<string>;
  close(): Promise<void>;
}

export interface BrowserLike {
  newPage(): Promise<BrowserPage>;
  close(): Promise<void>;
}

export type BrowserFactory = () => Promise<BrowserLike>;

const CAPTURE_SETTLE_MS = 4_000;

export function createBrowserHtmlConnector(
  options: Readonly<{ launchBrowser?: BrowserFactory }> = {},
): JobSourceConnector {
  const launchBrowser: BrowserFactory = options.launchBrowser ?? defaultLaunchBrowser;
  const assertRobotsAllowed = async (url: string, context: ConnectorContext): Promise<void> => {
    const decision = await context.robotsGate.check(url, "offerlab-jobs-bot");
    if (decision === "blocked") {
      throw new JobFetchError(
        "robots_blocked",
        "robots.txt disallows the careers path for our crawler user agent",
      );
    }
    // Browser sources may be bot-walled: an unreadable robots.txt ("unknown")
    // does not stop rendering. Founder decision 2026-08-12.
  };
  return {
    name: "Browser-rendered employer careers HTML",
    sourceType: "direct_html",
    async discoverJobs(context: ConnectorContext): Promise<DiscoveredJob[]> {
      const careersUrl = context.company.careersUrl;
      await assertRobotsAllowed(careersUrl, context);
      const capture = captureConfigFrom(context.company.configuration);
      const browser = await launchBrowser();
      try {
        const page = await browser.newPage();
        try {
          if (capture) {
            return await captureJobsFromResponses(page, careersUrl, capture, context);
          }
          return await extractJobsFromRenderedHtml(page, careersUrl, context);
        } finally {
          await page.close();
        }
      } finally {
        await browser.close();
      }
    },
    async healthCheck(context: ConnectorContext): Promise<void> {
      await assertRobotsAllowed(context.company.careersUrl, context);
      const browser = await launchBrowser();
      try {
        const page = await browser.newPage();
        try {
          const html = await renderPage(page, context.company.careersUrl, context);
          if (extractJobLinks(html, context.company.careersUrl).length === 0) {
            throw new JobFetchError(
              "parser_changed",
              "no job links found on rendered careers listing",
            );
          }
        } finally {
          await page.close();
        }
      } finally {
        await browser.close();
      }
    },
  };
}

async function extractJobsFromRenderedHtml(
  page: BrowserPage,
  careersUrl: string,
  context: ConnectorContext,
): Promise<DiscoveredJob[]> {
  const listingHtml = await renderPage(page, careersUrl, context);
  const links = extractJobLinks(listingHtml, careersUrl);
  if (links.length === 0) {
    throw new JobFetchError("parser_changed", "no job links found on rendered careers listing");
  }
  const detailLinks = limited(links, Math.min(context.maxDetailPages, context.maxJobs));
  const jobs: DiscoveredJob[] = [];
  for (const link of detailLinks) {
    const detailDecision = await context.robotsGate.check(link.url, "offerlab-jobs-bot");
    if (detailDecision === "blocked") continue;
    const detailHtml = await renderPage(page, link.url, context);
    jobs.push(extractJobDetail(detailHtml, link));
    if (jobs.length >= context.maxJobs) break;
  }
  return jobs;
}

async function captureJobsFromResponses(
  page: BrowserPage,
  careersUrl: string,
  capture: CaptureConfig,
  context: ConnectorContext,
): Promise<DiscoveredJob[]> {
  const capturedBodies: Array<{ url: string; body: string }> = [];
  page.onResponse((url, contentType, body) => {
    if (!contentType.includes("json")) return;
    if (!capture.urlPatterns.some((pattern) => matchesCapturePattern(pattern, url))) return;
    capturedBodies.push({ url, body });
  });
  await renderPage(page, careersUrl, context);
  await page.waitForTimeout(CAPTURE_SETTLE_MS);
  const jobs: DiscoveredJob[] = [];
  const seenUrls = new Set<string>();
  const baseUrl = careersUrl;
  const pushJobsFromPayload = (payload: unknown): void => {
    for (const raw of findJobArrays(payload, capture.jobArrayPaths ?? [])) {
      const job = normalizeCapturedJob(raw, baseUrl);
      if (!job.title || !job.applicationUrl || seenUrls.has(job.applicationUrl)) continue;
      seenUrls.add(job.applicationUrl);
      jobs.push(job);
      if (jobs.length >= context.maxJobs) return;
    }
  };
  for (const response of capturedBodies) {
    let payload: unknown;
    try {
      payload = JSON.parse(response.body);
    } catch {
      continue;
    }
    pushJobsFromPayload(payload);
    if (jobs.length >= context.maxJobs) break;
  }
  if (capture.apiUrl && jobs.length < context.maxJobs) {
    const apiResponse = await fetchText(capture.apiUrl, {
      httpClient: context.httpClient,
      headers: { accept: "application/json" },
      retryable: false,
    });
    let payload: unknown;
    try {
      payload = JSON.parse(apiResponse.body);
    } catch {
      throw new JobFetchError("parser_changed", "captured api response unparseable");
    }
    pushJobsFromPayload(payload);
  }
  if (jobs.length === 0) {
    throw new JobFetchError("parser_changed", "no job arrays found in captured API responses");
  }
  return jobs;
}

async function renderPage(
  page: BrowserPage,
  url: string,
  context: ConnectorContext,
): Promise<string> {
  try {
    await page.goto(url, {
      timeout: context.httpClient.timeoutMs,
      waitUntil: "domcontentloaded",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new JobFetchError("network_timeout", "browser_navigation_timeout", {
        retryable: true,
      });
    }
    throw new JobFetchError("network_error", "browser_navigation_failed", {
      retryable: true,
    });
  }
  try {
    await page.waitForLoadState("networkidle", {
      timeout: Math.min(10_000, context.httpClient.timeoutMs),
    });
  } catch {
    // JavaScript-heavy pages may never go fully idle; the DOM is already useful.
  }
  return page.content();
}

async function defaultLaunchBrowser(): Promise<BrowserLike> {
  let browser: Browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch {
    throw new JobFetchError("source_unavailable", "browser_launch_failed", {
      retryable: true,
    });
  }
  return {
    newPage: async () => wrapPlaywrightPage(await browser.newPage()),
    close: async () => {
      await browser.close();
    },
  };
}

function wrapPlaywrightPage(page: Page): BrowserPage {
  return {
    goto: (url, options) =>
      page.goto(url, {
        ...(options?.timeout !== undefined ? { timeout: options.timeout } : {}),
        waitUntil:
          (options?.waitUntil as "domcontentloaded" | "load" | undefined) ?? "domcontentloaded",
      }),
    waitForLoadState: (state, options) =>
      page.waitForLoadState(
        state as "load" | "domcontentloaded" | "networkidle" | undefined,
        options?.timeout !== undefined ? { timeout: options.timeout } : undefined,
      ),
    waitForTimeout: (ms) => page.waitForTimeout(ms),
    onResponse: (handler) => {
      page.on("response", async (response) => {
        const contentType = response.headers()["content-type"] ?? "";
        if (!contentType.includes("json")) return;
        try {
          handler(response.url(), contentType, await response.text());
        } catch {
          // body may already be consumed by the page; skip
        }
      });
    },
    content: () => page.content(),
    close: () => page.close(),
  };
}

export type { JobListingLink };
