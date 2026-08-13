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

export const greenhouseSourceType = "greenhouse" as const;

type GreenhouseLocation = Readonly<{ name?: string }>;

type GreenhouseJob = Readonly<{
  absolute_url?: string;
  content?: string;
  created_at?: string;
  employment_type?: string;
  id?: number;
  internal_job_id?: number;
  location?: GreenhouseLocation;
  metadata?: readonly Readonly<{ name?: string; value?: string }>[];
  title?: string;
  updated_at?: string;
}>;

type GreenhouseListResponse = Readonly<{
  jobs?: readonly GreenhouseJob[];
  meta?: Readonly<{ total?: number }>;
}>;

const MAX_GREENHOUSE_PAGES = 10;

export function createGreenhouseConnector(): JobSourceConnector {
  return {
    name: "Greenhouse job board API",
    sourceType: greenhouseSourceType,
    async discoverJobs(context: ConnectorContext): Promise<DiscoveredJob[]> {
      const token = connectorToken(context.company, "greenhouseBoardToken");
      if (!token) {
        throw new JobFetchError(
          "not_configured",
          "greenhouse board token missing from company configuration",
        );
      }
      const baseUrl = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs`;
      const discovered: DiscoveredJob[] = [];
      const seenExternalIds = new Set<string>();
      for (let page = 1; page <= MAX_GREENHOUSE_PAGES; page += 1) {
        const params = new URLSearchParams({
          content: "true",
          page: String(page),
          per_page: "500",
        });
        const response = await fetchText(`${baseUrl}?${params.toString()}`, {
          httpClient: context.httpClient,
        });
        let payload: GreenhouseListResponse;
        try {
          payload = JSON.parse(response.body) as GreenhouseListResponse;
        } catch {
          throw new JobFetchError("parser_changed", "greenhouse_list_unparseable");
        }
        if (!Array.isArray(payload.jobs)) {
          throw new JobFetchError("parser_changed", "greenhouse_list_missing_jobs");
        }
        let added = 0;
        for (const job of payload.jobs.map((item) => normalizeGreenhouseJob(item, token))) {
          if (discovered.length >= context.maxJobs) break;
          if (job.externalJobId !== null && seenExternalIds.has(job.externalJobId)) continue;
          if (job.externalJobId !== null) seenExternalIds.add(job.externalJobId);
          discovered.push(job);
          added += 1;
        }
        const returnedFullPage = payload.jobs.length >= 500;
        if (added === 0 || discovered.length >= context.maxJobs || !returnedFullPage) break;
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
      const token = connectorToken(context.company, "greenhouseBoardToken");
      if (!token) throw new JobFetchError("not_configured", "greenhouse board token missing");
      const response = await fetchText(
        `${`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs`}?per_page=1`,
        { httpClient: context.httpClient },
      );
      let payload: GreenhouseListResponse;
      try {
        payload = JSON.parse(response.body) as GreenhouseListResponse;
      } catch {
        throw new JobFetchError("parser_changed", "greenhouse_list_unparseable");
      }
      if (!Array.isArray(payload.jobs)) {
        throw new JobFetchError("parser_changed", "greenhouse_list_missing_jobs");
      }
    },
  };
}

function normalizeGreenhouseJob(job: GreenhouseJob, token: string): DiscoveredJob {
  const externalJobId =
    job.id !== undefined
      ? String(job.id)
      : job.internal_job_id !== undefined
        ? String(job.internal_job_id)
        : null;
  const rawApplicationUrl = job.absolute_url?.trim();
  const applicationUrl =
    canonicalizeJobUrl(rawApplicationUrl ?? "") ??
    `https://boards.greenhouse.io/${encodeURIComponent(token)}/jobs/${String(externalJobId ?? "")}`;
  const descriptionText = htmlToPlainText(job.content ?? "");
  const salary = extractSalary(job.metadata);
  return {
    applicationDeadline: null,
    applicationUrl,
    descriptionText: truncateText(descriptionText, 60_000),
    employmentType: mapEmploymentType(job.employment_type),
    externalJobId,
    locationText: job.location?.name?.trim() ?? "",
    postedAt: parseOptionalDate(job.created_at),
    remoteType: null,
    salaryCurrency: salary?.currency ?? null,
    salaryMax: salary?.max ?? null,
    salaryMin: salary?.min ?? null,
    salaryPeriod: salary?.period ?? null,
    sourcePayload: {
      absoluteUrl: job.absolute_url ?? null,
      created_at: job.created_at ?? null,
      employment_type: job.employment_type ?? null,
      internal_job_id: job.internal_job_id ?? null,
      location: job.location?.name ?? null,
      title: job.title ?? null,
      updated_at: job.updated_at ?? null,
    },
    sourceUrl: canonicalizeJobUrl(rawApplicationUrl ?? ""),
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
  return null;
}

function extractSalary(
  metadata: readonly Readonly<{ name?: string; value?: string }>[] | undefined,
): Readonly<{ currency: string; max: number; min: number; period: string }> | null {
  if (!metadata) return null;
  for (const entry of metadata) {
    const name = entry.name?.toLowerCase() ?? "";
    if (!name.includes("compensation") && !name.includes("salary")) continue;
    const value = entry.value ?? "";
    const match = value.match(
      /([£€$])\s*([\d,]+(?:\.\d+)?)\s*(?:-|to|–)\s*[£€$]?\s*([\d,]+(?:\.\d+)?)/iu,
    );
    if (!match) continue;
    const min = Number(match[2]!.replaceAll(",", ""));
    const max = Number(match[3]!.replaceAll(",", ""));
    if (!Number.isFinite(min) || !Number.isFinite(max)) continue;
    const period = name.includes("annual") || name.includes("year") ? "year" : "unknown";
    return { currency: match[1]!, max, min, period };
  }
  return null;
}
