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

export const workdaySourceType = "workday" as const;

// The Workday CXS search API rejects request limits above 20.
const WORKDAY_CXS_PAGE_SIZE = 20;

type WorkdayCxsPosting = Readonly<{
  bulletFields?: readonly string[];
  externalPath?: string;
  locationsText?: string;
  postedOn?: string;
  timeType?: string;
  title?: string;
}>;

type WorkdayCxsResponse = Readonly<{
  jobPostings?: readonly WorkdayCxsPosting[];
  total?: number;
}>;

/**
 * Workday tenants expose two public patterns:
 *
 * - CXS (used by most large employers such as Bank of America): a POST JSON
 *   endpoint `{host}/wday/cxs/{tenant}/{site}/jobs` returning
 *   `{total, jobPostings:[{title, externalPath, locationsText, ...}]}` with
 *   offset/limit pagination. No authentication.
 * - RaaS: per-tenant XML/JSON feeds via `?$format=json` (scaffold below).
 *
 * The connector uses CXS when `cxsEndpoint` is configured and falls back to
 * the RaaS scaffold when `raasEndpoint` is configured. Per-tenant validation
 * is required before activating a source.
 */
export function createWorkdayConnector(): JobSourceConnector {
  return {
    name: "Workday (CXS or RaaS, per-tenant validation required)",
    sourceType: workdaySourceType,
    async discoverJobs(context: ConnectorContext): Promise<DiscoveredJob[]> {
      const cxsEndpoint = connectorToken(context.company, "cxsEndpoint");
      if (cxsEndpoint) {
        return discoverWorkdayCxsJobs(cxsEndpoint, context);
      }
      const raasEndpoint = connectorToken(context.company, "raasEndpoint");
      if (raasEndpoint) {
        return discoverWorkdayRaasJobs(raasEndpoint, context);
      }
      throw new JobFetchError(
        "not_configured",
        "workday requires cxsEndpoint or raasEndpoint in company configuration",
      );
    },
    async healthCheck(context: ConnectorContext): Promise<void> {
      const cxsEndpoint = connectorToken(context.company, "cxsEndpoint");
      if (cxsEndpoint) {
        const jobsUrl = workdayCxsJobsUrl(cxsEndpoint);
        const response = await fetchText(jobsUrl.toString(), {
          httpClient: context.httpClient,
          headers: {
            "content-type": "application/json",
            accept: "application/json",
          },
          method: "POST",
          body: JSON.stringify({ appliedFacets: {}, limit: 1, offset: 0, searchText: "" }),
          retryable: false,
        });
        const payload = parseCxsResponse(response.body);
        if ((payload.total ?? 0) <= 0) {
          throw new JobFetchError("parser_changed", "workday_cxs_no_postings");
        }
        return;
      }
      const raasEndpoint = connectorToken(context.company, "raasEndpoint");
      if (!raasEndpoint) {
        throw new JobFetchError(
          "not_configured",
          "workday requires cxsEndpoint or raasEndpoint in company configuration",
        );
      }
      const url = new URL(raasEndpoint);
      url.searchParams.set("$format", "json");
      const response = await fetchText(url.toString(), { httpClient: context.httpClient });
      try {
        const payload = JSON.parse(response.body) as unknown;
        if (extractRequisitions(payload).length === 0) throw new Error("no requisitions");
      } catch {
        throw new JobFetchError("parser_changed", "workday_raas_unexpected_shape");
      }
    },
  };
}

async function discoverWorkdayCxsJobs(
  cxsEndpoint: string,
  context: ConnectorContext,
): Promise<DiscoveredJob[]> {
  const jobsUrl = workdayCxsJobsUrl(cxsEndpoint);
  const host = jobsUrl.host;
  const discovered: DiscoveredJob[] = [];
  let offset = 0;
  // Workday's deep pages report an unreliable `total` (0 on later pages), so
  // pagination stops on an empty page or the max-jobs cap, never on `total`.
  for (let page = 0; page < 30; page += 1) {
    const remaining = context.maxJobs - discovered.length;
    if (remaining <= 0) break;
    const limit = Math.min(WORKDAY_CXS_PAGE_SIZE, remaining);
    const response = await fetchText(jobsUrl.toString(), {
      httpClient: context.httpClient,
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      method: "POST",
      body: JSON.stringify({
        appliedFacets: {},
        limit,
        offset,
        searchText: "",
      }),
      retryable: false,
    });
    const payload = parseCxsResponse(response.body);
    const postings = payload.jobPostings ?? [];
    if (postings.length === 0) {
      if (discovered.length === 0) {
        throw new JobFetchError("parser_changed", "workday_cxs_no_postings");
      }
      break;
    }
    for (const posting of postings) {
      if (discovered.length >= context.maxJobs) break;
      discovered.push(normalizeWorkdayCxsPosting(posting, host));
    }
    offset += postings.length;
    if (postings.length < limit || discovered.length >= context.maxJobs) {
      break;
    }
  }
  return discovered;
}

function workdayCxsJobsUrl(cxsEndpoint: string): URL {
  const url = new URL(cxsEndpoint);
  if (!url.pathname.endsWith("/jobs")) {
    url.pathname = `${url.pathname.replace(/\/$/u, "")}/jobs`;
  }
  return url;
}

function parseCxsResponse(body: string): WorkdayCxsResponse {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new JobFetchError("parser_changed", "workday_cxs_unparseable");
  }
  if (
    typeof payload !== "object" ||
    payload === null ||
    !Array.isArray((payload as WorkdayCxsResponse).jobPostings)
  ) {
    throw new JobFetchError("parser_changed", "workday_cxs_missing_postings");
  }
  return payload as WorkdayCxsResponse;
}

function normalizeWorkdayCxsPosting(posting: WorkdayCxsPosting, host: string): DiscoveredJob {
  const externalPath = posting.externalPath?.trim() ?? "";
  const rawUrl = externalPath.startsWith("/")
    ? `https://${host}${externalPath}`
    : `https://${host}/${externalPath}`;
  const canonical = canonicalizeJobUrl(rawUrl);
  const applicationUrl = canonical ?? rawUrl;
  return {
    applicationDeadline: null,
    applicationUrl,
    descriptionText: "",
    employmentType: mapEmploymentType(posting.timeType ?? null),
    externalJobId: posting.bulletFields?.[0] ?? null,
    locationText: posting.locationsText?.trim() ?? "",
    postedAt: null,
    remoteType: null,
    salaryCurrency: null,
    salaryMax: null,
    salaryMin: null,
    salaryPeriod: null,
    sourcePayload: {
      externalPath: externalPath || null,
      postedOn: posting.postedOn ?? null,
      timeType: posting.timeType ?? null,
    },
    sourceUrl: applicationUrl,
    title: posting.title?.trim() || "",
  };
}

async function discoverWorkdayRaasJobs(
  raasEndpoint: string,
  context: ConnectorContext,
): Promise<DiscoveredJob[]> {
  const url = new URL(raasEndpoint);
  url.searchParams.set("$format", "json");
  const response = await fetchText(url.toString(), { httpClient: context.httpClient });
  let payload: unknown;
  try {
    payload = JSON.parse(response.body);
  } catch {
    throw new JobFetchError("parser_changed", "workday_raas_unparseable");
  }
  const requisitions = extractRequisitions(payload);
  if (requisitions.length === 0) {
    throw new JobFetchError("parser_changed", "workday_raas_unexpected_shape");
  }
  return limited(
    requisitions.map((requisition) => normalizeWorkdayRequisition(requisition)),
    context.maxJobs,
  );
}

type WorkdayRequisition = Readonly<{
  id?: string;
  jobTitle?: string;
  location?: Readonly<{ name?: string }>;
  postedOn?: string;
  publishedOn?: string;
  jobPostingUrl?: string;
  job_description?: string;
  employmentType?: Readonly<{ name?: string }>;
  primaryLocation?: Readonly<{ name?: string }>;
}>;

function extractRequisitions(payload: unknown): WorkdayRequisition[] {
  if (typeof payload !== "object" || payload === null) return [];
  const candidates: unknown[] = [];
  const collect = (value: unknown): void => {
    if (Array.isArray(value)) {
      if (
        value.length > 0 &&
        value.every((item) => typeof item === "object" && item !== null && "jobPostingUrl" in item)
      ) {
        candidates.push(value);
        return;
      }
      for (const item of value) collect(item);
      return;
    }
    if (typeof value !== "object" || value === null) return;
    for (const item of Object.values(value as Readonly<Record<string, unknown>>)) collect(item);
  };
  collect(payload);
  const result: WorkdayRequisition[] = [];
  for (const candidate of candidates) {
    for (const item of candidate as readonly unknown[]) {
      if (typeof item === "object" && item !== null) result.push(item as WorkdayRequisition);
    }
  }
  return result;
}

function normalizeWorkdayRequisition(requisition: WorkdayRequisition): DiscoveredJob {
  const rawUrl = requisition.jobPostingUrl ?? "";
  const canonical = canonicalizeJobUrl(rawUrl);
  const applicationUrl = canonical ?? rawUrl;
  const locationName = requisition.location?.name ?? requisition.primaryLocation?.name ?? null;
  const descriptionText = htmlToPlainText(requisition.job_description ?? "");
  return {
    applicationDeadline: null,
    applicationUrl,
    descriptionText: truncateText(descriptionText, 60_000),
    employmentType: mapEmploymentType(requisition.employmentType?.name ?? null),
    externalJobId: requisition.id ?? null,
    locationText: locationName ?? "",
    postedAt: parseOptionalDate(requisition.postedOn ?? requisition.publishedOn),
    remoteType: null,
    salaryCurrency: null,
    salaryMax: null,
    salaryMin: null,
    salaryPeriod: null,
    sourcePayload: { id: requisition.id ?? null, jobTitle: requisition.jobTitle ?? null },
    sourceUrl: canonical,
    title: requisition.jobTitle?.trim() || "",
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
