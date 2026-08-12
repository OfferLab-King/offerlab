import type { TransactionSql } from "postgres";
import { jsonParameter } from "./crawler-database";

export type IngestionRunStatus = "running" | "succeeded" | "failed" | "skipped";

export type IngestionRunSummary = Readonly<{
  durationMs: number;
  errorCount: number;
  errorSummary: string | null;
  jobsDeactivated: number;
  jobsDiscovered: number;
  jobsNew: number;
  jobsUnchanged: number;
  jobsUpdated: number;
  metadata: Readonly<Record<string, unknown>>;
  status: IngestionRunStatus;
}>;

export async function startIngestionRun(
  database: TransactionSql,
  companyId: string,
  sourceId?: string,
  triggerKind: "manual" | "scheduled" = "scheduled",
): Promise<string> {
  const rows = await database<{ id: string }[]>`
    insert into app.job_ingestion_run (company_id, source_id, trigger_kind, status)
    values (${companyId}::uuid, ${sourceId ?? null}::uuid, ${triggerKind}, 'running')
    returning id
  `;
  return rows[0]!.id;
}

export async function recoverStaleRuns(
  database: TransactionSql,
  staleAfterHours: number,
): Promise<number> {
  const rows = await database<{ id: string }[]>`
    update app.job_ingestion_run
    set status = 'failed',
        finished_at = now(),
        error_count = error_count + 1,
        error_summary = 'stale_run_recovered',
        duration_ms = null
    where status = 'running'
      and started_at <= now() - make_interval(hours => ${staleAfterHours})
    returning id
  `;
  return rows.length;
}

export async function finishIngestionRun(
  database: TransactionSql,
  runId: string,
  summary: IngestionRunSummary,
): Promise<void> {
  await database`
    update app.job_ingestion_run
    set status = ${summary.status},
        finished_at = now(),
        jobs_discovered = ${summary.jobsDiscovered},
        jobs_new = ${summary.jobsNew},
        jobs_updated = ${summary.jobsUpdated},
        jobs_unchanged = ${summary.jobsUnchanged},
        jobs_deactivated = ${summary.jobsDeactivated},
        error_count = ${summary.errorCount},
        error_summary = ${summary.errorSummary},
        duration_ms = ${summary.durationMs},
        metadata = ${jsonParameter(database, summary.metadata)}
    where id = ${runId}::uuid
  `;
}

export type SourceEventKind =
  | "crawl_succeeded"
  | "crawl_failed"
  | "robots_blocked"
  | "source_paused"
  | "source_resumed"
  | "job_deactivated"
  | "job_reactivated"
  | "source_disabled"
  | "enrichment_failed"
  | "listing_empty";

export async function recordSourceEvent(
  database: TransactionSql,
  companyId: string,
  kind: SourceEventKind,
  message: string | null,
  metadata: Readonly<Record<string, unknown>> = {},
  sourceId?: string,
): Promise<void> {
  await database`
    insert into app.job_source_event (company_id, source_id, kind, message, metadata)
    values (${companyId}::uuid, ${sourceId ?? null}::uuid, ${kind}, ${message}, ${jsonParameter(database, metadata)})
  `;
}

export type RecentRunRow = Readonly<{
  company_id: string;
  company_name: string;
  duration_ms: number | null;
  error_count: number;
  error_summary: string | null;
  finished_at: Date | null;
  jobs_deactivated: number;
  jobs_discovered: number;
  jobs_new: number;
  jobs_unchanged: number;
  jobs_updated: number;
  started_at: Date;
  status: string;
  source_name: string | null;
}>;

export async function listRecentRuns(
  database: TransactionSql,
  limit: number,
): Promise<RecentRunRow[]> {
  return database<RecentRunRow[]>`
    select r.company_id, c.name as company_name, s.name as source_name, r.started_at, r.finished_at,
      r.status, r.jobs_discovered, r.jobs_new, r.jobs_updated, r.jobs_unchanged,
      r.jobs_deactivated, r.error_count, r.error_summary, r.duration_ms
    from app.job_ingestion_run r
    join app.company c on c.id = r.company_id
    left join app.job_source s on s.id = r.source_id
    order by r.started_at desc
    limit ${limit}
  `;
}

export type RecentEventRow = Readonly<{
  company_id: string;
  company_name: string;
  kind: string;
  message: string | null;
  occurred_at: Date;
  source_name: string | null;
}>;

export async function listRecentEvents(
  database: TransactionSql,
  limit: number,
): Promise<RecentEventRow[]> {
  return database<RecentEventRow[]>`
    select e.company_id, c.name as company_name, s.name as source_name, e.kind, e.message, e.occurred_at
    from app.job_source_event e
    join app.company c on c.id = e.company_id
    left join app.job_source s on s.id = e.source_id
    order by e.occurred_at desc
    limit ${limit}
  `;
}
