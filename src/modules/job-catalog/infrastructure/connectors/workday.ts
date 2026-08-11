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

/**
 * Workday connectors are a scaffold: there is no stable public job-board API,
 * and each tenant exposes its own RaaS endpoint shape. This connector supports
 * the common JSON RaaS pattern (endpoint?$format=json with Job_Requisition_Data
 * arrays) but must be validated per tenant before use. It intentionally fails
 * with `not_configured` until `raasEndpoint` is supplied in company
 * configuration.
 */
export function createWorkdayConnector(): JobSourceConnector {
  return {
    name: "Workday RaaS (scaffold, per-tenant validation required)",
    sourceType: workdaySourceType,
    async discoverJobs(context: ConnectorContext): Promise<DiscoveredJob[]> {
      const endpoint = connectorToken(context.company, "raasEndpoint");
      if (!endpoint) {
        throw new JobFetchError(
          "not_configured",
          "workday requires raasEndpoint in company configuration",
        );
      }
      const url = new URL(endpoint);
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
    },
    async healthCheck(context: ConnectorContext): Promise<void> {
      const endpoint = connectorToken(context.company, "raasEndpoint");
      if (!endpoint) {
        throw new JobFetchError(
          "not_configured",
          "workday requires raasEndpoint in company configuration",
        );
      }
      const url = new URL(endpoint);
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
