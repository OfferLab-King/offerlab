begin;

create table app.job_source (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references app.company(id) on delete restrict,
  slug text not null,
  name text not null,
  channel text not null default 'general',
  careers_url text not null,
  crawl_endpoint_url text,
  ats_provider text,
  source_type text not null default 'unknown',
  status text not null default 'active',
  crawl_frequency_minutes integer not null default 1440,
  last_checked_at timestamptz,
  last_successful_check_at timestamptz,
  next_check_at timestamptz,
  run_requested_at timestamptz,
  run_requested_by_user_id uuid references app."user"(id) on delete set null,
  consecutive_failures integer not null default 0,
  automatic_pause_reason text,
  configuration jsonb not null default '{}'::jsonb,
  landing_health_status text not null default 'unchecked',
  landing_last_status_code integer,
  landing_final_url text,
  landing_checked_at timestamptz,
  landing_error_code text,
  landing_invalid_since timestamptz,
  endpoint_health_status text not null default 'unchecked',
  endpoint_last_status_code integer,
  endpoint_final_url text,
  endpoint_checked_at timestamptz,
  endpoint_error_code text,
  endpoint_invalid_since timestamptz,
  verification_date date,
  verification_evidence_url text,
  manifest_version integer,
  manually_overridden boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_source_slug_check check (
    slug = btrim(slug) and slug ~ '^[a-z0-9][a-z0-9-]{0,79}$'
  ),
  constraint job_source_name_check check (
    name = btrim(name) and char_length(name) between 1 and 160
  ),
  constraint job_source_channel_check check (
    channel in ('early_careers','professional','apprenticeships','general','other')
  ),
  constraint job_source_urls_check check (
    careers_url ~ '^https?://[^[:space:]]+$'
    and (crawl_endpoint_url is null or crawl_endpoint_url ~ '^https?://[^[:space:]]+$')
    and (landing_final_url is null or landing_final_url ~ '^https?://[^[:space:]]+$')
    and (endpoint_final_url is null or endpoint_final_url ~ '^https?://[^[:space:]]+$')
    and (verification_evidence_url is null or verification_evidence_url ~ '^https?://[^[:space:]]+$')
  ),
  constraint job_source_source_type_check check (
    source_type in ('direct_html','workday','greenhouse','lever','smartrecruiters','ashby','custom','unknown')
  ),
  constraint job_source_status_check check (
    status in ('active','paused','archived')
  ),
  constraint job_source_frequency_check check (
    crawl_frequency_minutes between 15 and 10080
  ),
  constraint job_source_failures_check check (
    consecutive_failures between 0 and 1000
  ),
  constraint job_source_configuration_check check (
    jsonb_typeof(configuration) = 'object'
  ),
  constraint job_source_health_check check (
    landing_health_status in ('unchecked','healthy','redirected','invalid')
    and endpoint_health_status in ('unchecked','healthy','redirected','invalid')
  ),
  constraint job_source_status_codes_check check (
    (landing_last_status_code is null or landing_last_status_code between 100 and 599)
    and (endpoint_last_status_code is null or endpoint_last_status_code between 100 and 599)
  ),
  constraint job_source_error_codes_check check (
    (landing_error_code is null or (
      landing_error_code = btrim(landing_error_code)
      and char_length(landing_error_code) between 1 and 80
    ))
    and (endpoint_error_code is null or (
      endpoint_error_code = btrim(endpoint_error_code)
      and char_length(endpoint_error_code) between 1 and 80
    ))
  ),
  constraint job_source_notes_check check (
    notes = btrim(notes) and char_length(notes) <= 2000
  ),
  constraint job_source_manifest_version_check check (
    manifest_version is null or manifest_version > 0
  ),
  constraint job_source_request_check check (
    run_requested_at is not null or run_requested_by_user_id is null
  ),
  constraint job_source_company_slug_unique unique(company_id, slug)
);

create index job_source_due_idx
  on app.job_source (next_check_at, updated_at)
  where status = 'active';
create index job_source_manual_request_idx
  on app.job_source (run_requested_at)
  where status = 'active' and run_requested_at is not null;
create index job_source_company_status_idx
  on app.job_source (company_id, status, name);
create index job_source_invalid_idx
  on app.job_source (landing_invalid_since, endpoint_invalid_since)
  where landing_invalid_since is not null or endpoint_invalid_since is not null;

insert into app.job_source (
  company_id, slug, name, channel, careers_url, ats_provider, source_type, status,
  crawl_frequency_minutes, last_checked_at, last_successful_check_at,
  next_check_at, consecutive_failures, configuration, verification_date,
  verification_evidence_url, notes, created_at, updated_at
)
select
  id,
  'careers',
  'Careers',
  'general',
  careers_url,
  ats_provider,
  source_type,
  case when not active then 'archived'
       when crawl_status = 'paused' then 'paused'
       else 'active' end,
  crawl_frequency_minutes,
  last_checked_at,
  last_successful_check_at,
  next_check_at,
  consecutive_failures,
  configuration,
  review_date,
  evidence_url,
  notes,
  created_at,
  updated_at
from app.company;

alter table app.job
  add column source_id uuid references app.job_source(id) on delete restrict;
alter table app.job_ingestion_run
  add column source_id uuid references app.job_source(id) on delete restrict,
  add column trigger_kind text not null default 'scheduled',
  add column jobs_rejected_non_uk integer not null default 0,
  add column jobs_held_ambiguous integer not null default 0,
  add constraint job_ingestion_run_trigger_check check (
    trigger_kind in ('scheduled','manual')
  ),
  add constraint job_ingestion_run_uk_counts_check check (
    jobs_rejected_non_uk >= 0 and jobs_held_ambiguous >= 0
  );
alter table app.job_source_event
  add column source_id uuid references app.job_source(id) on delete restrict;

update app.job j
set source_id = s.id
from app.job_source s
where s.company_id = j.company_id and s.slug = 'careers';

update app.job_ingestion_run r
set source_id = s.id
from app.job_source s
where s.company_id = r.company_id and s.slug = 'careers';

update app.job_source_event e
set source_id = s.id
from app.job_source s
where s.company_id = e.company_id and s.slug = 'careers';

drop index app.job_company_external_id_unique;
drop index app.job_company_source_url_unique;
drop index app.job_company_application_url_unique;

create unique index job_source_external_id_unique
  on app.job (source_id, external_job_id)
  where source_id is not null and external_job_id is not null;
create unique index job_source_source_url_unique
  on app.job (source_id, source_url)
  where source_id is not null and source_url is not null;
create unique index job_source_application_url_unique
  on app.job (source_id, application_url)
  where source_id is not null and application_url is not null;
create index job_source_id_idx on app.job (source_id);

create index job_ingestion_run_source_started_idx
  on app.job_ingestion_run (source_id, started_at desc);
create index job_source_event_source_time_idx
  on app.job_source_event (source_id, occurred_at desc);

create function app.enforce_job_source_company()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.source_id is not null and not exists (
    select 1 from app.job_source s
    where s.id = new.source_id and s.company_id = new.company_id
  ) then
    raise exception 'job source does not belong to company';
  end if;
  return new;
end;
$$;

create trigger job_source_company_guard
before insert or update of source_id, company_id on app.job
for each row execute function app.enforce_job_source_company();

alter table app.job_source enable row level security;
alter table app.job_source force row level security;

create policy job_source_admin_access on app.job_source
  for all to offerlab_app
  using (
    exists (
      select 1 from app."user" u
      where u.id = app.current_user_id() and u.role = 'administrator'
    )
  )
  with check (
    exists (
      select 1 from app."user" u
      where u.id = app.current_user_id() and u.role = 'administrator'
    )
  );

create policy job_source_crawler_access on app.job_source
  for all to offerlab_crawler using(true) with check(true);

drop policy audit_event_insert_job_catalog on app.audit_event;
create policy audit_event_insert_job_catalog on app.audit_event
  for insert to offerlab_app with check(
    actor_user_id = app.current_user_id() and metadata = '{}'::jsonb and (
      (
        entity_type = 'job_source'
        and action in (
          'job_source.created', 'job_source.updated', 'job_source.run_requested',
          'job_source.paused', 'job_source.resumed', 'job_source.archived'
        )
        and exists(select 1 from app.job_source s where s.id = entity_id)
      ) or (
        entity_type = 'job'
        and action in (
          'job.publication_changed', 'job.classification_changed',
          'job.eligibility_changed'
        )
        and exists(select 1 from app.job j where j.id = entity_id)
      )
    )
  );

grant select, insert, update, delete on app.job_source to offerlab_app;
grant select, insert, update, delete on app.job_source to offerlab_crawler;
grant select (source_id) on app.job to offerlab_app;
grant select (source_id, trigger_kind, jobs_rejected_non_uk, jobs_held_ambiguous)
  on app.job_ingestion_run to offerlab_app;
grant select (source_id) on app.job_source_event to offerlab_app;

revoke all on app.job_source
  from public, anon, authenticated, offerlab_identity_sync;

comment on table app.job_source is
  'Independent official employer career source: channel, connector, daily schedule, health and manual run state.';
comment on column app.job.source_id is
  'Owning crawl source. Nullable only during the expand-and-contract compatibility window.';
comment on column app.job_source.run_requested_at is
  'Administrator request consumed atomically by the isolated crawler worker.';

commit;
