import { parse, type HTMLElement } from "node-html-parser";

import { htmlToPlainText, truncateText } from "../../domain/html-text";
import { canonicalizeJobUrl, urlHostname } from "../../domain/urls";
import { JobFetchError } from "./errors";
import { parseOptionalDate } from "./types";
import type { DiscoveredJob } from "./types";

const JOB_URL_TOKEN = /(?:job|career|position|vacanc|requisition|opening|role|opportunit)/iu;
const GENERIC_PAGE_NAMES = new Set([
  "index",
  "search",
  "apply",
  "careers",
  "jobs",
  "home",
  "about",
  "contact",
  "faq",
  "why",
  "life",
  "overview",
  "benefits",
  "culture",
  "students",
  "graduates",
  "programme",
  "program",
]);
const GENERIC_LINK_TEXT = new Set([
  "careers",
  "career",
  "jobs",
  "job",
  "job search",
  "search jobs",
  "search for a job",
  "find a job",
  "find jobs",
  "view all jobs",
  "all jobs",
  "apply",
  "apply for a job",
  "about us",
  "about",
  "working here",
  "why us",
  "why work here",
  "current vacancies",
  "vacancies",
  "our careers",
  "job opportunities",
  "opportunities",
  "students",
  "graduates",
  "contact",
  "faq",
  "home",
]);

function urlLooksJobLike(url: URL): boolean {
  if (!JOB_URL_TOKEN.test(url.pathname)) return false;
  const lastSegment = (url.pathname.split("/").filter(Boolean).at(-1) ?? "").toLowerCase();
  return !GENERIC_PAGE_NAMES.has(lastSegment);
}

function textLooksJobLike(text: string): boolean {
  const normalized = text.toLowerCase();
  if (GENERIC_LINK_TEXT.has(normalized)) return false;
  if (normalized.length < 8) return false;
  return /\b(?:job|role|position|vacanc|career|opening|opportunit)\b/iu.test(normalized);
}

export type JobListingLink = Readonly<{ text: string; url: string }>;

export function extractJobLinks(html: string, baseUrl: string): JobListingLink[] {
  let root: HTMLElement;
  try {
    root = parse(html);
  } catch {
    return [];
  }
  const baseHost = urlHostname(baseUrl);
  const seen = new Set<string>();
  const links: JobListingLink[] = [];
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
    if (!urlLooksJobLike(url) && !textLooksJobLike(text)) continue;
    const canonical = canonicalizeJobUrl(url.toString());
    if (!canonical || seen.has(canonical)) continue;
    seen.add(canonical);
    links.push({ text: text.slice(0, 160), url: canonical });
  }
  return links;
}

export function extractJobDetail(html: string, link: JobListingLink): DiscoveredJob {
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
