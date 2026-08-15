import { logger } from "../logging";
import { htmlToPlainText, truncateText } from "../../domain/html-text";
import { canonicalizeJobUrl } from "../../domain/urls";
import { JobFetchError } from "./errors";
import { fetchText } from "./http-client";
import {
  connectorToken,
  parseOptionalDate,
  type ConnectorContext,
  type DiscoveredJob,
  type JobSourceConnector,
} from "./types";

export const teamtailorSourceType = "teamtailor" as const;

type TeamtailorAddress = Readonly<{
  address?: Readonly<{ addressLocality?: string; addressRegion?: string }>;
}>;

type TeamtailorJobPosting = Readonly<{
  datePosted?: string;
  description?: string;
  jobLocation?: readonly TeamtailorAddress[] | TeamtailorAddress;
  title?: string;
}>;

type TeamtailorItem = Readonly<{
  _jobposting?: TeamtailorJobPosting;
  content_html?: string;
  date_published?: string;
  id?: string;
  title?: string;
  url?: string;
}>;

type TeamtailorFeed = Readonly<{
  items?: readonly TeamtailorItem[];
  version?: string;
}>;

export function createTeamtailorConnector(): JobSourceConnector {
  return {
    name: "Teamtailor public jobs feed",
    sourceType: teamtailorSourceType,
    async discoverJobs(context: ConnectorContext): Promise<DiscoveredJob[]> {
      const company = connectorToken(context.company, "teamtailorCompany");
      if (!company) {
        throw new JobFetchError(
          "not_configured",
          "teamtailor company missing from company configuration",
        );
      }
      const response = await fetchText(
        `https://${encodeURIComponent(company)}.teamtailor.com/jobs.json`,
        { httpClient: context.httpClient },
      );
      let payload: TeamtailorFeed;
      try {
        payload = JSON.parse(response.body) as TeamtailorFeed;
      } catch {
        throw new JobFetchError("parser_changed", "teamtailor_feed_unparseable");
      }
      if (!Array.isArray(payload.items)) {
        throw new JobFetchError("parser_changed", "teamtailor_feed_missing_items");
      }
      const discovered: DiscoveredJob[] = [];
      const seenExternalIds = new Set<string>();
      for (const item of payload.items) {
        const job = normalizeTeamtailorItem(item);
        if (discovered.length >= context.maxJobs) break;
        if (job.externalJobId !== null && seenExternalIds.has(job.externalJobId)) continue;
        if (job.externalJobId !== null) seenExternalIds.add(job.externalJobId);
        discovered.push(job);
      }
      if (discovered.length === 0) {
        logger.info({
          event: "job_source_listing_empty",
          source:
            "sourceSlug" in context.company ? context.company.sourceSlug : context.company.slug,
        });
      }
      return discovered;
    },
    async healthCheck(context: ConnectorContext): Promise<void> {
      const company = connectorToken(context.company, "teamtailorCompany");
      if (!company) throw new JobFetchError("not_configured", "teamtailor company missing");
      const response = await fetchText(
        `https://${encodeURIComponent(company)}.teamtailor.com/jobs.json`,
        { httpClient: context.httpClient },
      );
      let payload: TeamtailorFeed;
      try {
        payload = JSON.parse(response.body) as TeamtailorFeed;
      } catch {
        throw new JobFetchError("parser_changed", "teamtailor_feed_unparseable");
      }
      if (!Array.isArray(payload.items)) {
        throw new JobFetchError("parser_changed", "teamtailor_feed_missing_items");
      }
    },
  };
}

function normalizeTeamtailorItem(item: TeamtailorItem): DiscoveredJob {
  const externalJobId = item.id?.trim() || null;
  const rawUrl = item.url?.trim() ?? "";
  const applicationUrl = canonicalizeJobUrl(rawUrl);
  if (!applicationUrl) {
    throw new JobFetchError("parser_changed", "teamtailor_job_missing_url");
  }
  const posting = item._jobposting ?? {};
  const locations = Array.isArray(posting.jobLocation)
    ? posting.jobLocation
    : posting.jobLocation
      ? [posting.jobLocation]
      : [];
  const locationText = locations
    .map((location) =>
      [location.address?.addressLocality, location.address?.addressRegion]
        .filter((part): part is string => Boolean(part?.trim()))
        .join(", "),
    )
    .filter(Boolean)
    .join("; ");
  const description = posting.description?.trim() || item.content_html?.trim() || "";
  return {
    applicationDeadline: null,
    applicationUrl,
    descriptionText: truncateText(htmlToPlainText(description), 60_000),
    employmentType: null,
    externalJobId,
    locationText,
    postedAt: parseOptionalDate(posting.datePosted ?? item.date_published),
    remoteType: null,
    salaryCurrency: null,
    salaryMax: null,
    salaryMin: null,
    salaryPeriod: null,
    sourcePayload: {
      date_published: item.date_published ?? null,
      id: item.id ?? null,
      title: item.title ?? null,
      url: item.url ?? null,
    },
    sourceUrl: applicationUrl,
    title: posting.title?.trim() || item.title?.trim() || "",
  };
}
