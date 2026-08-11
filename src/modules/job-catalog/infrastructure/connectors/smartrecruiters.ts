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

export const smartRecruitersSourceType = "smartrecruiters" as const;

const MAX_SMART_RECRUITERS_DETAILS = 100;
const SMART_RECRUITERS_PAGE_SIZE = 100;

type SmartLocation = Readonly<{
  city?: string;
  country?: string;
  countryCode?: string;
  region?: string;
  remote?: boolean;
}>;

type SmartPosting = Readonly<{
  companyName?: string;
  department?: Readonly<{ label?: string }>;
  experienceLevel?: Readonly<{ label?: string }>;
  id?: string;
  location?: SmartLocation;
  name?: string;
  releasedDate?: string;
  typeOfEmployment?: Readonly<{ label?: string }>;
}>;

type SmartListResponse = Readonly<{
  content?: readonly SmartPosting[];
  pagination?: Readonly<{ continuationToken?: string }>;
}>;

type SmartSection = Readonly<{ title?: string; content?: string }>;

type SmartDetail = Readonly<{
  applyUrl?: string;
  jobAd?: Readonly<{ sections?: readonly SmartSection[] }>;
  location?: SmartLocation;
  name?: string;
  releasedDate?: string;
}>;

export function createSmartRecruitersConnector(): JobSourceConnector {
  return {
    name: "SmartRecruiters postings API",
    sourceType: smartRecruitersSourceType,
    async discoverJobs(context: ConnectorContext): Promise<DiscoveredJob[]> {
      const company = connectorToken(context.company, "smartRecruitersCompany");
      if (!company) {
        throw new JobFetchError(
          "not_configured",
          "smartrecruiters company token missing from configuration",
        );
      }
      const listing: SmartPosting[] = [];
      let continuationToken: string | undefined;
      for (let page = 0; page < 10; page += 1) {
        const params = new URLSearchParams({ limit: String(SMART_RECRUITERS_PAGE_SIZE) });
        if (continuationToken) params.set("continuationToken", continuationToken);
        const response = await fetchText(
          `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(company)}/postings?${params.toString()}`,
          { httpClient: context.httpClient },
        );
        let payload: SmartListResponse;
        try {
          payload = JSON.parse(response.body) as SmartListResponse;
        } catch {
          throw new JobFetchError("parser_changed", "smartrecruiters_list_unparseable");
        }
        if (!Array.isArray(payload.content)) {
          throw new JobFetchError("parser_changed", "smartrecruiters_list_missing_content");
        }
        listing.push(...payload.content);
        continuationToken = payload.pagination?.continuationToken;
        const hasMore = Boolean(continuationToken) && listing.length < context.maxJobs;
        if (!hasMore) break;
      }

      const candidates = limited(listing, context.maxJobs);
      const withDetails = await Promise.all(
        candidates.map(async (posting) => {
          if (!posting.id) return normalizeSmartPosting(posting, company, null);
          try {
            const response = await fetchText(
              `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(company)}/postings/${encodeURIComponent(posting.id)}`,
              { httpClient: context.httpClient },
            );
            const detail = JSON.parse(response.body) as SmartDetail;
            return normalizeSmartPosting(posting, company, detail);
          } catch (error) {
            if (error instanceof JobFetchError && error.code === "http_404") {
              return normalizeSmartPosting(posting, company, null);
            }
            throw error;
          }
        }),
      );
      return withDetails.slice(0, MAX_SMART_RECRUITERS_DETAILS);
    },
    async healthCheck(context: ConnectorContext): Promise<void> {
      const company = connectorToken(context.company, "smartRecruitersCompany");
      if (!company)
        throw new JobFetchError("not_configured", "smartrecruiters company token missing");
      const response = await fetchText(
        `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(company)}/postings?limit=1`,
        { httpClient: context.httpClient },
      );
      try {
        const payload = JSON.parse(response.body) as SmartListResponse;
        if (!Array.isArray(payload.content)) throw new Error("missing content");
      } catch {
        throw new JobFetchError("parser_changed", "smartrecruiters_list_unparseable");
      }
    },
  };
}

function normalizeSmartPosting(
  posting: SmartPosting,
  company: string,
  detail: SmartDetail | null,
): DiscoveredJob {
  const rawApplicationUrl = detail?.applyUrl ?? undefined;
  const fallbackUrl = `https://jobs.smartrecruiters.com/${encodeURIComponent(
    company,
  )}/${encodeURIComponent(posting.id ?? "")}`;
  const canonical = canonicalizeJobUrl(rawApplicationUrl ?? "") ?? fallbackUrl;
  const descriptionHtml =
    detail?.jobAd?.sections?.map((section) => section.content ?? "").join("\n") ?? "";
  const descriptionText = htmlToPlainText(descriptionHtml);
  const location = posting.location ?? detail?.location;
  const locationText = [location?.city, location?.region, location?.country]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(", ");
  return {
    applicationDeadline: null,
    applicationUrl: canonical,
    descriptionText: truncateText(descriptionText, 60_000),
    employmentType: mapEmploymentType(posting.typeOfEmployment?.label ?? null),
    externalJobId: posting.id ?? null,
    locationText,
    postedAt: parseOptionalDate(posting.releasedDate ?? detail?.releasedDate),
    remoteType: location?.remote === true ? "remote" : null,
    salaryCurrency: null,
    salaryMax: null,
    salaryMin: null,
    salaryPeriod: null,
    sourcePayload: {
      department: posting.department?.label ?? null,
      experienceLevel: posting.experienceLevel?.label ?? null,
      id: posting.id ?? null,
      releasedDate: posting.releasedDate ?? null,
    },
    sourceUrl: canonical,
    title: (posting.name ?? detail?.name)?.trim() || "",
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
