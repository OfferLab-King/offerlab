import type { TransactionSql } from "postgres";
import type { JobCatalogFilters } from "../domain/catalog";
import {
  buildJobFilterClauses,
  splitLocationSelections,
  type CatalogFacetGroup,
  JOB_CATALOG_PAGE_SIZE,
} from "../domain/catalog";
import { EMPLOYER_DIRECTORY_PAGE_SIZE } from "../domain/employer-directory";

/**
 * Safety invariant for `database.unsafe` usage in this file:
 * - Every dynamic fragment is either a constant string from this module or
 *   derived from `buildJobFilterClauses`, which only emits `$n` placeholders
 *   with separately bound `values`.
 * - User-controlled content (search query, slugs, locations) never appears as
 *   SQL text; it is always a bound parameter. This keeps the faceted search as
 *   a single prepared-statement-style round trip while preserving injection
 *   safety. Keep this invariant under review when adding facets or ordering.
 */

export const PUBLIC_JOB_VISIBILITY = `j.publication_status = 'published'
  and j.eligibility_status = 'eligible'
  and j.active`;

export type JobCardRow = Readonly<{
  application_deadline: Date | string | null;
  application_url: string;
  career_level_key: string | null;
  company_has_sponsor: boolean;
  company_logo_url: string | null;
  company_name: string;
  company_slug: string;
  description_summary: string | null;
  employer_industry_key: string | null;
  employment_type: string | null;
  first_seen_at: Date | string;
  id: string;
  job_function_key: string | null;
  last_successful_check_at: Date | string | null;
  location_text: string | null;
  normalized_title: string | null;
  opportunity_type: string;
  posted_at: Date | string | null;
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
  company_careers_url: string | null;
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
  coalesce(sp.has_sponsor, false) as company_has_sponsor,
  snap.employee_band as company_employee_band,
  snap.ownership_type as company_ownership_type,
  sp.sponsor_snapshot_date as company_sponsor_snapshot_date,
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

/** Latest research snapshot facts for one company (matches the view's
 *  `distinct on (company_id) order by research_date desc, dataset_version desc`). */
const latestSnapshotJoin = `left join lateral (
  select s.employee_band, s.ownership_type
  from app.employer_research_snapshot s
  where s.company_id = c.id
  order by s.research_date desc, s.dataset_version desc
  limit 1
) snap on true`;

/** Sponsor register facts for one company (matches the view's aggregation). */
const sponsorFactsJoin = `left join app.employer_public_sponsor sp on sp.company_id = c.id`;

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
    ${database.unsafe(latestSnapshotJoin)}
    ${database.unsafe(sponsorFactsJoin)}
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
    ${database.unsafe(latestSnapshotJoin)}
    ${database.unsafe(sponsorFactsJoin)}
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

type FacetedSearchRow = Readonly<{
  has_salary: boolean;
  items: unknown[] | null;
  total: number;
  sectors: readonly FacetCountRow[] | null;
  subsectors: readonly FacetCountRow[] | null;
  industries: readonly FacetCountRow[] | null;
  functions: readonly FacetCountRow[] | null;
  levels: readonly FacetCountRow[] | null;
  employers: readonly FacetCountRow[] | null;
  locations: readonly FacetCountRow[] | null;
  work_modes: readonly FacetCountRow[] | null;
  job_types: readonly FacetCountRow[] | null;
  sponsorship: readonly FacetCountRow[] | null;
  sponsor_licence: readonly FacetCountRow[] | null;
}>;

type FacetedPageRow = Readonly<{
  has_salary: boolean;
  items: unknown[] | null;
  total: number;
}>;

/**
 * Builds the single-statement faceted catalogue search. One round trip: a
 * shared `base` CTE is materialised once and the results, count, salary probe
 * and every disjunctive facet read it. Local `$n` placeholders are renumbered
 * to global statement positions in the order fragments are laid out.
 * `includeFacets: false` produces the lighter page-only statement used when
 * the facet state is served from the short-TTL facet cache.
 */
function buildFacetedSearchStatement(
  filters: JobCatalogFilters,
  now: Date,
  includeFacets: boolean,
): Readonly<{ sql: string; values: unknown[] }> {
  const pageSize = JOB_CATALOG_PAGE_SIZE;
  const offset = (filters.page - 1) * pageSize;

  type Fragment = Readonly<{ sql: string; values: readonly unknown[] }>;
  const buildFragment = (options: {
    excludeFacet?: CatalogFacetGroup;
    excludeAllFacets?: boolean;
    onlyFacets?: boolean;
  }): Fragment => {
    const { conditions, values } = buildJobFilterClauses(filters, now, {
      ...options,
      locationConditionRef: "b.loc_cond",
      sponsorConditionRef: "b.company_has_sponsor",
    });
    return { sql: conditions.join(" and "), values };
  };

  let orderingFragment: Fragment = {
    sql: "b.posted_at desc nulls last, b.first_seen_at desc, b.id",
    values: [],
  };
  if (filters.sort === "closing") {
    orderingFragment = {
      sql: "b.application_deadline asc nulls last, b.posted_at desc nulls last, b.id",
      values: [],
    };
  } else if (filters.sort === "salary") {
    orderingFragment = {
      sql: "b.salary_max desc nulls last, b.posted_at desc nulls last, b.id",
      values: [],
    };
  } else if (filters.sort === "relevance" && filters.query) {
    orderingFragment = {
      sql: "ts_rank(b.search_vector, websearch_to_tsquery('english', $1)) desc, b.posted_at desc nulls last, b.id",
      values: [filters.query],
    };
  }

  const statementValues: unknown[] = [];
  let paramOffset = 0;
  const collect = (fragment: Fragment): string => {
    const sql = fragment.sql.replace(
      /\$\d+/gu,
      (placeholder) => `$${Number(placeholder.slice(1)) + paramOffset}`,
    );
    paramOffset += fragment.values.length;
    statementValues.push(...fragment.values);
    return sql;
  };

  // When location labels are selected, the per-row EXISTS is evaluated once in
  // the base CTE (`loc_cond`) and every facet condition references that flag.
  const locationLabels = splitLocationSelections(filters.locations).labels;
  let locationCond = "";
  if (locationLabels.length > 0) {
    locationCond = collect({
      sql: `exists (
        select 1 from app.job_location jl
        where jl.job_id = j.id
          and lower(coalesce(nullif(btrim(jl.city), ''), nullif(btrim(jl.region), ''), nullif(btrim(jl.source_text), ''))) = any($1)
      )`,
      values: [locationLabels],
    });
  }

  const baseWhere = collect(buildFragment({ excludeAllFacets: true }));
  const filteredWhere = collect(buildFragment({}));
  // Base CTE is referenced inside a join with `b`; the WHERE fragments are
  // written in terms of `j`/`c`, so rewrite to the materialized base alias.
  const toBase = (sql: string): string =>
    sql
      .replace(/\bj\./gu, "b.")
      .replace(/\bc\.(id|slug|name|logo_url)\b/gu, (_, column: string) => `b.company_${column}`)
      .replace(/\bc\.(employer_industry_key|last_successful_check_at)\b/gu, "b.$1");
  const visibility = `${PUBLIC_JOB_VISIBILITY} and ${DEADLINE_NOT_PASSED}`;
  const baseVisibilityWhere = `${visibility}${baseWhere.length > 0 ? ` and ${baseWhere}` : ""}`;
  const baseFilteredWhere = filteredWhere.length > 0 ? toBase(filteredWhere) : "";

  // Disjunctive facet conditions (all other facets apply, the counted group is
  // excluded) evaluated against the materialized base CTE.
  let facetWhere: Record<CatalogFacetGroup, string> | undefined;
  if (includeFacets) {
    facetWhere = {
      sectors: toBase(collect(buildFragment({ excludeFacet: "sectors", onlyFacets: true }))),
      subsectors: toBase(collect(buildFragment({ excludeFacet: "subsectors", onlyFacets: true }))),
      industries: toBase(collect(buildFragment({ excludeFacet: "industries", onlyFacets: true }))),
      functions: toBase(collect(buildFragment({ excludeFacet: "functions", onlyFacets: true }))),
      levels: toBase(collect(buildFragment({ excludeFacet: "levels", onlyFacets: true }))),
      employers: toBase(collect(buildFragment({ excludeFacet: "employers", onlyFacets: true }))),
      locations: toBase(collect(buildFragment({ excludeFacet: "locations", onlyFacets: true }))),
      workModes: toBase(collect(buildFragment({ excludeFacet: "workModes", onlyFacets: true }))),
      jobTypes: toBase(collect(buildFragment({ excludeFacet: "jobTypes", onlyFacets: true }))),
      sponsorship: toBase(
        collect(buildFragment({ excludeFacet: "sponsorship", onlyFacets: true })),
      ),
      sponsorLicence: toBase(
        collect(buildFragment({ excludeFacet: "sponsorLicence", onlyFacets: true })),
      ),
    };
  }
  const orderingSql = collect(orderingFragment);
  statementValues.push(pageSize, offset);

  const facetClause = (facetWhere: string, extra: string): string => {
    const parts = [facetWhere, extra].filter((part) => part.length > 0);
    return parts.length > 0 ? `where ${parts.join(" and ")}` : "";
  };

  const cardColumns = `j.id, j.slug, j.title, j.normalized_title, j.location_text, j.posted_at,
       j.first_seen_at, j.application_deadline, j.employment_type, j.remote_type,
       j.opportunity_type, j.sector_key, j.subsector_key, j.visa_sponsorship_status,
       j.job_function_key, j.career_level_key,
       j.description_summary, j.skills, j.application_url,
       j.salary_min, j.salary_max, j.salary_currency, j.salary_period,
       c.name as company_name, c.slug as company_slug, c.logo_url as company_logo_url,
       c.employer_industry_key, c.last_successful_check_at,
       b.company_has_sponsor`;

  const facetSections = facetWhere
    ? `,
       (select coalesce(jsonb_agg(jsonb_build_object('value', f.value, 'label', f.label, 'logo_url', f.logo_url, 'count', f.count)), '[]'::jsonb)
        from (
          select b.sector_key as value, null::text as label, null::text as logo_url, count(*)::int as count
          from base b
          ${facetClause(facetWhere.sectors, "b.sector_key is not null")}
          group by b.sector_key
          order by count(*) desc, b.sector_key asc
        ) f) as sectors,
       (select coalesce(jsonb_agg(jsonb_build_object('value', f.value, 'label', f.label, 'logo_url', f.logo_url, 'count', f.count)), '[]'::jsonb)
        from (
          select b.subsector_key as value, null::text as label, null::text as logo_url, count(*)::int as count
          from base b
          ${facetClause(facetWhere.subsectors, "b.subsector_key is not null")}
          group by b.subsector_key
          order by count(*) desc, b.subsector_key asc
        ) f) as subsectors,
       (select coalesce(jsonb_agg(jsonb_build_object('value', f.value, 'label', f.label, 'logo_url', f.logo_url, 'count', f.count)), '[]'::jsonb)
        from (
          select b.employer_industry_key as value, i.display_name as label, null::text as logo_url, count(*)::int as count
          from base b
          join app.employer_industry i on i.industry_key = b.employer_industry_key
          ${facetClause(facetWhere.industries, "b.employer_industry_key is not null")}
          group by b.employer_industry_key, i.display_name
          order by count(*) desc, b.employer_industry_key asc
        ) f) as industries,
       (select coalesce(jsonb_agg(jsonb_build_object('value', f.value, 'label', f.label, 'logo_url', f.logo_url, 'count', f.count)), '[]'::jsonb)
        from (
          select b.job_function_key as value, fn.display_name as label, null::text as logo_url, count(*)::int as count
          from base b
          join app.job_function fn on fn.function_key = b.job_function_key
          ${facetClause(facetWhere.functions, "b.job_function_key is not null")}
          group by b.job_function_key, fn.display_name
          order by count(*) desc, b.job_function_key asc
        ) f) as functions,
       (select coalesce(jsonb_agg(jsonb_build_object('value', f.value, 'label', f.label, 'logo_url', f.logo_url, 'count', f.count)), '[]'::jsonb)
        from (
          select b.career_level_key as value, l.display_name as label, null::text as logo_url, count(*)::int as count
          from base b
          join app.job_career_level l on l.level_key = b.career_level_key
          ${facetClause(facetWhere.levels, "b.career_level_key is not null")}
          group by b.career_level_key, l.display_name
          order by count(*) desc, b.career_level_key asc
        ) f) as levels,
       (select coalesce(jsonb_agg(jsonb_build_object('value', f.value, 'label', f.label, 'logo_url', f.logo_url, 'count', f.count)), '[]'::jsonb)
        from (
          select e.company_slug as value, c.name as label, c.logo_url as logo_url, e.count
          from (
            select b.company_slug, count(*)::int as count
            from base b
            ${facetClause(facetWhere.employers, "")}
            group by b.company_slug
            order by count(*) desc, b.company_slug asc
            limit 100
          ) e
          join app.company c on c.slug = e.company_slug
          order by e.count desc, c.name asc
        ) f) as employers,
       (select coalesce(jsonb_agg(jsonb_build_object('value', f.value, 'label', f.label, 'logo_url', f.logo_url, 'count', f.count)), '[]'::jsonb)
        from (
          select lower(coalesce(nullif(btrim(jl.city), ''), nullif(btrim(jl.region), ''), nullif(btrim(jl.source_text), ''))) as value,
            null::text as label, null::text as logo_url, count(distinct b.id)::int as count
          from base b
          join app.job_location jl on jl.job_id = b.id
          ${facetClause(facetWhere.locations, "jl.city is not null or jl.region is not null or jl.source_text <> ''")}
          group by value
          order by count desc, value asc
          limit 100
        ) f) as locations,
       (select coalesce(jsonb_agg(jsonb_build_object('value', f.value, 'label', f.label, 'logo_url', f.logo_url, 'count', f.count)), '[]'::jsonb)
        from (
          select b.remote_type as value, null::text as label, null::text as logo_url, count(*)::int as count
          from base b
          ${facetClause(facetWhere.workModes, "b.remote_type in ('remote','hybrid','on_site')")}
          group by b.remote_type
          order by count desc, b.remote_type asc
        ) f) as work_modes,
       (select coalesce(jsonb_agg(jsonb_build_object('value', f.value, 'label', f.label, 'logo_url', f.logo_url, 'count', f.count)), '[]'::jsonb)
        from (
          select b.opportunity_type as value, null::text as label, null::text as logo_url, count(*)::int as count
          from base b
          ${facetClause(facetWhere.jobTypes, "b.opportunity_type <> 'unknown'")}
          group by b.opportunity_type
          order by count(*) desc, b.opportunity_type asc
        ) f) as job_types,
       (select coalesce(jsonb_agg(jsonb_build_object('value', f.value, 'label', f.label, 'logo_url', f.logo_url, 'count', f.count)), '[]'::jsonb)
        from (
          select b.visa_sponsorship_status as value, null::text as label, null::text as logo_url, count(*)::int as count
          from base b
          ${facetClause(facetWhere.sponsorship, "b.visa_sponsorship_status in ('confirmed','likely')")}
          group by b.visa_sponsorship_status
          order by count(*) desc, b.visa_sponsorship_status asc
        ) f) as sponsorship,
       (select coalesce(jsonb_agg(jsonb_build_object('value', f.value, 'label', f.label, 'logo_url', f.logo_url, 'count', f.count)), '[]'::jsonb)
        from (
          select '1'::text as value, 'Employer is a UK licensed sponsor'::text as label, null::text as logo_url, count(*)::int as count
          from base b
          ${facetClause(facetWhere.sponsorLicence, "b.company_has_sponsor")}
        ) f) as sponsor_licence`
    : "";

  return {
    sql: `with base as (
       select j.id, j.posted_at, j.first_seen_at, j.application_deadline,
         j.salary_min, j.salary_max,
         ${filters.query ? "j.search_vector," : ""} j.sector_key, j.subsector_key, j.opportunity_type,
         j.visa_sponsorship_status, j.remote_type, j.job_function_key, j.career_level_key,
         c.id as company_id, c.slug as company_slug,
         c.employer_industry_key, c.last_successful_check_at,
         exists (
           select 1 from app.employer_public_sponsor s
           where s.company_id = c.id and s.has_sponsor
         ) as company_has_sponsor${locationCond.length > 0 ? `,\n         ${locationCond} as loc_cond` : ""}
       from app.job j
       join app.company c on c.id = j.company_id
       where ${baseVisibilityWhere}
     ),
     filtered as (
       select b.* from base b ${baseFilteredWhere.length > 0 ? `where ${baseFilteredWhere}` : ""}
     )
     select
       (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
        from (
          select ${cardColumns}
          from (
            select b.* from filtered b
            order by ${orderingSql}
            limit $${statementValues.length - 1}
            offset $${statementValues.length}
          ) b
          join app.job j on j.id = b.id
          join app.company c on c.id = j.company_id
        ) r) as items,
       (select count(*)::int from filtered) as total,
       (select bool_or(b.salary_min is not null or b.salary_max is not null) from filtered b) as has_salary${facetSections}`,
    values: statementValues,
  };
}

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
  const { sql, values } = buildFacetedSearchStatement(filters, new Date(), true);
  const rows = await database.unsafe<FacetedSearchRow[]>(sql, values as never[]);
  const row = rows[0];
  const total = row?.total ?? 0;
  const facets: Record<CatalogFacetGroup, readonly FacetCountRow[]> = {
    sectors: row?.sectors ?? [],
    subsectors: row?.subsectors ?? [],
    industries: row?.industries ?? [],
    functions: row?.functions ?? [],
    levels: row?.levels ?? [],
    employers: row?.employers ?? [],
    locations: row?.locations ?? [],
    workModes: row?.work_modes ?? [],
    jobTypes: row?.job_types ?? [],
    sponsorship: row?.sponsorship ?? [],
    sponsorLicence: row?.sponsor_licence ?? [],
  };

  return {
    facets,
    hasSalaryData: row?.has_salary ?? false,
    result: {
      items: (row?.items ?? []) as JobCardRow[],
      page: filters.page,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
      pageSize,
      total,
    },
  };
}

/**
 * Page-only variant (results, count, salary probe; no facet aggregation) for
 * the cached-facet fast path. The facet state is request-independent when no
 * keyword or facet filters are active, so it is served from the short-TTL
 * cache while the page rows themselves always come from the database.
 */
export async function searchJobsPage(
  database: TransactionSql,
  filters: JobCatalogFilters,
): Promise<
  Readonly<{
    result: JobSearchResult;
    hasSalaryData: boolean;
  }>
> {
  const pageSize = JOB_CATALOG_PAGE_SIZE;
  const { sql, values } = buildFacetedSearchStatement(filters, new Date(), false);
  const rows = await database.unsafe<FacetedPageRow[]>(sql, values as never[]);
  const row = rows[0];
  const total = row?.total ?? 0;
  return {
    hasSalaryData: row?.has_salary ?? false,
    result: {
      items: (row?.items ?? []) as JobCardRow[],
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

export type EmployerDirectoryQuery = Readonly<{
  query: string | null;
  industry: string | null;
  sponsor: boolean;
  hiring: boolean;
  sizeBand: string | null;
  ownership: string | null;
  sort: "hiring" | "roles" | "az";
  page: number;
}>;

export type EmployerDirectoryPageResult = Readonly<{
  hiringTotal: number;
  rows: readonly EmployerPublicProfileRow[];
  total: number;
}>;

/**
 * SQL mirror of `employerDirectoryFilterAndSort` in the employer-directory
 * domain: filters and sorts inside the database and returns one bounded page
 * instead of materialising the whole directory in application code. The
 * window counts keep the "N employers · M hiring now" summary truthful for the
 * whole filtered set, not just the returned page.
 */
export async function listEmployerPublicDirectory(
  database: TransactionSql,
  query: EmployerDirectoryQuery,
): Promise<EmployerDirectoryPageResult> {
  const pageSize = EMPLOYER_DIRECTORY_PAGE_SIZE;
  const conditions: string[] = [];
  const values: unknown[] = [];
  const parameter = (value: unknown): string => {
    values.push(value);
    return `$${values.length}`;
  };
  // Keep the unfiltered directory curated. The full legal sponsor universe is
  // included only for an explicit name search or licensed-sponsor filter.
  conditions.push(
    query.query || query.sponsor
      ? "(p.directory_visible or p.current_jobs > 0 or p.has_sponsor)"
      : "(p.directory_visible or p.current_jobs > 0)",
  );
  if (query.query) {
    conditions.push(
      `(p.name ilike ${parameter(`%${query.query}%`)} or p.slug ilike ${parameter(`%${query.query}%`)})`,
    );
  }
  if (query.industry) conditions.push(`p.employer_industry_key = ${parameter(query.industry)}`);
  if (query.sponsor) conditions.push("p.has_sponsor");
  if (query.hiring) conditions.push("p.current_jobs > 0");
  if (query.sizeBand) conditions.push(`p.employee_band = ${parameter(query.sizeBand)}`);
  if (query.ownership) conditions.push(`p.ownership_type = ${parameter(query.ownership)}`);
  const where = conditions.length > 0 ? `where ${conditions.join(" and ")}` : "";
  const ordering =
    query.sort === "az"
      ? "name asc"
      : query.sort === "roles"
        ? "current_jobs desc, name asc"
        : "(current_jobs > 0) desc, current_jobs desc, name asc";
  values.push(pageSize, (query.page - 1) * pageSize);

  const rows = await database.unsafe<
    (EmployerPublicProfileRow & { hiring_total: number; total: number })[]
  >(
    `with directory as (
       select p.*,
         count(*) filter (where p.current_jobs > 0) over () as hiring_total,
         count(*) over () as total
       from app.employer_public_profile p
       ${where}
     )
     select id, slug, name, logo_url, description, directory_visible,
       website_url, careers_url, employer_industry_key, employer_subindustry_key,
       employee_band, employee_scope, ownership_type, ticker, exchange,
       facts_as_of, has_sponsor, sponsor_snapshot_date, current_jobs, live_sources,
       hiring_total, total
     from directory
     order by ${ordering}
     limit $${values.length - 1}
     offset $${values.length}`,
    values as never[],
  );
  const first = rows[0];
  return {
    hiringTotal: first?.hiring_total ?? 0,
    rows,
    total: first?.total ?? 0,
  };
}

/**
 * Distinct size-band and ownership options for the directory filter form.
 * Derived from the narrow public search projection (latest research snapshot
 * facts per employer, matching what the directory view displays), so the
 * option lists are cheap instead of materialising the catalogue-wide profile
 * view twice per request.
 */
export async function listEmployerDirectoryOptions(
  database: TransactionSql,
): Promise<Readonly<{ employeeBands: readonly string[]; ownerships: readonly string[] }>> {
  const rows = await database<{ bands: string[] | null; ownerships: string[] | null }[]>`
    select
      (select coalesce(jsonb_agg(band order by band), '[]'::jsonb)
       from (select distinct employee_band as band from app.employer_public_search where employee_band is not null) b) as bands,
      (select coalesce(jsonb_agg(ownership order by ownership), '[]'::jsonb)
       from (select distinct ownership_type as ownership from app.employer_public_search where ownership_type is not null) o) as ownerships
  `;
  return {
    employeeBands: rows[0]?.bands ?? [],
    ownerships: rows[0]?.ownerships ?? [],
  };
}

/**
 * Single-employer public profile. The full `employer_public_profile` view
 * materialises catalogue-wide aggregates (`current_jobs`, `live_sources`,
 * aliases) for every company, so a one-employer lookup would scan the whole
 * job catalogue. This direct query derives the same facts from the indexed
 * company, snapshot, sponsor and source rows instead.
 */
export async function findEmployerPublicProfile(
  database: TransactionSql,
  slug: string,
): Promise<EmployerPublicProfileRow | null> {
  const rows = await database<EmployerPublicProfileRow[]>`
    select c.id, c.slug, c.name, c.logo_url, c.description, c.directory_visible,
      nullif(c.website_url, '') as website_url,
      nullif(c.careers_url, '') as careers_url,
      c.employer_industry_key, c.employer_subindustry_key,
      snap.employee_band, snap.employee_scope, snap.ownership_type, snap.ticker,
      snap.exchange, snap.research_date as facts_as_of,
      coalesce(sp.has_sponsor, false) as has_sponsor,
      sp.sponsor_snapshot_date,
      (
        select count(*)::int
        from app.job j
        where j.company_id = c.id
          and j.active and j.publication_status = 'published'
          and j.eligibility_status = 'eligible'
          and (j.application_deadline is null or j.application_deadline >= now())
      ) as current_jobs,
      (
        select count(*)::int
        from app.job_source s
        where s.company_id = c.id and s.status = 'active'
      ) as live_sources
    from app.company c
    left join lateral (
      select s.employee_band, s.employee_scope, s.ownership_type, s.ticker, s.exchange,
        s.research_date
      from app.employer_research_snapshot s
      where s.company_id = c.id
      order by s.research_date desc, s.dataset_version desc
      limit 1
    ) snap on true
    left join app.employer_public_sponsor sp on sp.company_id = c.id
    where c.slug = ${slug}
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
  exists (
    select 1 from app.employer_public_sponsor s
    where s.company_id = c.id and s.has_sponsor
  ) as company_has_sponsor`;

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
     where ${conditions.join(" and ")}
     order by ${relatedRoleOrder}
     limit $${values.length}`,
    values as never[],
  );
}
