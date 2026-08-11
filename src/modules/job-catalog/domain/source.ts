export const sourceTypes = [
  "direct_html",
  "workday",
  "greenhouse",
  "lever",
  "smartrecruiters",
  "ashby",
  "custom",
  "unknown",
] as const;

export type SourceType = (typeof sourceTypes)[number];

export const crawlAllowedValues = ["allowed", "unknown", "blocked"] as const;

export type CrawlAllowed = (typeof crawlAllowedValues)[number];

export const crawlStatusValues = ["healthy", "warning", "failing", "paused"] as const;

export type CrawlStatus = (typeof crawlStatusValues)[number];

export type SourceCompany = Readonly<{
  id: string;
  name: string;
  slug: string;
  careersUrl: string;
  sourceType: SourceType;
  crawlAllowed: CrawlAllowed;
  crawlStatus: CrawlStatus;
  crawlFrequencyMinutes: number;
  consecutiveFailures: number;
  active: boolean;
  lastCheckedAt: Date | null;
  lastSuccessfulCheckAt: Date | null;
  nextCheckAt: Date | null;
  configuration: Readonly<Record<string, unknown>>;
}>;

export const CRAWL_ALLOWED = "allowed" as const;

export function isCrawlable(company: SourceCompany): boolean {
  return (
    company.active && company.crawlAllowed === CRAWL_ALLOWED && company.crawlStatus !== "paused"
  );
}
