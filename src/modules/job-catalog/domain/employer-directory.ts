import { employerIndustries, employerIndustryLabels } from "../../taxonomy/employer-industry";
import { employerIndustryFromDirectorySector } from "../../taxonomy/taxonomy-mapping";

export type EmployerDirectoryEntry = Readonly<{
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  description: string | null;
  directory_visible: boolean;
  website_url: string | null;
  careers_url: string | null;
  employer_industry_key: string | null;
  employer_subindustry_key: string | null;
  employee_band: string | null;
  employee_scope: string | null;
  ownership_type: string | null;
  ticker: string | null;
  exchange: string | null;
  facts_as_of: Date | null;
  has_sponsor: boolean;
  sponsor_snapshot_date: Date | null;
  current_jobs: number;
  live_sources: number;
}>;

export type EmployerDirectorySort = "hiring" | "roles" | "az";

export type EmployerDirectoryFilters = Readonly<{
  query: string | null;
  industry: string | null;
  sponsor: boolean;
  hiring: boolean;
  sizeBand: string | null;
  ownership: string | null;
  sort: EmployerDirectorySort;
  page: number;
}>;

export const EMPLOYER_DIRECTORY_PAGE_SIZE = 48;

export const EMPLOYER_DIRECTORY_INDUSTRIES: readonly string[] = [...employerIndustries];

export function parseEmployerDirectoryFilters(
  searchParams: Readonly<Record<string, string | string[] | undefined>>,
): EmployerDirectoryFilters {
  const single = (key: string): string | null => {
    const value = searchParams[key];
    if (typeof value !== "string" || value.length === 0) return null;
    return value;
  };
  const sort = single("sort") ?? "hiring";
  // Legacy `sector` parameter from the retired sector routes and older links:
  // legacy directory sector keys map deterministically to employer industries
  // (raw key form or URL-slug form).
  const legacySector = single("sector");
  const sectorIndustry =
    legacySector !== null
      ? (employerIndustryFromDirectorySector(legacySector) ??
        employerIndustryFromDirectorySector(legacySector.replaceAll("-", "_")))
      : null;
  const page = Number(single("page") ?? "1");
  return {
    query: single("q")?.trim().toLowerCase() ?? null,
    industry: single("industry") ?? sectorIndustry,
    sponsor: single("sponsor") === "1",
    hiring: single("hiring") === "1",
    sizeBand: single("size") ?? null,
    ownership: single("ownership") ?? null,
    sort: sort === "roles" || sort === "az" || sort === "hiring" ? sort : "hiring",
    page: Number.isInteger(page) && page >= 1 && page <= 1000 ? page : 1,
  };
}

/**
 * Quality-based directory visibility: an employer is listed when it has
 * current published roles, is explicitly curated for the directory
 * (directory_visible), or carries a credible researched profile (verified
 * industry plus size/ownership/sponsor evidence and an official URL).
 * Research tier, rank and scores never affect visibility.
 */
export function isEmployerDirectoryVisible(entry: EmployerDirectoryEntry): boolean {
  if (entry.current_jobs > 0) return true;
  if (entry.directory_visible) return true;
  return hasCredibleProfile(entry);
}

export function hasCredibleProfile(entry: EmployerDirectoryEntry): boolean {
  const hasIndustry = entry.employer_industry_key !== null;
  const hasEvidence =
    entry.employee_band !== null || entry.ownership_type !== null || entry.has_sponsor;
  const hasOfficialUrl = entry.website_url !== null || entry.careers_url !== null;
  return hasIndustry && hasEvidence && hasOfficialUrl;
}

/**
 * Pure filter/sort spec for the employer directory. The SQL directory query in
 * `catalog-repository.listEmployerPublicDirectory` mirrors these exact
 * semantics (visibility, name/slug search, industry, sponsor, hiring,
 * size band, ownership, and the hiring/roles/A-Z sorts); this function and its
 * tests remain the executable specification for that mirror.
 */
export function employerDirectoryFilterAndSort(
  rows: readonly EmployerDirectoryEntry[],
  filters: EmployerDirectoryFilters,
): EmployerDirectoryEntry[] {
  const filtered = rows.filter((entry) => {
    if (!isEmployerDirectoryVisible(entry)) return false;
    if (filters.query) {
      const haystack = `${entry.name} ${entry.slug}`.toLowerCase();
      if (!haystack.includes(filters.query)) return false;
    }
    if (filters.industry && entry.employer_industry_key !== filters.industry) return false;
    if (filters.sponsor && !entry.has_sponsor) return false;
    if (filters.hiring && entry.current_jobs === 0) return false;
    if (filters.sizeBand && entry.employee_band !== filters.sizeBand) return false;
    if (filters.ownership && entry.ownership_type !== filters.ownership) return false;
    return true;
  });

  return [...filtered].sort((a, b) => {
    switch (filters.sort) {
      case "az":
        return a.name.localeCompare(b.name);
      case "roles":
        return b.current_jobs - a.current_jobs || a.name.localeCompare(b.name);
      case "hiring":
        return (
          (b.current_jobs > 0 ? 1 : 0) - (a.current_jobs > 0 ? 1 : 0) ||
          b.current_jobs - a.current_jobs ||
          a.name.localeCompare(b.name)
        );
    }
  });
}

export function employerIndustryLabel(key: string | null): string | null {
  if (!key) return null;
  return employerIndustryLabels[key as keyof typeof employerIndustryLabels] ?? null;
}

/**
 * Semantic employee-band ordering. Bands are categorical labels, so a plain
 * string sort would place "1,000-4,999" before "1-49"; the research dataset
 * uses these exact band labels, which are ranked smallest to largest here.
 */
const EMPLOYEE_BAND_RANK: Readonly<Record<string, number>> = {
  "1-49": 1,
  "50-249": 2,
  "250-999": 3,
  "1,000-4,999": 4,
  "5,000-9,999": 5,
  "10,000-49,999": 6,
  "50,000-99,999": 7,
  "100,000+": 8,
};

export function employeeBandRank(band: string): number {
  return EMPLOYEE_BAND_RANK[band] ?? 100;
}

export function distinctEmployeeBands(rows: readonly EmployerDirectoryEntry[]): readonly string[] {
  return [
    ...new Set(
      rows.map((row) => row.employee_band).filter((band): band is string => band !== null),
    ),
  ].sort((a, b) => employeeBandRank(a) - employeeBandRank(b) || a.localeCompare(b));
}

export function distinctOwnerships(rows: readonly EmployerDirectoryEntry[]): readonly string[] {
  return [
    ...new Set(
      rows.map((row) => row.ownership_type).filter((value): value is string => value !== null),
    ),
  ].sort((a, b) => a.localeCompare(b));
}
