import { parse, type HTMLElement } from "node-html-parser";
import { htmlToPlainText, truncateText } from "../../domain/html-text";
import { canonicalizeJobUrl, urlHostname } from "../../domain/urls";
import { JobFetchError } from "./errors";
import { fetchText } from "./http-client";
import {
  limited,
  parseOptionalDate,
  type ConnectorContext,
  type DiscoveredJob,
  type JobSourceConnector,
} from "./types";

export const directHtmlSourceType = "direct_html" as const;
export const customSourceType = "custom" as const;

const JOB_LINK_PATTERN = /(?:job|career|careers|position|vacanc|role|openin)/iu;

type GenericListingLink = Readonly<{ text: string; url: string }>;

export function createGenericHtmlConnector(): JobSourceConnector {
  return {
    name: "Generic employer careers HTML",
    sourceType: directHtmlSourceType,
    async discoverJobs(context: ConnectorContext): Promise<DiscoveredJob[]> {
      const careersUrl = context.company.careersUrl;
      const robotsDecision = await context.robotsGate.check(careersUrl, "offerlab-jobs-bot");
      if (robotsDecision !== "allowed") {
        throw new JobFetchError(
          "robots_blocked",
          robotsDecision === "blocked"
            ? "robots.txt disallows the careers path for our crawler user agent"
            : "robots.txt could not be verified for the careers path",
        );
      }
      const listingResponse = await fetchText(careersUrl, {
        httpClient: context.httpClient,
        headers: { accept: "text/html,application/xhtml+xml" },
      });
      const links = extractJobLinks(listingResponse.body, careersUrl);
      if (links.length === 0) {
        throw new JobFetchError("parser_changed", "no job links found on careers listing");
      }
      const detailLinks = limited(links, Math.min(context.maxDetailPages, context.maxJobs));
      const jobs: DiscoveredJob[] = [];
      for (const link of detailLinks) {
        const detailDecision = await context.robotsGate.check(link.url, "offerlab-jobs-bot");
        if (detailDecision !== "allowed") continue;
        try {
          const detailResponse = await fetchText(link.url, {
            httpClient: context.httpClient,
            headers: { accept: "text/html,application/xhtml+xml" },
          });
          jobs.push(extractJobDetail(detailResponse.body, link));
        } catch (error) {
          if (error instanceof JobFetchError && error.code === "http_404") continue;
          throw error;
        }
        if (jobs.length >= context.maxJobs) break;
      }
      return jobs;
    },
    async healthCheck(context: ConnectorContext): Promise<void> {
      const robotsDecision = await context.robotsGate.check(
        context.company.careersUrl,
        "offerlab-jobs-bot",
      );
      if (robotsDecision !== "allowed") {
        throw new JobFetchError(
          "robots_blocked",
          robotsDecision === "blocked"
            ? "robots.txt disallows the careers path for our crawler user agent"
            : "robots.txt could not be verified for the careers path",
        );
      }
      const response = await fetchText(context.company.careersUrl, {
        httpClient: context.httpClient,
        headers: { accept: "text/html,application/xhtml+xml" },
      });
      if (extractJobLinks(response.body, context.company.careersUrl).length === 0) {
        throw new JobFetchError("parser_changed", "no job links found on careers listing");
      }
    },
  };
}

function extractJobLinks(html: string, baseUrl: string): GenericListingLink[] {
  let root: HTMLElement;
  try {
    root = parse(html);
  } catch {
    return [];
  }
  const baseHost = urlHostname(baseUrl);
  const seen = new Set<string>();
  const links: GenericListingLink[] = [];
  for (const anchor of root.querySelectorAll("a[href]")) {
    const href = anchor.getAttribute("href");
    const text = anchor.text.trim().replace(/\s+/gu, " ");
    if (!href || !text) continue;
    let url: URL;
    try {
      url = new URL(href, baseUrl);
    } catch {
      continue;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") continue;
    if (baseHost && urlHostname(url.toString()) !== baseHost) continue;
    if (!JOB_LINK_PATTERN.test(url.pathname) && !JOB_LINK_PATTERN.test(text)) continue;
    const canonical = canonicalizeJobUrl(url.toString());
    if (!canonical || seen.has(canonical)) continue;
    seen.add(canonical);
    links.push({ text: text.slice(0, 160), url: canonical });
  }
  return links;
}

function extractJobDetail(html: string, link: GenericListingLink): DiscoveredJob {
  let root: HTMLElement;
  try {
    root = parse(html);
  } catch {
    throw new JobFetchError("parser_changed", "job detail html unparseable");
  }
  const title =
    root.querySelector("h1")?.text.trim().replace(/\s+/gu, " ") ?? link.text ?? "Untitled role";
  const main =
    root.querySelector("main") ??
    root.querySelector("article") ??
    root.querySelector("body") ??
    root;
  const descriptionText = htmlToPlainText(main.innerHTML ?? "");
  const location = extractLocation(main);
  const externalIdMatch = link.url.match(/[^/]+(?:\/)?$/u);
  const externalJobId = externalIdMatch?.[0]?.replace(/[^a-z0-9-]/giu, "") || null;
  return {
    applicationDeadline: extractDeadline(main),
    applicationUrl: link.url,
    descriptionText: truncateText(descriptionText, 60_000),
    employmentType: null,
    externalJobId,
    locationText: location ?? "",
    postedAt: null,
    remoteType: null,
    salaryCurrency: null,
    salaryMax: null,
    salaryMin: null,
    salaryPeriod: null,
    sourcePayload: { listingLinkText: link.text.slice(0, 200) },
    sourceUrl: link.url,
    title: title.slice(0, 300),
  };
}

function extractLocation(node: HTMLElement): string | null {
  for (const element of node.querySelectorAll("*")) {
    const text = element.text.replace(/\s+/gu, " ").trim();
    if (!text || text.length > 120) continue;
    const label = element.getAttribute("data-testid") ?? "";
    const locationMatch = text.match(
      /(?:^|\b)(London|Manchester|Birmingham|Leeds|Glasgow|Edinburgh|Bristol|remote|hybrid)(?:\b|$)/iu,
    );
    if (locationMatch && (label.includes("location") || /(?:^|\b)location(?:\b|$)/iu.test(text))) {
      return text.replace(/^location\s*[:.-]?\s*/iu, "").trim();
    }
  }
  return null;
}

function extractDeadline(node: HTMLElement): Date | null {
  for (const element of node.querySelectorAll("*")) {
    const text = element.text.replace(/\s+/gu, " ").trim();
    if (!text || text.length > 80) continue;
    const label = element.getAttribute("data-testid") ?? "";
    if (!label.includes("deadline") && !/^deadline/iu.test(text)) continue;
    const match = text.match(
      /\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/iu,
    );
    if (!match) continue;
    const date = parseOptionalDate(match[0]);
    if (date) return date;
  }
  return null;
}
