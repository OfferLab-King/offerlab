import type { TransactionSql } from "postgres";
import type { JobCatalogFilters } from "../domain/catalog";
import {
  buildJobFilterClauses,
  type CatalogFacetGroup,
  JOB_CATALOG_PAGE_SIZE,
} from "../domain/catalog";

export const PUBLIC_JOB_VISIBILITY = `j.publication_status = 'published'
  and j.eligibility_status = 'eligible'
  and j.active`;

export type JobCardRow = Readonly<{
  application_deadline: Date | null;
  application_url: string;
  career_level_key: string | null;
  company_has_sponsor: boolean;
  company_logo_url: string | null;
  company_name: string;
  company_slug: string;
  description_summary: string | null;
  employer_industry_key: string | null;
  employment_type: string | null;
  first_seen_at: Date;
  id: string;
  job_function_key: string | null;
  last_successful_check_at: Date | null;
  location_text: string | null;
  normalized_title: string | null;
  opportunity_type: string;
  posted_at: Date | null;
  remote_type: string | null;
  salary_currency: string | null;
  salary_max: number | null;
  salary_min: number | null;
  salary_period: string | null;
  sector_key: string | null;
  skills: readonly string[];
  slug: string;
  subsector_key: string | null;
  title: string;
  visa_sponsorship_status: string;
  [key: string]: unknown;
}>;

export type JobSearchResult = Readonly<{
  items: readonly JobCardRow[];
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
}>;

export type JobLocationEvidence = Readonly<{
  city: string | null;
  country: string | null;
  hybrid: boolean;
  on_site: boolean;
  region: string | null;
  remote: boolean;
  source_text: string;
}>;

export type JobDetailRow = Readonly<{
  active: boolean;
  application_deadline: Date | null;
  application_url: string;
  career_level_key: string | null;
  classification_source: string;
  classification_version: number;
  company_careers_url: string;
  company_employee_band: string | null;
  company_has_sponsor: boolean;
  company_id: string;
  company_logo_url: string | null;
  company_name: string;
  company_ownership_type: string | null;
  company_slug: string;
  company_sponsor_snapshot_date: Date | null;
  company_website_url: string | null;
  degree_requirements: readonly string[];
  description_summary: string | null;
  eligibility_evidence: string | null;
  eligibility_reasons: readonly string[];
  eligibility_status: string;
  employer_industry_key: string | null;
  employment_type: string | null;
  enrichment_model: string | null;
  enrichment_version: number | null;
  experience_requirements: string | null;
  external_job_id: string | null;
  first_seen_at: Date;
  id: string;
  job_function_key: string | null;
  job_subfunction_key: string | null;
  last_changed_at: Date;
  last_seen_at: Date;
  last_successful_check_at: Date | null;
  location_text: string | null;
  locations: readonly JobLocationEvidence[];
  normalized_title: string | null;
  opportunity_type: string;
  posted_at: Date | null;
  preferred_skills: readonly string[];
  publication_status: string;
  remote_type: string | null;
  requirements: readonly string[];
  responsibilities: readonly string[];
  salary_currency: string | null;
  salary_max: number | null;
  salary_min: number | null;
  salary_period: string | null;
  sector_key: string | null;
  seniority_level: string | null;
  skills: readonly string[];
  slug: string;
  source_url: string | null;
  subsector_key: string | null;
  title: string;
  updated_at: Date;
  visa_sponsorship_evidence: string | null;
  visa_sponsorship_status: string;
}>;

const jobDetailColumns = `
  j.id, j.slug, j.title, j.normalized_title, j.location_text, j.posted_at,
  j.first_seen_at, j.last_seen_at, j.last_changed_at, j.application_deadline,
  j.employment_type, j.remote_type, j.seniority_level, j.opportunity_type,
  j.sector_key, j.subsector_key, j.job_function_key, j.job_subfunction_key,
  j.career_level_key,
  j.eligibility_status, j.eligibility_reasons, j.eligibility_evidence,
  j.publication_status, j.classification_source, j.classification_version,
  j.visa_sponsorship_status, j.visa_sponsorship_evidence, j.description_summary,
  j.responsibilities, j.requirements, j.skills, j.preferred_skills,
  j.degree_requirements, j.experience_requirements,
  j.salary_min, j.salary_max, j.salary_currency, j.salary_period,
  j.application_url, j.source_url, j.external_job_id, j.active, j.created_at,
  j.updated_at, j.enrichment_model, j.enrichment_version,
  c.id as company_id, c.name as company_name, c.slug as company_slug,
  c.careers_url as company_careers_url, c.website_url as company_website_url,
  c.logo_url as company_logo_url, c.employer_industry_key, c.last_successful_check_at,
  coalesce(p.has_sponsor, false) as company_has_sponsor,
  p.employee_band as company_employee_band,
  p.ownership_type as company_ownership_type,
  p.sponsor_snapshot_date as company_sponsor_snapshot_date,
  coalesce(
    (select jsonb_agg(
       jsonb_build_object(
         'city', jl.city, 'region', jl.region, 'country', jl.country,
         'source_text', jl.source_text, 'remote', jl.remote,
         'hybrid', jl.hybrid, 'on_site', jl.on_site
       ) order by jl.position, jl.id
     )
     from app.job_location jl
     where jl.job_id = j.id),
    '[]'::jsonb
  ) as locations`;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export async function findJobDetail(
  database: TransactionSql,
  slugOrId: string,
): Promise<JobDetailRow | null> {
  const isUuid = uuidPattern.test(slugOrId);
  const rows = await database<JobDetailRow[]>`
    select ${database.unsafe(jobDetailColumns)}
    from app.job j
    join app.company c on c.id = j.company_id
    left join app.employer_public_profile p on p.id = c.id
    where j.slug = ${slugOrId}
      ${isUuid ? database`or j.id = ${slugOrId}::uuid` : database``}
    limit 1
  `;
  return rows[0] ?? null;
}

export async function findJobsByIds(
  database: TransactionSql,
  ids: readonly string[],
): Promise<JobDetailRow[]> {
  if (ids.length === 0) return [];
  return database<JobDetailRow[]>`
    select ${database.unsafe(jobDetailColumns)}
    from app.job j
    join app.company c on c.id = j.company_id
    left join app.employer_public_profile p on p.id = c.id
    where j.id = any(${ids}::uuid[])
  `;
}

/**
 * SQL mirror of `isJobIndexable` in `domain/job-indexability.ts`: only
 * publicly visible roles with an official application URL and sufficient
 * stored factual value are included. The domain predicate applies `now` as a
 * JavaScript clock; here the database clock (`now()`) plays the same role.
 * Parity is covered by `tests/integration/job-detail-seo.test.ts`.
 */
export async function listCatalogJobsForSitemap(
  database: TransactionSql,
  limit: number,
): Promise<readonly { slug: string; last_changed_at: Date }[]> {
  return database<{ slug: string; last_changed_at: Date }[]>`
    select slug, last_changed_at
    from app.job
    where active
      and publication_status = 'published'
      and eligibility_status = 'eligible'
      and (application_deadline is null or application_deadline >= now())
      and application_url is not null
      and posted_at is not null
      and (
        nullif(btrim(description_summary), '') is not null
        or jsonb_array_length(responsibilities) > 0
        or jsonb_array_length(requirements) > 0
        or nullif(btrim(experience_requirements), '') is not null
      )
    order by last_changed_at desc
    limit ${limit}
  `;
}

export type SectorCountRow = Readonly<{
  sector_key: string;
  subsector_key: string | null;
  count: number;
}>;

export async function sectorJobCounts(database: TransactionSql): Promise<SectorCountRow[]> {
  return database<SectorCountRow[]>`
    select s.sector_key, j.subsector_key, count(*)::int as count
    from app.job_sector s
    left join app.job j on j.sector_key = s.sector_key
      and j.active and j.publication_status = 'published' and j.eligibility_status = 'eligible'
    group by s.sector_key, j.subsector_key
    order by s.position asc, j.subsector_key asc
  `;
}

export type LocationFilterOption = Readonly<{ city: string | null; region: string | null }>;

// ============ Faceted catalogue search ============

const DEADLINE_NOT_PASSED = `(j.application_deadline is null or j.application_deadline >= now())`;

export type FacetCountRow = Readonly<{
  value: string;
  label: string | null;
  logo_url: string | null;
  count: number;
}>;

export async function searchJobsFaceted(
  database: TransactionSql,
  filters: JobCatalogFilters,
): Promise<
  Readonly<{
    result: JobSearchResult;
    facets: Record<CatalogFacetGroup, readonly FacetCountRow[]>;
    hasSalaryData: boolean;
  }>
> {
  const pageSize = JOB_CATALOG_PAGE_SIZE;
  const offset = (filters.page - 1) * pageSize;
  const now = new Date();
  const build = (excludeFacet?: CatalogFacetGroup) => {
    const { conditions, values } = buildJobFilterClauses(filters, now, {
      ...(excludeFacet ? { excludeFacet } : {}),
    });
    return {
      values,
      where:
        conditions.length > 0
          ? `${PUBLIC_JOB_VISIBILITY} and ${DEADLINE_NOT_PASSED} and ${conditions.join(" and ")}`
          : `${PUBLIC_JOB_VISIBILITY} and ${DEADLINE_NOT_PASSED}`,
    };
  };

  const base = build();
  let rankingParam = "";
  const orderingValues: unknown[] = [];
  if (filters.sort === "relevance" && filters.query) {
    rankingParam = `$${base.values.length + 1}`;
    orderingValues.push(filters.query);
  }
  const ordering =
    filters.sort === "closing"
      ? "j.application_deadline asc nulls last, j.posted_at desc nulls last, j.id"
      : filters.sort === "salary"
        ? "j.salary_max desc nulls last, j.posted_at desc nulls last, j.id"
        : filters.sort === "relevance" && filters.query
          ? `ts_rank(j.search_vector, websearch_to_tsquery('english', ${rankingParam})) desc, j.posted_at desc nulls last, j.id`
          : "j.posted_at desc nulls last, j.first_seen_at desc, j.id";

  const pageValues = [...base.values, ...orderingValues, pageSize, offset];
  const rows = await database.unsafe<JobCardRow[]>(
    `select j.id, j.slug, j.title, j.normalized_title, j.location_text, j.posted_at,
       j.first_seen_at, j.application_deadline, j.employment_type, j.remote_type,
       j.opportunity_type, j.sector_key, j.subsector_key, j.visa_sponsorship_status,
       j.job_function_key, j.career_level_key,
       j.description_summary, j.skills, j.application_url,
       j.salary_min, j.salary_max, j.salary_currency, j.salary_period,
       c.name as company_name, c.slug as company_slug, c.logo_url as company_logo_url,
       c.employer_industry_key, c.last_successful_check_at,
       coalesce(p.has_sponsor, false) as company_has_sponsor
     from app.job j
     join app.company c on c.id = j.company_id
     left join app.employer_public_profile p on p.id = c.id
     where ${base.where}
     order by ${ordering}
     limit $${pageValues.length - 1}
     offset $${pageValues.length}`,
    pageValues as never[],
  );

  const countRows = await database.unsafe<{ total: number }[]>(
    `select count(*)::int as total
     from app.job j
     join app.company c on c.id = j.company_id
     where ${base.where}`,
    base.values as never[],
  );
  const total = countRows[0]?.total ?? 0;

  const facets: Record<CatalogFacetGroup, readonly FacetCountRow[]> = {
    sectors: [],
    subsectors: [],
    industries: [],
    functions: [],
    levels: [],
    employers: [],
    locations: [],
    workModes: [],
    jobTypes: [],
    sponsorship: [],
    sponsorLicence: [],
  };

  const sectorBase = build("sectors");
  facets.sectors = await database.unsafe<FacetCountRow[]>(
    `select j.sector_key as value, null::text as label, null::text as logo_url, count(*)::int as count
     from app.job j
     join app.company c on c.id = j.company_id
     where ${sectorBase.where} and j.sector_key is not null
     group by j.sector_key
     order by count(*) desc, j.sector_key asc`,
    sectorBase.values as never[],
  );

  const subsectorBase = build("subsectors");
  facets.subsectors = await database.unsafe<FacetCountRow[]>(
    `select j.subsector_key as value, null::text as label, null::text as logo_url, count(*)::int as count
     from app.job j
     join app.company c on c.id = j.company_id
     where ${subsectorBase.where} and j.subsector_key is not null
     group by j.subsector_key
     order by count(*) desc, j.subsector_key asc`,
    subsectorBase.values as never[],
  );

  const employerBase = build("employers");
  facets.employers = await database.unsafe<FacetCountRow[]>(
    `select c.slug as value, c.name as label, c.logo_url, count(*)::int as count
     from app.job j
     join app.company c on c.id = j.company_id
     where ${employerBase.where}
     group by c.slug, c.name, c.logo_url
     order by count(*) desc, c.name asc
     limit 100`,
    employerBase.values as never[],
  );

  const jobTypeBase = build("jobTypes");
  facets.jobTypes = await database.unsafe<FacetCountRow[]>(
    `select j.opportunity_type as value, null::text as label, null::text as logo_url, count(*)::int as count
     from app.job j
     join app.company c on c.id = j.company_id
     where ${jobTypeBase.where} and j.opportunity_type <> 'unknown'
     group by j.opportunity_type
     order by count(*) desc, j.opportunity_type asc`,
    jobTypeBase.values as never[],
  );

  const sponsorshipBase = build("sponsorship");
  facets.sponsorship = await database.unsafe<FacetCountRow[]>(
    `select j.visa_sponsorship_status as value, null::text as label, null::text as logo_url, count(*)::int as count
     from app.job j
     join app.company c on c.id = j.company_id
     where ${sponsorshipBase.where} and j.visa_sponsorship_status in ('confirmed','likely')
     group by j.visa_sponsorship_status
     order by count(*) desc, j.visa_sponsorship_status asc`,
    sponsorshipBase.values as never[],
  );

  const industryBase = build("industries");
  facets.industries = await database.unsafe<FacetCountRow[]>(
    `select c.employer_industry_key as value, i.display_name as label, null::text as logo_url, count(*)::int as count
     from app.job j
     join app.company c on c.id = j.company_id
     join app.employer_industry i on i.industry_key = c.employer_industry_key
     where ${industryBase.where} and c.employer_industry_key is not null
     group by c.employer_industry_key, i.display_name
     order by count(*) desc, c.employer_industry_key asc`,
    industryBase.values as never[],
  );

  const functionBase = build("functions");
  facets.functions = await database.unsafe<FacetCountRow[]>(
    `select j.job_function_key as value, f.display_name as label, null::text as logo_url, count(*)::int as count
     from app.job j
     join app.company c on c.id = j.company_id
     join app.job_function f on f.function_key = j.job_function_key
     where ${functionBase.where} and j.job_function_key is not null
     group by j.job_function_key, f.display_name
     order by count(*) desc, j.job_function_key asc`,
    functionBase.values as never[],
  );

  const levelBase = build("levels");
  facets.levels = await database.unsafe<FacetCountRow[]>(
    `select j.career_level_key as value, l.display_name as label, null::text as logo_url, count(*)::int as count
     from app.job j
     join app.company c on c.id = j.company_id
     join app.job_career_level l on l.level_key = j.career_level_key
     where ${levelBase.where} and j.career_level_key is not null
     group by j.career_level_key, l.display_name
     order by count(*) desc, j.career_level_key asc`,
    levelBase.values as never[],
  );

  const workModeBase = build("workModes");
  facets.workModes = await database.unsafe<FacetCountRow[]>(
    `select j.remote_type as value, null::text as label, null::text as logo_url, count(*)::int as count
     from app.job j
     join app.company c on c.id = j.company_id
     where ${workModeBase.where} and j.remote_type in ('remote','hybrid','on_site')
     group by j.remote_type
     order by count desc, j.remote_type asc`,
    workModeBase.values as never[],
  );

  const sponsorLicenceBase = build("sponsorLicence");
  facets.sponsorLicence = await database.unsafe<FacetCountRow[]>(
    `select '1'::text as value, 'Employer is a UK licensed sponsor'::text as label, null::text as logo_url, count(*)::int as count
     from app.job j
     join app.company c on c.id = j.company_id
     where ${sponsorLicenceBase.where}
       and exists (
         select 1 from app.employer_public_profile p
         where p.id = c.id and p.has_sponsor
       )`,
    sponsorLicenceBase.values as never[],
  );

  const locationBase = build("locations");
  const cityRows = await database.unsafe<FacetCountRow[]>(
    `select lower(coalesce(nullif(btrim(jl.city), ''), nullif(btrim(jl.region), ''), nullif(btrim(jl.source_text), ''))) as value,
            null::text as label, null::text as logo_url,
            count(distinct j.id)::int as count
     from app.job j
     join app.company c on c.id = j.company_id
     join app.job_location jl on jl.job_id = j.id
     where ${locationBase.where}
       and (jl.city is not null or jl.region is not null or jl.source_text <> '')
     group by value
     order by count desc, value asc
     limit 100`,
    locationBase.values as never[],
  );
  facets.locations = cityRows;

  const salaryRows = await database.unsafe<{ has: boolean }[]>(
    `select count(*) filter (where j.salary_min is not null or j.salary_max is not null) > 0 as has
     from app.job j
     join app.company c on c.id = j.company_id
     where ${base.where}`,
    base.values as never[],
  );
  const hasSalaryData = salaryRows[0]?.has ?? false;

  return {
    facets,
    hasSalaryData,
    result: {
      items: rows,
      page: filters.page,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
      pageSize,
      total,
    },
  };
}

// ============ Employer directory ============

export type EmployerDirectoryRow = Readonly<{
  active_count: number;
  company_name: string;
  company_slug: string;
  industry: string | null;
  logo_url: string | null;
  priority_rank: number | null;
  sector_key: string | null;
}>;

export async function listEmployerDirectory(
  database: TransactionSql,
): Promise<EmployerDirectoryRow[]> {
  return database<EmployerDirectoryRow[]>`
    with current_jobs as (
      select j.company_id, j.sector_key, count(*)::int as active_count
      from app.job j
      where j.active
        and j.publication_status = 'published'
        and j.eligibility_status = 'eligible'
        and (j.application_deadline is null or j.application_deadline >= now())
      group by j.company_id, j.sector_key
    ), directory_rows as (
      select cj.sector_key, c.slug as company_slug, c.name as company_name,
        c.industry, c.logo_url, c.directory_priority_rank as priority_rank,
        cj.active_count
      from current_jobs cj
      join app.company c on c.id = cj.company_id
      where c.active

      union all

      select c.directory_sector_key as sector_key, c.slug as company_slug,
        c.name as company_name, c.industry, c.logo_url,
        c.directory_priority_rank as priority_rank, 0::int as active_count
      from app.company c
      where c.active and c.directory_visible
        and not exists (
          select 1 from current_jobs cj where cj.company_id = c.id
        )
    )
    select sector_key, company_slug, company_name, industry, logo_url,
      priority_rank, active_count
    from directory_rows
    order by sector_key nulls last,
      (priority_rank is null), priority_rank, active_count desc, company_name asc
  `;
}

export type EmployerPublicProfileRow = Readonly<{
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

export async function listEmployerPublicDirectory(
  database: TransactionSql,
): Promise<EmployerPublicProfileRow[]> {
  return database<EmployerPublicProfileRow[]>`
    select id, slug, name, logo_url, description, directory_visible,
      website_url, careers_url, employer_industry_key, employer_subindustry_key,
      employee_band, employee_scope, ownership_type, ticker, exchange,
      facts_as_of, has_sponsor, sponsor_snapshot_date, current_jobs, live_sources
    from app.employer_public_profile
  `;
}

export async function findEmployerPublicProfile(
  database: TransactionSql,
  slug: string,
): Promise<EmployerPublicProfileRow | null> {
  const rows = await database<EmployerPublicProfileRow[]>`
    select id, slug, name, logo_url, description, directory_visible,
      website_url, careers_url, employer_industry_key, employer_subindustry_key,
      employee_band, employee_scope, ownership_type, ticker, exchange,
      facts_as_of, has_sponsor, sponsor_snapshot_date, current_jobs, live_sources
    from app.employer_public_profile
    where slug = ${slug}
    limit 1
  `;
  return rows[0] ?? null;
}

export type EmployerProfileRow = Readonly<{
  active: boolean;
  active_jobs: number;
  ats_provider: string | null;
  careers_url: string | null;
  description: string | null;
  has_imported_jobs: boolean;
  id: string;
  industry: string | null;
  imported_jobs: number;
  logo_url: string | null;
  name: string;
  slug: string;
  website_url: string | null;
}>;

export async function findEmployerProfile(
  database: TransactionSql,
  slug: string,
): Promise<EmployerProfileRow | null> {
  const rows = await database<EmployerProfileRow[]>`
    select c.id, c.name, c.slug, c.active, c.website_url, c.careers_url, c.logo_url,
      c.industry, c.ats_provider, c.description,
      exists (
        select 1 from app.job imported where imported.company_id = c.id
      ) as has_imported_jobs,
      count(j.id)::int as imported_jobs,
      count(j.id) filter (
        where j.active and j.publication_status = 'published'
          and j.eligibility_status = 'eligible'
          and (j.application_deadline is null or j.application_deadline >= now())
      )::int as active_jobs
    from app.company c
    left join app.job j on j.company_id = c.id
    where c.slug = ${slug}
    group by c.id, c.name, c.slug, c.active, c.website_url, c.careers_url, c.logo_url,
      c.industry, c.ats_provider, c.description, has_imported_jobs
    limit 1
  `;
  return rows[0] ?? null;
}

export type EmployerSitemapRow = Readonly<{
  last_modified: Date;
  slug: string;
}>;

/**
 * Stable /employers/[slug] URLs for every profile that satisfies the employer
 * indexability policy. last_modified is the most recent truthful change to the
 * profile content: the company record's own update time or the latest change
 * to any of its job content, whichever is newer.
 */
export async function listIndexableEmployersForSitemap(
  database: TransactionSql,
  limit: number,
): Promise<EmployerSitemapRow[]> {
  return database<EmployerSitemapRow[]>`
    select p.slug,
      greatest(c.updated_at, coalesce(max(j.last_changed_at), c.updated_at)) as last_modified
    from app.employer_public_profile p
    join app.company c on c.id = p.id
    left join app.job j on j.company_id = c.id
    where c.active
      and (
        (c.description is not null and c.description <> '')
        or (
          j.id is not null
          and (p.website_url is not null or p.careers_url is not null)
        )
        or (
          p.employer_industry_key is not null
          and (p.employee_band is not null or p.ownership_type is not null or p.has_sponsor)
          and (p.website_url is not null or p.careers_url is not null)
        )
      )
    group by p.id, p.slug, c.id
    order by last_modified desc
    limit ${limit}
  `;
}

export async function listCompanyActiveJobs(
  database: TransactionSql,
  companyId: string,
  limit: number,
): Promise<JobCardRow[]> {
  return database<JobCardRow[]>`
    select ${database.unsafe(jobCardColumns)}
    from app.job j
    join app.company c on c.id = j.company_id
    left join app.employer_public_profile p on p.id = c.id
    where j.company_id = ${companyId}::uuid
      and j.active and j.publication_status = 'published'
      and j.eligibility_status = 'eligible'
      and (j.application_deadline is null or j.application_deadline >= now())
    order by j.posted_at desc nulls last, j.first_seen_at desc
    limit ${limit}
  `;
}

// ============ Related roles ============

const jobCardColumns = `j.id, j.slug, j.title, j.normalized_title, j.location_text, j.posted_at,
  j.first_seen_at, j.application_deadline, j.employment_type, j.remote_type,
  j.opportunity_type, j.sector_key, j.subsector_key, j.visa_sponsorship_status,
  j.job_function_key, j.career_level_key,
  j.description_summary, j.skills, j.application_url,
  j.salary_min, j.salary_max, j.salary_currency, j.salary_period,
  c.name as company_name, c.slug as company_slug, c.logo_url as company_logo_url,
  c.employer_industry_key, c.last_successful_check_at,
  coalesce(p.has_sponsor, false) as company_has_sponsor`;

/** Deterministic ordering shared by every related-role query. */
const relatedRoleOrder = `j.posted_at desc nulls last, j.first_seen_at desc, j.id`;

/** Same-employer current roles, excluding the role being viewed. */
export async function listRelatedEmployerJobs(
  database: TransactionSql,
  companyId: string,
  excludeJobId: string,
  limit: number,
): Promise<JobCardRow[]> {
  return database<JobCardRow[]>`
    select ${database.unsafe(jobCardColumns)}
    from app.job j
    join app.company c on c.id = j.company_id
    left join app.employer_public_profile p on p.id = c.id
    where j.company_id = ${companyId}::uuid
      and j.id <> ${excludeJobId}::uuid
      and j.active and j.publication_status = 'published'
      and j.eligibility_status = 'eligible'
      and (j.application_deadline is null or j.application_deadline >= now())
    order by ${database.unsafe(relatedRoleOrder)}
    limit ${limit}
  `;
}

export type RelatedJobEvidence = Readonly<{
  locationLabels: readonly string[];
  opportunityType: string | null;
  sectorKey: string | null;
  subsectorKey: string | null;
}>;

/**
 * Current roles similar to the role being viewed, matched on any stored
 * evidence that overlaps (subsector, sector, opportunity type or location).
 * Never returns non-public or expired roles and never returns the excluded
 * ids, so related sections cannot duplicate each other.
 */
export async function listSimilarJobs(
  database: TransactionSql,
  evidence: RelatedJobEvidence,
  excludeJobIds: readonly string[],
  limit: number,
): Promise<JobCardRow[]> {
  const conditions: string[] = [
    `j.active`,
    `j.publication_status = 'published'`,
    `j.eligibility_status = 'eligible'`,
    `(j.application_deadline is null or j.application_deadline >= now())`,
  ];
  const values: unknown[] = [];
  const parameter = (value: unknown): string => {
    values.push(value);
    return `$${values.length}`;
  };
  if (excludeJobIds.length > 0) {
    // Note: `<> any(array)` is true for any value not equal to *every*
    // element's complement semantics; exclusion requires `<> all` (or
    // `not (id = any(...))`).
    conditions.push(`j.id <> all(${parameter(excludeJobIds)}::uuid[])`);
  }
  const similarity: string[] = [];
  if (evidence.subsectorKey !== null) {
    similarity.push(`j.subsector_key = ${parameter(evidence.subsectorKey)}`);
  }
  if (evidence.sectorKey !== null) {
    similarity.push(`j.sector_key = ${parameter(evidence.sectorKey)}`);
  }
  if (evidence.opportunityType !== null) {
    similarity.push(`j.opportunity_type = ${parameter(evidence.opportunityType)}`);
  }
  if (evidence.locationLabels.length > 0) {
    similarity.push(
      `exists (
        select 1 from app.job_location jl
        where jl.job_id = j.id
          and lower(coalesce(nullif(btrim(jl.city), ''), nullif(btrim(jl.region), ''), nullif(btrim(jl.source_text), ''))) = any(${parameter(evidence.locationLabels)})
      )`,
    );
  }
  if (similarity.length === 0) return [];
  conditions.push(`(${similarity.join(" or ")})`);
  values.push(limit);
  return database.unsafe<JobCardRow[]>(
    `select ${jobCardColumns}
     from app.job j
     join app.company c on c.id = j.company_id
     left join app.employer_public_profile p on p.id = c.id
     where ${conditions.join(" and ")}
     order by ${relatedRoleOrder}
     limit $${values.length}`,
    values as never[],
  );
}
