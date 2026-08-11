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

export const leverSourceType = "lever" as const;

type LeverCategories = Readonly<{
  allLocations?: string;
  commitment?: string;
  location?: string;
  team?: string;
  workplaceType?: string;
}>;

type LeverPosting = Readonly<{
  applyUrl?: string;
  categories?: LeverCategories;
  createdAt?: number;
  descriptionPlain?: string;
  hostedUrl?: string;
  id?: string;
  location?: string;
  text?: string;
  title?: string;
  workplaceType?: string;
}>;

export function createLeverConnector(): JobSourceConnector {
  return {
    name: "Lever postings API",
    sourceType: leverSourceType,
    async discoverJobs(context: ConnectorContext): Promise<DiscoveredJob[]> {
      const company = connectorToken(context.company, "leverCompany");
      if (!company) {
        throw new JobFetchError("not_configured", "lever company token missing from configuration");
      }
      const response = await fetchText(
        `https://api.lever.co/v0/postings/${encodeURIComponent(company)}?mode=json`,
        { httpClient: context.httpClient },
      );
      let payload: readonly LeverPosting[];
      try {
        const parsed = JSON.parse(response.body) as unknown;
        if (!Array.isArray(parsed)) throw new Error("not an array");
        payload = parsed as readonly LeverPosting[];
      } catch {
        throw new JobFetchError("parser_changed", "lever_postings_unparseable");
      }
      return limited(
        payload.map((posting) => normalizeLeverPosting(posting, company)),
        context.maxJobs,
      );
    },
    async healthCheck(context: ConnectorContext): Promise<void> {
      const company = connectorToken(context.company, "leverCompany");
      if (!company) throw new JobFetchError("not_configured", "lever company token missing");
      const response = await fetchText(
        `https://api.lever.co/v0/postings/${encodeURIComponent(company)}?mode=json`,
        { httpClient: context.httpClient },
      );
      try {
        const parsed = JSON.parse(response.body) as unknown;
        if (!Array.isArray(parsed)) throw new Error("not an array");
      } catch {
        throw new JobFetchError("parser_changed", "lever_postings_unparseable");
      }
    },
  };
}

function normalizeLeverPosting(posting: LeverPosting, company: string): DiscoveredJob {
  const fallbackUrl = `https://jobs.lever.co/${encodeURIComponent(company)}/${encodeURIComponent(
    posting.id ?? "",
  )}`;
  const rawApplicationUrl = posting.hostedUrl ?? posting.applyUrl ?? fallbackUrl;
  const canonical = canonicalizeJobUrl(rawApplicationUrl) ?? fallbackUrl;
  const descriptionText = htmlToPlainText(posting.text ?? posting.descriptionPlain ?? "");
  const workplaceType = posting.workplaceType ?? posting.categories?.workplaceType ?? null;
  return {
    applicationDeadline: null,
    applicationUrl: canonical,
    descriptionText: truncateText(descriptionText, 60_000),
    employmentType: mapEmploymentType(posting.categories?.commitment ?? null),
    externalJobId: posting.id ?? null,
    locationText:
      posting.location ?? posting.categories?.allLocations ?? posting.categories?.location ?? "",
    postedAt: posting.createdAt ? parseOptionalDate(posting.createdAt) : null,
    remoteType: mapRemoteType(workplaceType),
    salaryCurrency: null,
    salaryMax: null,
    salaryMin: null,
    salaryPeriod: null,
    sourcePayload: {
      applyUrl: posting.applyUrl ?? null,
      categories: posting.categories ?? null,
      createdAt: posting.createdAt ?? null,
      hostedUrl: posting.hostedUrl ?? null,
      id: posting.id ?? null,
      team: posting.categories?.team ?? null,
      title: posting.title ?? null,
    },
    sourceUrl: canonical,
    title: posting.title?.trim() || "",
  };
}

function mapEmploymentType(commitment: string | null | undefined): string | null {
  const normalized = commitment?.trim().toLowerCase() ?? "";
  if (normalized.includes("full")) return "full_time";
  if (normalized.includes("part")) return "part_time";
  if (normalized.includes("contract")) return "contract";
  if (normalized.includes("intern")) return "internship";
  if (normalized.includes("graduate")) return "graduate_programme";
  return null;
}

function mapRemoteType(workplaceType: string | null | undefined): string | null {
  const normalized = workplaceType?.trim().toLowerCase() ?? "";
  if (normalized.includes("remote")) return "remote";
  if (normalized.includes("hybrid")) return "hybrid";
  if (normalized.includes("onsite") || normalized.includes("on-site")) return "on_site";
  return null;
}
