import { z } from "zod";
import {
  jobSectorKeys,
  jobSubsectorKeys,
  opportunityTypes,
  remoteTypes,
  visaSponsorshipStatuses,
} from "./taxonomy";

export const JOB_CATALOG_PAGE_SIZE = 24;
export const JOB_CATALOG_MAX_PAGE_SIZE = 48;

export type JobCatalogSort = "relevance" | "newest" | "closing" | "salary";

export type JobCatalogFilters = Readonly<{
  query: string;
  sectors: readonly string[];
  subsectors: readonly string[];
  employers: readonly string[];
  locations: readonly string[];
  jobTypes: readonly string[];
  sponsorship: readonly string[];
  deadline: "any" | "upcoming" | "none";
  postedWithinDays: number | null;
  sort: JobCatalogSort;
  page: number;
}>;

export const defaultJobCatalogFilters: JobCatalogFilters = {
  deadline: "any",
  employers: [],
  jobTypes: [],
  locations: [],
  page: 1,
  postedWithinDays: null,
  query: "",
  sectors: [],
  sort: "newest",
  sponsorship: [],
  subsectors: [],
};

export type CatalogFacetGroup =
  "sectors" | "subsectors" | "employers" | "locations" | "jobTypes" | "sponsorship";

export const catalogFacetGroups: readonly CatalogFacetGroup[] = [
  "sectors",
  "subsectors",
  "employers",
  "locations",
  "jobTypes",
  "sponsorship",
];

/** Stable machine key -> URL slug (e.g. financial_services -> financial-services). */
export function keyToSlug(key: string): string {
  return key.replaceAll("_", "-");
}

/** URL slug -> stable machine key (e.g. financial-services -> financial_services). */
export function slugToKey(slug: string): string {
  return slug.replaceAll("-", "_");
}

const commaSeparated = z
  .string()
  .trim()
  .max(2000)
  .transform((value) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  )
  .optional();

function listParam(searchParams: URLSearchParams, name: string): string[] {
  const values: string[] = [];
  for (const raw of searchParams.getAll(name)) {
    const parsed = commaSeparated.parse(raw) ?? [];
    values.push(...parsed);
  }
  return [...new Set(values)];
}

const allowedKeys = (allowed: readonly string[], slug: boolean) =>
  z
    .string()
    .transform((value) => (slug ? slugToKey(value) : value))
    .refine((value) => (allowed as readonly string[]).includes(value))
    .optional();

export function parseJobCatalogFilters(searchParams: URLSearchParams): JobCatalogFilters {
  const query = z
    .string()
    .trim()
    .max(200)
    .catch("")
    .parse(searchParams.get("q") ?? "");
  const sectors = listParam(searchParams, "sectors")
    .map((value) => allowedKeys(jobSectorKeys, true).catch(undefined).parse(value))
    .filter((value): value is string => value !== undefined);
  const subsectors = listParam(searchParams, "subsectors")
    .map((value) => allowedKeys(jobSubsectorKeys, true).catch(undefined).parse(value))
    .filter((value): value is string => value !== undefined);
  const employers = listParam(searchParams, "employers")
    .map((value) => z.string().trim().max(120).catch("").parse(value))
    .filter(Boolean);
  const locations = listParam(searchParams, "locations")
    .map((value) => z.string().trim().max(120).catch("").parse(value))
    .filter(Boolean);
  const jobTypes = listParam(searchParams, "job_types")
    .map((value) => allowedKeys(opportunityTypes, true).catch(undefined).parse(value))
    .filter((value): value is string => value !== undefined);
  const sponsorship = listParam(searchParams, "sponsorship")
    .map((value) => allowedKeys(visaSponsorshipStatuses, false).catch(undefined).parse(value))
    .filter((value): value is string => value !== undefined);
  const deadline = z
    .enum(["any", "upcoming", "none"])
    .catch("any")
    .parse(searchParams.get("deadline") ?? "any");
  const sort = z
    .enum(["relevance", "newest", "closing", "salary"])
    .catch("newest")
    .parse(searchParams.get("sort") ?? "newest");
  const postedWithinDays = z
    .preprocess((value) => {
      const parsed = typeof value === "string" && value.length > 0 ? Number(value) : value;
      return typeof parsed === "number" && Number.isInteger(parsed) && parsed >= 1 && parsed <= 365
        ? parsed
        : undefined;
    }, z.number().optional())
    .parse(searchParams.get("posted") ?? "");
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .max(10_000)
    .catch(1)
    .parse(searchParams.get("page") ?? "1");

  return {
    deadline,
    employers,
    jobTypes,
    locations: locations.map((value) => value.toLowerCase()),
    page,
    postedWithinDays: postedWithinDays ?? null,
    query,
    sectors,
    sort,
    sponsorship: [...new Set(sponsorship)],
    subsectors,
  };
}

export function serializeJobCatalogFilters(filters: JobCatalogFilters): URLSearchParams {
  const params = new URLSearchParams();
  const setList = (name: string, values: readonly string[], slug: boolean): void => {
    if (values.length > 0) params.set(name, values.map((v) => (slug ? keyToSlug(v) : v)).join(","));
  };
  if (filters.query) params.set("q", filters.query);
  setList("sectors", filters.sectors, true);
  setList("subsectors", filters.subsectors, true);
  setList("employers", filters.employers, false);
  setList("locations", filters.locations, false);
  setList("job_types", filters.jobTypes, true);
  setList("sponsorship", filters.sponsorship, false);
  if (filters.deadline !== "any") params.set("deadline", filters.deadline);
  if (filters.postedWithinDays) params.set("posted", String(filters.postedWithinDays));
  if (filters.sort !== "newest") params.set("sort", filters.sort);
  if (filters.page > 1) params.set("page", String(filters.page));
  return params;
}

export function filtersToSearchParams(filters: JobCatalogFilters): string {
  return serializeJobCatalogFilters(filters).toString();
}

export function activeFilterCount(filters: JobCatalogFilters): number {
  return (
    (filters.sectors.length > 0 ? 1 : 0) +
    (filters.subsectors.length > 0 ? 1 : 0) +
    (filters.employers.length > 0 ? 1 : 0) +
    (filters.locations.length > 0 ? 1 : 0) +
    (filters.jobTypes.length > 0 ? 1 : 0) +
    (filters.sponsorship.length > 0 ? 1 : 0) +
    (filters.deadline !== "any" ? 1 : 0) +
    (filters.postedWithinDays !== null ? 1 : 0) +
    (filters.sort !== "newest" ? 1 : 0) +
    (filters.page > 1 ? 1 : 0)
  );
}

export const workModeValues = ["remote", "hybrid", "on_site"] as const;

export function splitLocationSelections(
  locations: readonly string[],
): Readonly<{ labels: string[]; modes: string[] }> {
  const modes = new Set<string>();
  const labels: string[] = [];
  for (const location of locations) {
    const normalized = location.trim().toLowerCase();
    if ((remoteTypes as readonly string[]).includes(normalized)) {
      modes.add(normalized);
    } else {
      labels.push(normalized);
    }
  }
  return { labels, modes: [...modes] };
}

export type FacetOption = Readonly<{ value: string; label: string; count: number }>;

export type JobFacetCounts = Readonly<{
  employers: readonly FacetOption[];
  jobTypes: readonly FacetOption[];
  locations: readonly FacetOption[];
  sectors: readonly FacetOption[];
  sponsorship: readonly FacetOption[];
  subsectors: readonly FacetOption[];
}>;

export type FacetGroupKey = keyof JobFacetCounts;

/**
 * Pure clause builder shared by the results query and every disjunctive facet
 * count. Semantics (spec rules 1-5):
 *  - selections inside one facet combine with OR;
 *  - different facets combine with AND;
 *  - keyword search ANDs with every facet;
 *  - selecting sectors without subsectors includes all descendant subsectors;
 *  - selecting subsectors filters by subsector only.
 * `excludeFacet` removes one facet group so counts stay disjunctive: other
 * facets apply, but options in the counted group are not constrained by their
 * own selections.
 */
export function buildJobFilterClauses(
  filters: JobCatalogFilters,
  now: Date,
  options: Readonly<{ excludeFacet?: CatalogFacetGroup }> = {},
): Readonly<{ conditions: string[]; values: unknown[] }> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  const parameter = (value: unknown): string => {
    values.push(value);
    return `$${values.length}`;
  };

  if (filters.query) {
    conditions.push(
      `j.search_vector @@ websearch_to_tsquery('english', ${parameter(filters.query)})`,
    );
  }
  if (
    filters.sectors.length > 0 &&
    filters.subsectors.length === 0 &&
    options.excludeFacet !== "sectors"
  ) {
    conditions.push(`j.sector_key = any(${parameter(filters.sectors)})`);
  }
  if (filters.subsectors.length > 0 && options.excludeFacet !== "subsectors") {
    conditions.push(`j.subsector_key = any(${parameter(filters.subsectors)})`);
  }
  if (filters.employers.length > 0 && options.excludeFacet !== "employers") {
    conditions.push(`c.slug = any(${parameter(filters.employers)})`);
  }
  if (filters.locations.length > 0 && options.excludeFacet !== "locations") {
    const { labels, modes } = splitLocationSelections(filters.locations);
    const parts: string[] = [];
    if (modes.length > 0) {
      parts.push(`j.remote_type = any(${parameter(modes)})`);
    }
    if (labels.length > 0) {
      parts.push(
        `exists (
          select 1 from app.job_location jl
          where jl.job_id = j.id
            and lower(coalesce(nullif(btrim(jl.city), ''), nullif(btrim(jl.region), ''), nullif(btrim(jl.source_text), ''))) = any(${parameter(labels)})
        )`,
      );
    }
    if (parts.length > 0) conditions.push(`(${parts.join(" or ")})`);
  }
  if (filters.jobTypes.length > 0 && options.excludeFacet !== "jobTypes") {
    conditions.push(`j.opportunity_type = any(${parameter(filters.jobTypes)})`);
  }
  if (filters.sponsorship.length > 0 && options.excludeFacet !== "sponsorship") {
    conditions.push(`j.visa_sponsorship_status = any(${parameter(filters.sponsorship)})`);
  }
  if (filters.deadline === "upcoming") {
    conditions.push(`j.application_deadline >= ${parameter(now)}`);
  }
  if (filters.deadline === "none") conditions.push(`j.application_deadline is null`);
  if (filters.postedWithinDays) {
    conditions.push(
      `j.first_seen_at >= ${parameter(new Date(now.getTime() - filters.postedWithinDays * 86_400_000))}`,
    );
  }

  return { conditions, values };
}

export const jobCatalogSortLabels: Readonly<Record<JobCatalogSort, string>> = {
  closing: "Closing soon",
  newest: "Newest",
  relevance: "Most relevant",
  salary: "Salary",
};
