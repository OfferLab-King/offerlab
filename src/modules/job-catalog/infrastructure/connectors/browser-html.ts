import { chromium, type Browser } from "playwright";

import { JobFetchError } from "./errors";
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
  content(): Promise<string>;
  close(): Promise<void>;
}

export interface BrowserLike {
  newPage(): Promise<BrowserPage>;
  close(): Promise<void>;
}

export type BrowserFactory = () => Promise<BrowserLike>;

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
      const browser = await launchBrowser();
      try {
        const page = await browser.newPage();
        try {
          const listingHtml = await renderPage(page, careersUrl, context);
          const links = extractJobLinks(listingHtml, careersUrl);
          if (links.length === 0) {
            throw new JobFetchError(
              "parser_changed",
              "no job links found on rendered careers listing",
            );
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
    newPage: async () => (await browser.newPage()) as unknown as BrowserPage,
    close: async () => {
      await browser.close();
    },
  };
}

export type { JobListingLink };
