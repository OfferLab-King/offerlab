begin;

-- Job lifecycle observability: zero-result anomaly tracking on sources and
-- per-job event history.
--
-- A source returning zero jobs is NOT invalid (programme landing pages may
-- legitimately be empty between intakes). We track consecutive zero-result
-- successful crawls and the last time the source produced jobs so the admin
-- surface can distinguish "expectedly quiet" from "suddenly empty after
-- hundreds of jobs" (an anomaly worth review). Jobs are never closed by a
-- zero-result crawl: disappearance logic only runs on successful, non-empty
-- listings.

alter table app.job_source
  add column consecutive_zero_results integer not null default 0,
  add column last_non_zero_result_at timestamptz;

comment on column app.job_source.consecutive_zero_results is
  'Consecutive successful crawls that returned zero jobs (an anomaly when the source previously produced jobs).';
comment on column app.job_source.last_non_zero_result_at is
  'Last successful crawl that returned at least one job; null until the first non-empty listing.';

-- Per-job lifecycle events: discovered, updated, possibly_closed, closed,
-- reopened. The foundation for "new today", "recently updated", "recently
-- closed", job alerts and employer update feeds. Written by the crawler role
-- inside the ingestion transaction; read by administrators.
create table app.job_event (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references app.job(id) on delete cascade,
  company_id uuid not null references app.company(id) on delete restrict,
  source_id uuid references app.job_source(id) on delete set null,
  crawl_run_id uuid references app.job_ingestion_run(id) on delete set null,
  event_type text not null
    check (event_type in ('discovered', 'updated', 'possibly_closed', 'closed', 'reopened')),
  event_at timestamptz not null default now(),
  changed_fields jsonb not null default '[]'::jsonb,
  previous_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb
);

create index job_event_job_index on app.job_event (job_id, event_at desc);
create index job_event_company_index on app.job_event (company_id, event_at desc);
create index job_event_type_time_index on app.job_event (event_type, event_at desc);

comment on table app.job_event is
  'Per-job lifecycle events recorded by the crawler ingestion transaction; administrator-read, crawler-written.';
comment on column app.job_event.changed_fields is
  'Field names that changed for updated events (deterministic content-hash inputs).';

alter table app.job_event enable row level security;

create policy job_event_admin_select
  on app.job_event
  for select
  to offerlab_app
  using (exists (
    select 1 from app."user" u
    where u.id = app.current_user_id() and u.role = 'administrator'
  ));

create policy job_event_crawler_write
  on app.job_event
  for all
  to offerlab_crawler
  using (true)
  with check (true);

revoke all on app.job_event from public, anon, authenticated;
revoke all on app.job_event from offerlab_identity_sync;
grant select on app.job_event to offerlab_app;
grant select, insert, update, delete on app.job_event to offerlab_crawler;

commit;
