import type { TransactionSql } from "postgres";
import { jsonParameter } from "./crawler-database";
import {
  crawlStatusValues,
  type CrawlStatus,
  type SourceCompany,
  type SourceType,
} from "../domain/source";
import type { JobSectorKey } from "../domain/taxonomy";

type CompanyRow = Readonly<{
  active: boolean;
  careers_url: string;
  configuration: Readonly<Record<string, unknown>>;
  consecutive_failures: number;
  crawl_allowed: string;
  crawl_frequency_minutes: number;
  crawl_status: string;
  id: string;
  last_checked_at: Date | null;
  last_successful_check_at: Date | null;
  name: string;
  next_check_at: Date | null;
  slug: string;
  source_type: string;
}>;

function company(row: CompanyRow): SourceCompany {
  return {
    active: row.active,
    careersUrl: row.careers_url,
    configuration: row.configuration,
    consecutiveFailures: row.consecutive_failures,
    crawlAllowed:
      row.crawl_allowed === "blocked"
        ? "blocked"
        : row.crawl_allowed === "allowed"
          ? "allowed"
          : "unknown",
    crawlFrequencyMinutes: row.crawl_frequency_minutes,
    crawlStatus: crawlStatusValues.includes(row.crawl_status as CrawlStatus)
      ? (row.crawl_status as CrawlStatus)
      : "failing",
    id: row.id,
    lastCheckedAt: row.last_checked_at,
    lastSuccessfulCheckAt: row.last_successful_check_at,
    name: row.name,
    nextCheckAt: row.next_check_at,
    slug: row.slug,
    sourceType: row.source_type as SourceType,
  };
}

export type CompanyAdminRow = CompanyRow &
  Readonly<{
    ats_provider: string | null;
    country: string;
    evidence_url: string | null;
    industry: string | null;
    notes: string;
    review_date: Date | null;
    review_notes: string;
    reviewed_by_user_id: string | null;
    robots_result: string;
    terms_result: string;
    website_url: string | null;
  }>;

export async function findCompanyById(
  database: TransactionSql,
  id: string,
): Promise<SourceCompany | null> {
  const rows = await database<CompanyRow[]>`
    select id, name, slug, careers_url, source_type, crawl_allowed, crawl_status,
      crawl_frequency_minutes, last_checked_at, last_successful_check_at,
      next_check_at, consecutive_failures, active, configuration
    from app.company
    where id = ${id}::uuid
  `;
  return rows[0] ? company(rows[0]) : null;
}

export async function findCompanyBySlug(
  database: TransactionSql,
  slug: string,
): Promise<SourceCompany | null> {
  const rows = await database<CompanyRow[]>`
    select id, name, slug, careers_url, source_type, crawl_allowed, crawl_status,
      crawl_frequency_minutes, last_checked_at, last_successful_check_at,
      next_check_at, consecutive_failures, active, configuration
    from app.company
    where slug = ${slug}
  `;
  return rows[0] ? company(rows[0]) : null;
}

export async function listDueCompanies(
  database: TransactionSql,
  now: Date,
  limit: number,
): Promise<SourceCompany[]> {
  const rows = await database<CompanyRow[]>`
    select id, name, slug, careers_url, source_type, crawl_allowed, crawl_status,
      crawl_frequency_minutes, last_checked_at, last_successful_check_at,
      next_check_at, consecutive_failures, active, configuration
    from app.company
    where active
      and crawl_allowed = 'allowed'
      and crawl_status <> 'paused'
      and (next_check_at is null or next_check_at <= ${now})
    order by next_check_at nulls first, updated_at asc
    limit ${limit}
  `;
  return rows.map(company);
}

export async function listAllCompanies(
  database: TransactionSql,
): Promise<readonly SourceCompany[]> {
  const rows = await database<CompanyRow[]>`
    select id, name, slug, careers_url, source_type, crawl_allowed, crawl_status,
      crawl_frequency_minutes, last_checked_at, last_successful_check_at,
      next_check_at, consecutive_failures, active, configuration
    from app.company
    order by name asc
  `;
  return rows.map(company);
}

export async function listCompaniesForAdmin(database: TransactionSql): Promise<CompanyAdminRow[]> {
  return database<CompanyAdminRow[]>`
    select id, name, slug, website_url, careers_url, ats_provider, industry, country,
      source_type, crawl_allowed, crawl_status, crawl_frequency_minutes,
      last_checked_at, last_successful_check_at, next_check_at, consecutive_failures,
      active, configuration, notes,
      review_date, reviewed_by_user_id, robots_result, terms_result, evidence_url, review_notes
    from app.company
    order by active desc, name asc
  `;
}

export type CompanyRunOutcome = Readonly<{
  lastCheckedAt: Date;
  lastSuccessfulCheckAt: Date | null;
  nextCheckAt: Date | null;
  consecutiveFailures: number;
  crawlStatus: CrawlStatus;
  lastError: string | null;
}>;

export async function updateCompanyAfterRun(
  database: TransactionSql,
  companyId: string,
  outcome: CompanyRunOutcome,
): Promise<void> {
  await database`
    update app.company
    set last_checked_at = ${outcome.lastCheckedAt},
        last_successful_check_at = ${outcome.lastSuccessfulCheckAt},
        next_check_at = ${outcome.nextCheckAt},
        consecutive_failures = ${outcome.consecutiveFailures},
        crawl_status = ${outcome.crawlStatus},
        updated_at = now()
    where id = ${companyId}::uuid
  `;
}

export async function setCompanyPaused(
  database: TransactionSql,
  companyId: string,
  paused: boolean,
): Promise<void> {
  await database`
    update app.company
    set crawl_status = ${paused ? "paused" : "healthy"},
        updated_at = now()
    where id = ${companyId}::uuid
  `;
}

export async function setCompanyCrawlAllowed(
  database: TransactionSql,
  companyId: string,
  crawlAllowed: "allowed" | "unknown" | "blocked",
): Promise<void> {
  await database`
    update app.company
    set crawl_allowed = ${crawlAllowed},
        updated_at = now()
    where id = ${companyId}::uuid
  `;
}

export type CompanySeedInput = Readonly<{
  atsProvider?: string | null;
  careersUrl: string;
  configuration?: Readonly<Record<string, unknown>>;
  country?: string;
  crawlAllowed?: "allowed" | "unknown" | "blocked";
  crawlFrequencyMinutes?: number;
  directoryPriorityRank?: number | null;
  directorySectorKey?: JobSectorKey | null;
  directoryVisible?: boolean;
  industry?: string | null;
  name: string;
  notes?: string;
  slug: string;
  sourceType: SourceType;
  websiteUrl?: string | null;
}>;

/**
 * Clears directory priority ranks for the given slugs so the idempotent
 * cohort import can re-assign gap-based ranks without transiently colliding
 * with the unique rank constraint while rows are re-ranked one by one.
 */
export async function clearDirectoryPriorityRanks(
  database: TransactionSql,
  slugs: readonly string[],
): Promise<void> {
  await database`
    update app.company
    set directory_priority_rank = null, updated_at = now()
    where slug = any(${slugs})
  `;
}

export async function upsertCompany(
  database: TransactionSql,
  input: CompanySeedInput,
): Promise<string> {
  const existingByUrl = await database<{ id: string }[]>`
    select id from app.company
    where lower(careers_url) = lower(${input.careersUrl})
    limit 1
  `;
  if (existingByUrl[0]) {
    await database`
      update app.company
      set name = ${input.name},
          website_url = ${input.websiteUrl ?? null},
          careers_url = ${input.careersUrl},
          industry = ${input.industry ?? null},
          directory_sector_key = ${input.directorySectorKey ?? null},
          directory_priority_rank = ${input.directoryPriorityRank ?? null},
          directory_visible = ${input.directoryVisible ?? false},
          ats_provider = ${input.atsProvider ?? null},
          source_type = ${input.sourceType},
          crawl_frequency_minutes = ${input.crawlFrequencyMinutes ?? 1440},
          configuration = ${jsonParameter(database, input.configuration ?? {})},
          notes = ${input.notes ?? ""},
          updated_at = now()
      where id = ${existingByUrl[0].id}::uuid
    `;
    return existingByUrl[0].id;
  }
  const rows = await database<{ id: string }[]>`
    insert into app.company (
      name, slug, website_url, careers_url, industry, country, ats_provider,
      source_type, crawl_allowed, crawl_frequency_minutes, configuration, notes,
      directory_sector_key, directory_priority_rank, directory_visible
    )
    values (
      ${input.name}, ${input.slug}, ${input.websiteUrl ?? null}, ${input.careersUrl},
      ${input.industry ?? null}, ${input.country ?? "UK"}, ${input.atsProvider ?? null},
      ${input.sourceType}, ${input.crawlAllowed ?? "unknown"},
      ${input.crawlFrequencyMinutes ?? 1440},
      ${jsonParameter(database, input.configuration ?? {})}, ${input.notes ?? ""},
      ${input.directorySectorKey ?? null}, ${input.directoryPriorityRank ?? null},
      ${input.directoryVisible ?? false}
    )
    on conflict (slug) do update
    set name = excluded.name,
        website_url = excluded.website_url,
        careers_url = excluded.careers_url,
        industry = excluded.industry,
        directory_sector_key = excluded.directory_sector_key,
        directory_priority_rank = excluded.directory_priority_rank,
        directory_visible = excluded.directory_visible,
        ats_provider = excluded.ats_provider,
        source_type = excluded.source_type,
        crawl_frequency_minutes = excluded.crawl_frequency_minutes,
        configuration = excluded.configuration,
        notes = excluded.notes,
        updated_at = now()
    returning id
  `;
  return rows[0]!.id;
}

export type SourceReviewInput = Readonly<{
  evidenceUrl: string | null;
  reviewDate: Date;
  reviewNotes: string;
  reviewerUserId: string;
  robotsResult: "allowed" | "blocked" | "unknown" | "not_checked";
  termsResult: "allowed" | "blocked" | "unknown" | "not_reviewed";
}>;

export async function recordSourceReview(
  database: TransactionSql,
  companyId: string,
  input: SourceReviewInput,
): Promise<void> {
  await database`
    update app.company
    set review_date = ${input.reviewDate},
        reviewed_by_user_id = ${input.reviewerUserId}::uuid,
        robots_result = ${input.robotsResult},
        terms_result = ${input.termsResult},
        evidence_url = ${input.evidenceUrl},
        review_notes = ${input.reviewNotes},
        updated_at = now()
    where id = ${companyId}::uuid
  `;
}
