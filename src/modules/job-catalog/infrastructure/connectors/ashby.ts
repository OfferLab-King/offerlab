import { htmlToPlainText, truncateText } from "../../domain/html-text";
import { canonicalizeJobUrl } from "../../domain/urls";
import { JobFetchError } from "./errors";
import { fetchText } from "./http-client";
import {
  connectorToken,
  limited,
  parseOptionalDate,
  type ConnectorContext,
  type DiscoveredJob,
  type JobSourceConnector,
} from "./types";

export const ashbySourceType = "ashby" as const;

type AshbyCompensation = Readonly<{
  compensationTierSummary?: string;
  compensationTiers?: readonly unknown[];
}>;

type AshbyJob = Readonly<{
  address?: string;
  applicationUrl?: string;
  compensation?: AshbyCompensation;
  department?: string;
  descriptionHtml?: string;
  employmentType?: string;
  id?: string;
  jobUrl?: string;
  location?: string;
  publishedAt?: string;
  remote?: boolean;
  secondaryLocations?: readonly string[];
  team?: string;
  title?: string;
}>;

type AshbyResponse = Readonly<{
  jobs?: readonly AshbyJob[];
  jobPostingsUrl?: string;
  paginationInfo?: Readonly<{ hasMore?: boolean; pageCursor?: string }>;
}>;

const MAX_ASHBY_PAGES = 10;

export function createAshbyConnector(): JobSourceConnector {
  return {
    name: "Ashby posting API",
    sourceType: ashbySourceType,
    async discoverJobs(context: ConnectorContext): Promise<DiscoveredJob[]> {
      const org = connectorToken(context.company, "ashbyOrg");
      if (!org) {
        throw new JobFetchError("not_configured", "ashby org token missing from configuration");
      }
      const discovered: DiscoveredJob[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < MAX_ASHBY_PAGES; page += 1) {
        const params = new URLSearchParams({ includeCompensation: "true" });
        if (cursor) params.set("pageCursor", cursor);
        const response = await fetchText(
          `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(org)}?${params.toString()}`,
          { httpClient: context.httpClient },
        );
        let payload: AshbyResponse;
        try {
          payload = JSON.parse(response.body) as AshbyResponse;
        } catch {
          throw new JobFetchError("parser_changed", "ashby_board_unparseable");
        }
        if (!Array.isArray(payload.jobs)) {
          throw new JobFetchError("parser_changed", "ashby_board_missing_jobs");
        }
        discovered.push(
          ...limited(
            payload.jobs.map((job) => normalizeAshbyJob(job, org)),
            context.maxJobs - discovered.length,
          ),
        );
        const hasMore =
          payload.paginationInfo?.hasMore === true &&
          typeof payload.paginationInfo?.pageCursor === "string" &&
          discovered.length < context.maxJobs;
        if (!hasMore) break;
        cursor = payload.paginationInfo?.pageCursor ?? null;
      }
      return discovered;
    },
    async healthCheck(context: ConnectorContext): Promise<void> {
      const org = connectorToken(context.company, "ashbyOrg");
      if (!org) throw new JobFetchError("not_configured", "ashby org token missing");
      const response = await fetchText(
        `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(org)}?includeCompensation=true`,
        { httpClient: context.httpClient },
      );
      try {
        const payload = JSON.parse(response.body) as AshbyResponse;
        if (!Array.isArray(payload.jobs)) throw new Error("missing jobs");
      } catch {
        throw new JobFetchError("parser_changed", "ashby_board_unparseable");
      }
    },
  };
}

function normalizeAshbyJob(job: AshbyJob, org: string): DiscoveredJob {
  const fallbackUrl = `https://jobs.ashbyhq.com/${encodeURIComponent(org)}/${encodeURIComponent(
    job.id ?? "",
  )}`;
  const rawApplicationUrl = job.applicationUrl ?? job.jobUrl ?? fallbackUrl;
  const canonical = canonicalizeJobUrl(rawApplicationUrl) ?? fallbackUrl;
  const descriptionText = htmlToPlainText(job.descriptionHtml ?? "");
  const salary = extractSalary(job.compensation?.compensationTierSummary ?? null);
  const locations = [job.location, ...(job.secondaryLocations ?? []), job.address].filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
  return {
    applicationDeadline: null,
    applicationUrl: canonical,
    descriptionText: truncateText(descriptionText, 60_000),
    employmentType: mapEmploymentType(job.employmentType ?? null),
    externalJobId: job.id ?? null,
    locationText: locations.join(", "),
    postedAt: parseOptionalDate(job.publishedAt),
    remoteType: job.remote === true ? "remote" : null,
    salaryCurrency: salary?.currency ?? null,
    salaryMax: salary?.max ?? null,
    salaryMin: salary?.min ?? null,
    salaryPeriod: "unknown",
    sourcePayload: {
      department: job.department ?? null,
      id: job.id ?? null,
      publishedAt: job.publishedAt ?? null,
      remote: job.remote ?? null,
      team: job.team ?? null,
      title: job.title ?? null,
    },
    sourceUrl: canonical,
    title: job.title?.trim() || "",
  };
}

function mapEmploymentType(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized.includes("full")) return "full_time";
  if (normalized.includes("part")) return "part_time";
  if (normalized.includes("contract")) return "contract";
  if (normalized.includes("intern")) return "internship";
  if (normalized.includes("graduate")) return "graduate_programme";
  return null;
}

function extractSalary(
  summary: string | null,
): Readonly<{ currency: string; max: number; min: number }> | null {
  if (!summary) return null;
  const match = summary.match(
    /([£€$])\s*([\d,]+(?:\.\d+)?)\s*(?:-|to|–)\s*[£€$]?\s*([\d,]+(?:\.\d+)?)/iu,
  );
  if (!match) return null;
  const min = Number(match[2]!.replaceAll(",", ""));
  const max = Number(match[3]!.replaceAll(",", ""));
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { currency: match[1]!, max, min };
}
