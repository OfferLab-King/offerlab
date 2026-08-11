import { withApplicationRole } from "../../../infrastructure/database/runtime-connections";
import {
  jobSectorLabel,
  jobSubsectorLabel,
  opportunityTypeLabels,
  visaSponsorshipLabels,
} from "../domain/taxonomy";
import type { JobCatalogFilters } from "../domain/catalog";
import {
  findEmployerProfile,
  findJobDetail,
  findJobsByIds,
  listCatalogJobsForSitemap,
  listCompanyActiveJobs,
  listEmployerDirectory,
  sectorJobCounts,
  searchJobsFaceted,
  type EmployerDirectoryRow,
  type EmployerProfileRow,
  type FacetCountRow,
  type JobCardRow,
  type JobDetailRow,
  type JobSearchResult,
  type SectorCountRow,
} from "../infrastructure/catalog-repository";

export type FacetedSearchPayload = Readonly<{
  facets: Readonly<{
    employers: readonly FacetOptionView[];
    jobTypes: readonly FacetOptionView[];
    locations: readonly FacetOptionView[];
    sectors: readonly FacetOptionView[];
    sponsorship: readonly FacetOptionView[];
    subsectors: readonly FacetOptionView[];
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
      jobTypes: presentWithTaxonomy(
        facets.jobTypes,
        (key) => opportunityTypeLabels[key as keyof typeof opportunityTypeLabels] ?? null,
      ),
      locations: presentLocations(facets.locations),
      sectors: presentWithTaxonomy(facets.sectors, (key) => jobSectorLabel(key)),
      sponsorship: presentWithTaxonomy(
        facets.sponsorship,
        (key) => visaSponsorshipLabels[key as keyof typeof visaSponsorshipLabels] ?? null,
      ),
      subsectors: presentWithTaxonomy(facets.subsectors, (key) => jobSubsectorLabel(key)),
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

export function readEmployerDirectory(): Promise<EmployerDirectoryRow[]> {
  return withApplicationRole((database) => listEmployerDirectory(database));
}

export function readEmployerProfile(slug: string): Promise<EmployerProfileRow | null> {
  return withApplicationRole((database) => findEmployerProfile(database, slug));
}

export function readEmployerActiveJobs(companyId: string): Promise<JobCardRow[]> {
  return withApplicationRole((database) => listCompanyActiveJobs(database, companyId, 50));
}

export type { JobCardRow, JobDetailRow, JobSearchResult, SectorCountRow };
