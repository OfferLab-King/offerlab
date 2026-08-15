export const sourceTypes = [
  "direct_html",
  "workday",
  "greenhouse",
  "lever",
  "smartrecruiters",
  "ashby",
  "workable",
  "teamtailor",
  "custom",
  "unknown",
] as const;

export type SourceType = (typeof sourceTypes)[number];

export const sourceChannels = [
  "early_careers",
  "professional",
  "apprenticeships",
  "general",
  "other",
] as const;

export type SourceChannel = (typeof sourceChannels)[number];

export const sourceStatuses = ["active", "paused", "archived"] as const;

export type SourceStatus = (typeof sourceStatuses)[number];

// Compatibility types for the expand phase. Removed after every caller has moved
// from company-as-source to app.job_source.
export const crawlStatusValues = ["healthy", "warning", "failing", "paused"] as const;
export type CrawlStatus = (typeof crawlStatusValues)[number];
export type CrawlAllowed = "allowed" | "unknown" | "blocked";
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

export type JobSource = Readonly<{
  id: string;
  companyId: string;
  companyName: string;
  companySlug: string;
  sourceSlug: string;
  sourceName: string;
  channel: SourceChannel;
  careersUrl: string;
  crawlEndpointUrl: string | null;
  sourceType: SourceType;
  status: SourceStatus;
  crawlFrequencyMinutes: number;
  consecutiveFailures: number;
  consecutiveZeroResults: number;
  lastNonZeroResultAt: Date | null;
  needsBrowser: boolean;
  lastCheckedAt: Date | null;
  lastSuccessfulCheckAt: Date | null;
  nextCheckAt: Date | null;
  runRequestedAt: Date | null;
  configuration: Readonly<Record<string, unknown>>;
}>;

export function isCrawlable(source: JobSource | SourceCompany): boolean {
  if ("status" in source) return source.status === "active";
  return source.active && source.crawlStatus !== "paused";
}

export function sourceKey(source: Pick<JobSource, "companySlug" | "sourceSlug">): string {
  return `${source.companySlug}/${source.sourceSlug}`;
}
