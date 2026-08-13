import { withApplicationRole } from "../../../infrastructure/database/runtime-connections";
import { isEmployerIndexable } from "../domain/employer-indexability";
import {
  jobSectorLabel,
  jobSubsectorLabel,
  opportunityTypeLabels,
  visaSponsorshipLabels,
} from "../domain/taxonomy";
import type { JobCatalogFilters } from "../domain/catalog";
import {
  findEmployerProfile,
  findEmployerPublicProfile,
  findJobDetail,
  findJobsByIds,
  listCatalogJobsForSitemap,
  listCompanyActiveJobs,
  listEmployerDirectory,
  listEmployerPublicDirectory,
  listIndexableEmployersForSitemap,
  listRelatedEmployerJobs,
  listSimilarJobs,
  sectorJobCounts,
  searchJobsFaceted,
  type EmployerDirectoryRow,
  type EmployerProfileRow,
  type EmployerPublicProfileRow,
  type EmployerSitemapRow,
  type FacetCountRow,
  type JobCardRow,
  type JobDetailRow,
  type JobLocationEvidence,
  type JobSearchResult,
  type RelatedJobEvidence,
  type SectorCountRow,
} from "../infrastructure/catalog-repository";

export type FacetedSearchPayload = Readonly<{
  facets: Readonly<{
    employers: readonly FacetOptionView[];
    functions: readonly FacetOptionView[];
    industries: readonly FacetOptionView[];
    jobTypes: readonly FacetOptionView[];
    levels: readonly FacetOptionView[];
    locations: readonly FacetOptionView[];
    sectors: readonly FacetOptionView[];
    sponsorLicence: readonly FacetOptionView[];
    sponsorship: readonly FacetOptionView[];
    subsectors: readonly FacetOptionView[];
    workModes: readonly FacetOptionView[];
  }>;
  hasSalaryData: boolean;
  result: JobSearchResult;
}>;

export type FacetOptionView = Readonly<{ value: string; label: string; count: number }>;

const WORK_MODE_LABELS: Readonly<Record<string, string>> = {
  hybrid: "Hybrid",
  on_site: "On-site",
  remote: "Remote",
};

function presentLocations(rows: readonly FacetCountRow[]): FacetOptionView[] {
  return rows
    .filter((row) => row.value.length > 0)
    .map((row) => ({
      count: row.count,
      label: WORK_MODE_LABELS[row.value] ?? titleCase(row.value),
      value: row.value,
    }));
}

function titleCase(value: string): string {
  return value
    .split(/\s+/u)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function presentWithTaxonomy(
  rows: readonly FacetCountRow[],
  labelFor: (key: string) => string | null,
): FacetOptionView[] {
  return rows.flatMap((row) => {
    const label = labelFor(row.value);
    return label ? [{ count: row.count, label, value: row.value }] : [];
  });
}

export async function searchJobCatalogFaceted(
  filters: JobCatalogFilters,
): Promise<FacetedSearchPayload> {
  const { facets, hasSalaryData, result } = await withApplicationRole((database) =>
    searchJobsFaceted(database, filters),
  );
  return {
    facets: {
      employers: facets.employers.map((row) => ({
        count: row.count,
        label: row.label ?? row.value,
        value: row.value,
      })),
      functions: facets.functions.map((row) => ({
        count: row.count,
        label: row.label ?? row.value.replaceAll("_", " "),
        value: row.value,
      })),
      industries: facets.industries.map((row) => ({
        count: row.count,
        label: row.label ?? row.value.replaceAll("_", " "),
        value: row.value,
      })),
      jobTypes: presentWithTaxonomy(
        facets.jobTypes,
        (key) => opportunityTypeLabels[key as keyof typeof opportunityTypeLabels] ?? null,
      ),
      levels: facets.levels.map((row) => ({
        count: row.count,
        label: row.label ?? row.value.replaceAll("_", " "),
        value: row.value,
      })),
      locations: presentLocations(facets.locations),
      sectors: presentWithTaxonomy(facets.sectors, (key) => jobSectorLabel(key)),
      sponsorLicence: facets.sponsorLicence.map((row) => ({
        count: row.count,
        label: row.label ?? "Employer is a UK licensed sponsor",
        value: row.value,
      })),
      sponsorship: presentWithTaxonomy(
        facets.sponsorship,
        (key) => visaSponsorshipLabels[key as keyof typeof visaSponsorshipLabels] ?? null,
      ),
      subsectors: presentWithTaxonomy(facets.subsectors, (key) => jobSubsectorLabel(key)),
      workModes: facets.workModes.map((row) => ({
        count: row.count,
        label: row.label ?? row.value.replaceAll("_", " "),
        value: row.value,
      })),
    },
    hasSalaryData,
    result,
  };
}

export function readJobDetail(slugOrId: string): Promise<JobDetailRow | null> {
  return withApplicationRole((database) => findJobDetail(database, slugOrId));
}

export function readJobsByIds(ids: readonly string[]): Promise<JobDetailRow[]> {
  return withApplicationRole((database) => findJobsByIds(database, ids));
}

export function readSectorJobCounts(): Promise<SectorCountRow[]> {
  return withApplicationRole((database) => sectorJobCounts(database));
}

export function readSitemapJobs(
  limit = 10_000,
): Promise<readonly { slug: string; last_changed_at: Date }[]> {
  return withApplicationRole((database) => listCatalogJobsForSitemap(database, limit));
}

export function readSitemapEmployers(limit = 10_000): Promise<readonly EmployerSitemapRow[]> {
  return withApplicationRole((database) => listIndexableEmployersForSitemap(database, limit));
}

export function readEmployerDirectory(): Promise<EmployerDirectoryRow[]> {
  return withApplicationRole((database) => listEmployerDirectory(database));
}

export function readEmployerDirectoryEntries(): Promise<readonly EmployerPublicProfileRow[]> {
  return withApplicationRole((database) => listEmployerPublicDirectory(database));
}

export type EmployerAutocompleteOption = Readonly<{
  id: string;
  slug: string;
  name: string;
  industryKey: string | null;
}>;

/** Bounded server-side employer autocomplete matching canonical name or aliases. */
export async function searchEmployersForAutocomplete(
  query: string,
  limit = 8,
): Promise<EmployerAutocompleteOption[]> {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length < 2) return [];
  return withApplicationRole(async (database) => {
    const rows = await database<EmployerAutocompleteOption[]>`
      select id, slug, name, employer_industry_key as "industryKey"
      from app.employer_public_profile
      where name ilike ${`%${trimmed}%`}
         or exists (
           select 1 from jsonb_array_elements_text(aliases) as alias
           where lower(alias) like ${`%${trimmed}%`}
         )
      order by name asc
      limit ${limit}
    `;
    return rows;
  });
}

export type EmployerProfileView = EmployerProfileRow &
  Readonly<{ indexable: boolean; publicProfile: EmployerPublicProfileRow | null }>;

export async function readEmployerProfile(slug: string): Promise<EmployerProfileView | null> {
  return withApplicationRole(async (database) => {
    const [row, publicProfile] = await Promise.all([
      findEmployerProfile(database, slug),
      findEmployerPublicProfile(database, slug),
    ]);
    if (!row) return null;
    return {
      ...row,
      indexable: isEmployerIndexable({
        active: row.active,
        description: row.description,
        hasImportedJobs: row.has_imported_jobs,
        hasOfficialEmployerInfo: row.website_url !== null || row.careers_url !== null,
        hasCredibleProfile:
          publicProfile !== null &&
          publicProfile.employer_industry_key !== null &&
          (publicProfile.employee_band !== null ||
            publicProfile.ownership_type !== null ||
            publicProfile.has_sponsor) &&
          (publicProfile.website_url !== null || publicProfile.careers_url !== null),
      }),
      publicProfile,
    };
  });
}

export function readEmployerActiveJobs(companyId: string): Promise<JobCardRow[]> {
  return withApplicationRole((database) => listCompanyActiveJobs(database, companyId, 50));
}

export const RELATED_JOBS_SECTION_LIMIT = 3;

export type RelatedJobsView = Readonly<{
  sameEmployer: readonly JobCardRow[];
  similar: readonly JobCardRow[];
}>;

/**
 * Compact, factual related-role sections for a job detail page. Both queries
 * are bounded, deterministic and only ever return active, eligible, published,
 * non-expired roles; the current role and the same-employer results are
 * excluded from the similar section so no role appears twice.
 */
export function readRelatedJobs(job: JobDetailRow): Promise<RelatedJobsView> {
  return withApplicationRole(async (database) => {
    const sameEmployer = await listRelatedEmployerJobs(
      database,
      job.company_id,
      job.id,
      RELATED_JOBS_SECTION_LIMIT,
    );
    const evidence = relatedJobEvidence(job);
    const hasEvidence =
      evidence.sectorKey !== null ||
      evidence.subsectorKey !== null ||
      evidence.opportunityType !== null ||
      evidence.locationLabels.length > 0;
    const similar = hasEvidence
      ? await listSimilarJobs(
          database,
          evidence,
          [job.id, ...sameEmployer.map((item) => item.id)],
          RELATED_JOBS_SECTION_LIMIT,
        )
      : [];
    return { sameEmployer, similar };
  });
}

function relatedJobEvidence(job: JobDetailRow): RelatedJobEvidence {
  const labels = new Set<string>();
  for (const location of job.locations) {
    const label = [location.city, location.region, location.source_text]
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value))[0];
    if (label) labels.add(label.toLowerCase());
  }
  return {
    locationLabels: [...labels],
    opportunityType: job.opportunity_type !== "unknown" ? job.opportunity_type : null,
    sectorKey: job.sector_key,
    subsectorKey: job.subsector_key,
  };
}

export type { JobCardRow, JobDetailRow, JobLocationEvidence, JobSearchResult, SectorCountRow };
