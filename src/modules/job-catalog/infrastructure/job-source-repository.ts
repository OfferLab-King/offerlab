import type { TransactionSql } from "postgres";
import type { JobSource, SourceChannel, SourceStatus, SourceType } from "../domain/source";
import { jsonParameter } from "./crawler-database";

type JobSourceRow = Readonly<{
  careers_url: string;
  channel: string;
  company_id: string;
  company_name: string;
  company_slug: string;
  configuration: Readonly<Record<string, unknown>>;
  consecutive_failures: number;
  crawl_endpoint_url: string | null;
  crawl_frequency_minutes: number;
  id: string;
  last_checked_at: Date | null;
  last_successful_check_at: Date | null;
  next_check_at: Date | null;
  run_requested_at: Date | null;
  source_name: string;
  source_slug: string;
  source_type: string;
  status: string;
}>;

const sourceColumns = `
  s.id, s.company_id, c.name as company_name, c.slug as company_slug,
  s.slug as source_slug, s.name as source_name, s.channel, s.careers_url,
  s.crawl_endpoint_url, s.source_type, s.status, s.crawl_frequency_minutes,
  s.last_checked_at, s.last_successful_check_at, s.next_check_at,
  s.run_requested_at, s.consecutive_failures, s.configuration
`;

function mapSource(row: JobSourceRow): JobSource {
  return {
    careersUrl: row.careers_url,
    channel: row.channel as SourceChannel,
    companyId: row.company_id,
    companyName: row.company_name,
    companySlug: row.company_slug,
    configuration: row.configuration,
    consecutiveFailures: row.consecutive_failures,
    crawlEndpointUrl: row.crawl_endpoint_url,
    crawlFrequencyMinutes: row.crawl_frequency_minutes,
    id: row.id,
    lastCheckedAt: row.last_checked_at,
    lastSuccessfulCheckAt: row.last_successful_check_at,
    nextCheckAt: row.next_check_at,
    runRequestedAt: row.run_requested_at,
    sourceName: row.source_name,
    sourceSlug: row.source_slug,
    sourceType: row.source_type as SourceType,
    status: row.status as SourceStatus,
  };
}

export async function findJobSourceById(
  database: TransactionSql,
  sourceId: string,
): Promise<JobSource | null> {
  const rows = await database.unsafe<JobSourceRow[]>(
    `
    select ${sourceColumns}
    from app.job_source s
    join app.company c on c.id = s.company_id
    where s.id = $1::uuid
  `,
    [sourceId],
  );
  return rows[0] ? mapSource(rows[0]) : null;
}

export async function findJobSourceBySlugs(
  database: TransactionSql,
  companySlug: string,
  sourceSlug: string,
): Promise<JobSource | null> {
  const rows = await database.unsafe<JobSourceRow[]>(
    `
    select ${sourceColumns}
    from app.job_source s
    join app.company c on c.id = s.company_id
    where c.slug = $1 and s.slug = $2
  `,
    [companySlug, sourceSlug],
  );
  return rows[0] ? mapSource(rows[0]) : null;
}

export async function listDueJobSources(
  database: TransactionSql,
  now: Date,
  limit: number,
): Promise<JobSource[]> {
  const rows = await database.unsafe<JobSourceRow[]>(
    `
    select ${sourceColumns}
    from app.job_source s
    join app.company c on c.id = s.company_id
    where s.status = 'active'
      and (s.run_requested_at is not null or s.next_check_at is null or s.next_check_at <= $1)
    order by (s.run_requested_at is not null) desc,
      s.run_requested_at nulls last, s.next_check_at nulls first, s.updated_at asc
    limit $2
  `,
    [now, limit],
  );
  return rows.map(mapSource);
}

export async function listAllJobSources(database: TransactionSql): Promise<JobSource[]> {
  const rows = await database.unsafe<JobSourceRow[]>(`
    select ${sourceColumns}
    from app.job_source s
    join app.company c on c.id = s.company_id
    order by c.name, s.name
  `);
  return rows.map(mapSource);
}

export type JobSourceAdminRow = Readonly<{
  id: string;
  company_id: string;
  company_name: string;
  company_slug: string;
  source_slug: string;
  source_name: string;
  channel: string;
  careers_url: string;
  crawl_endpoint_url: string | null;
  source_type: string;
  status: string;
  crawl_frequency_minutes: number;
  last_checked_at: Date | null;
  last_successful_check_at: Date | null;
  next_check_at: Date | null;
  run_requested_at: Date | null;
  consecutive_failures: number;
  landing_health_status: string;
  landing_last_status_code: number | null;
  landing_final_url: string | null;
  landing_invalid_since: Date | null;
  endpoint_health_status: string;
  endpoint_last_status_code: number | null;
  endpoint_final_url: string | null;
  endpoint_invalid_since: Date | null;
}>;

export async function listJobSourcesForAdmin(
  database: TransactionSql,
): Promise<JobSourceAdminRow[]> {
  return database<JobSourceAdminRow[]>`
    select s.id, s.company_id, c.name as company_name, c.slug as company_slug,
      s.slug as source_slug, s.name as source_name, s.channel, s.careers_url,
      s.crawl_endpoint_url, s.source_type, s.status, s.crawl_frequency_minutes,
      s.last_checked_at, s.last_successful_check_at, s.next_check_at,
      s.run_requested_at, s.consecutive_failures, s.landing_health_status,
      s.landing_last_status_code, s.landing_final_url, s.landing_invalid_since,
      s.endpoint_health_status, s.endpoint_last_status_code, s.endpoint_final_url,
      s.endpoint_invalid_since
    from app.job_source s
    join app.company c on c.id = s.company_id
    order by s.status = 'active' desc, c.name, s.name
  `;
}

export async function updateJobSourceUrls(
  database: TransactionSql,
  sourceId: string,
  careersUrl: string,
  crawlEndpointUrl: string | null,
): Promise<boolean> {
  const rows = await database<{ id: string }[]>`
    update app.job_source
    set careers_url = ${careersUrl}, crawl_endpoint_url = ${crawlEndpointUrl},
        manually_overridden = true, updated_at = now()
    where id = ${sourceId}::uuid
    returning id
  `;
  return rows.length === 1;
}

export async function recordJobSourceHealth(
  database: TransactionSql,
  sourceId: string,
  target: "landing" | "endpoint",
  health: Readonly<{
    checkedAt: Date | null;
    errorCode: string | null;
    finalUrl: string | null;
    invalidSince: Date | null;
    status: "healthy" | "redirected" | "invalid" | "unchecked";
    statusCode: number | null;
  }>,
): Promise<void> {
  if (target === "landing") {
    await database`
      update app.job_source set
        landing_health_status = ${health.status}, landing_last_status_code = ${health.statusCode},
        landing_final_url = ${health.finalUrl}, landing_checked_at = ${health.checkedAt},
        landing_error_code = ${health.errorCode}, landing_invalid_since = ${health.invalidSince},
        updated_at = now()
      where id = ${sourceId}::uuid
    `;
    return;
  }
  await database`
    update app.job_source set
      endpoint_health_status = ${health.status}, endpoint_last_status_code = ${health.statusCode},
      endpoint_final_url = ${health.finalUrl}, endpoint_checked_at = ${health.checkedAt},
      endpoint_error_code = ${health.errorCode}, endpoint_invalid_since = ${health.invalidSince},
      updated_at = now()
    where id = ${sourceId}::uuid
  `;
}

export type SourceRunOutcome = Readonly<{
  automaticPauseReason?: string | null;
  consecutiveFailures: number;
  lastCheckedAt: Date;
  lastSuccessfulCheckAt: Date | null;
  nextCheckAt: Date | null;
  status: SourceStatus;
}>;

export async function updateJobSourceAfterRun(
  database: TransactionSql,
  sourceId: string,
  outcome: SourceRunOutcome,
): Promise<void> {
  await database`
    update app.job_source
    set last_checked_at = ${outcome.lastCheckedAt},
        last_successful_check_at = coalesce(${outcome.lastSuccessfulCheckAt}, last_successful_check_at),
        next_check_at = ${outcome.nextCheckAt},
        run_requested_at = null,
        run_requested_by_user_id = null,
        consecutive_failures = ${outcome.consecutiveFailures},
        status = ${outcome.status},
        automatic_pause_reason = ${outcome.automaticPauseReason ?? null},
        updated_at = now()
    where id = ${sourceId}::uuid
  `;
}

export async function requestJobSourceRun(
  database: TransactionSql,
  sourceId: string,
  administratorUserId: string,
  requestedAt = new Date(),
): Promise<boolean> {
  const rows = await database<{ id: string }[]>`
    update app.job_source
    set run_requested_at = ${requestedAt},
        run_requested_by_user_id = ${administratorUserId}::uuid,
        updated_at = now()
    where id = ${sourceId}::uuid and status = 'active'
    returning id
  `;
  return rows.length === 1;
}

export async function setJobSourceStatus(
  database: TransactionSql,
  sourceId: string,
  status: SourceStatus,
): Promise<boolean> {
  const rows = await database<{ id: string }[]>`
    update app.job_source
    set status = ${status},
        automatic_pause_reason = null,
        updated_at = now()
    where id = ${sourceId}::uuid
    returning id
  `;
  return rows.length === 1;
}

export type JobSourceWrite = Readonly<{
  atsProvider?: string | null;
  careersUrl: string;
  channel: SourceChannel;
  companyId: string;
  configuration?: Readonly<Record<string, unknown>>;
  crawlEndpointUrl?: string | null;
  crawlFrequencyMinutes?: number;
  manuallyOverridden?: boolean;
  name: string;
  notes?: string;
  slug: string;
  sourceType: SourceType;
  status?: SourceStatus;
}>;

export async function upsertJobSource(
  database: TransactionSql,
  input: JobSourceWrite,
): Promise<string> {
  const rows = await database<{ id: string }[]>`
    insert into app.job_source (
      company_id, slug, name, channel, careers_url, crawl_endpoint_url,
      ats_provider, source_type, status, crawl_frequency_minutes, configuration,
      manually_overridden, notes
    ) values (
      ${input.companyId}::uuid, ${input.slug}, ${input.name}, ${input.channel},
      ${input.careersUrl}, ${input.crawlEndpointUrl ?? null}, ${input.atsProvider ?? null},
      ${input.sourceType}, ${input.status ?? "active"},
      ${input.crawlFrequencyMinutes ?? 1440},
      ${jsonParameter(database, input.configuration ?? {})},
      ${input.manuallyOverridden ?? false}, ${input.notes ?? ""}
    )
    on conflict (company_id, slug) do update
    set name = excluded.name,
        channel = excluded.channel,
        careers_url = case when app.job_source.manually_overridden then app.job_source.careers_url else excluded.careers_url end,
        crawl_endpoint_url = case when app.job_source.manually_overridden then app.job_source.crawl_endpoint_url else excluded.crawl_endpoint_url end,
        ats_provider = case when app.job_source.manually_overridden then app.job_source.ats_provider else excluded.ats_provider end,
        source_type = case when app.job_source.manually_overridden then app.job_source.source_type else excluded.source_type end,
        crawl_frequency_minutes = excluded.crawl_frequency_minutes,
        configuration = case when app.job_source.manually_overridden then app.job_source.configuration else excluded.configuration end,
        notes = excluded.notes,
        updated_at = now()
    returning id
  `;
  return rows[0]!.id;
}
