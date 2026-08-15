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

export const workableSourceType = "workable" as const;

type WorkableLocation = Readonly<{
  city?: string;
  country?: string;
  hidden?: boolean;
  region?: string;
}>;

type WorkableJob = Readonly<{
  application_url?: string;
  city?: string;
  country?: string;
  created_at?: string;
  description?: string;
  employment_type?: string;
  experience?: string;
  locations?: readonly WorkableLocation[];
  published_on?: string;
  remote?: boolean;
  shortcode?: string;
  shortlink?: string;
  state?: string;
  telecommuting?: boolean;
  title?: string;
  url?: string;
}>;

type WorkableListResponse = Readonly<{
  jobs?: readonly WorkableJob[];
}>;

export function createWorkableConnector(): JobSourceConnector {
  return {
    name: "Workable public widget API",
    sourceType: workableSourceType,
    async discoverJobs(context: ConnectorContext): Promise<DiscoveredJob[]> {
      const account = connectorToken(context.company, "workableAccount");
      if (!account) {
        throw new JobFetchError(
          "not_configured",
          "workable account missing from company configuration",
        );
      }
      const response = await fetchText(
        `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(account)}`,
        { httpClient: context.httpClient },
      );
      let payload: WorkableListResponse;
      try {
        payload = JSON.parse(response.body) as WorkableListResponse;
      } catch {
        throw new JobFetchError("parser_changed", "workable_list_unparseable");
      }
      if (!Array.isArray(payload.jobs)) {
        throw new JobFetchError("parser_changed", "workable_list_missing_jobs");
      }
      const discovered: DiscoveredJob[] = [];
      const seenExternalIds = new Set<string>();
      for (const job of payload.jobs.map(normalizeWorkableJob)) {
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
      const account = connectorToken(context.company, "workableAccount");
      if (!account) throw new JobFetchError("not_configured", "workable account missing");
      const response = await fetchText(
        `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(account)}`,
        { httpClient: context.httpClient },
      );
      let payload: WorkableListResponse;
      try {
        payload = JSON.parse(response.body) as WorkableListResponse;
      } catch {
        throw new JobFetchError("parser_changed", "workable_list_unparseable");
      }
      if (!Array.isArray(payload.jobs)) {
        throw new JobFetchError("parser_changed", "workable_list_missing_jobs");
      }
    },
  };
}

function normalizeWorkableJob(job: WorkableJob): DiscoveredJob {
  const externalJobId = job.shortcode?.trim() || null;
  const rawApplicationUrl = job.application_url?.trim() || job.shortlink?.trim();
  const applicationUrl =
    canonicalizeJobUrl(rawApplicationUrl ?? "") ??
    canonicalizeJobUrl(job.url?.trim() ?? "") ??
    (externalJobId ? `https://apply.workable.com/j/${externalJobId}` : null);
  if (!applicationUrl) {
    throw new JobFetchError("parser_changed", "workable_job_missing_application_url");
  }
  const visibleLocations = (job.locations ?? []).filter((location) => !location.hidden);
  const locationText =
    visibleLocations.length > 0
      ? visibleLocations
          .map((location) =>
            [location.city, location.region, location.country]
              .filter((part): part is string => Boolean(part?.trim()))
              .join(", "),
          )
          .filter(Boolean)
          .join("; ")
      : [job.city, job.state, job.country]
          .filter((part): part is string => Boolean(part?.trim()))
          .join(", ");
  return {
    applicationDeadline: null,
    applicationUrl,
    descriptionText: truncateText(htmlToPlainText(job.description ?? ""), 60_000),
    employmentType: mapEmploymentType(job.employment_type),
    externalJobId,
    locationText,
    postedAt: parseOptionalDate(job.published_on ?? job.created_at),
    remoteType: job.remote === true || job.telecommuting === true ? "remote" : null,
    salaryCurrency: null,
    salaryMax: null,
    salaryMin: null,
    salaryPeriod: null,
    sourcePayload: {
      city: job.city ?? null,
      country: job.country ?? null,
      created_at: job.created_at ?? null,
      department: null,
      employment_type: job.employment_type ?? null,
      experience: job.experience ?? null,
      published_on: job.published_on ?? null,
      shortcode: job.shortcode ?? null,
      state: job.state ?? null,
      title: job.title ?? null,
      url: job.url ?? null,
    },
    sourceUrl: canonicalizeJobUrl(job.url?.trim() ?? "") ?? applicationUrl,
    title: job.title?.trim() || "",
  };
}

function mapEmploymentType(value: string | undefined): string | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized.includes("full")) return "full_time";
  if (normalized.includes("part")) return "part_time";
  if (normalized.includes("contract")) return "contract";
  if (normalized.includes("intern")) return "internship";
  if (normalized.includes("graduate")) return "graduate_programme";
  if (normalized.includes("temporary")) return "temporary";
  return null;
}
