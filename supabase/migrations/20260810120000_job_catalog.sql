begin;

-- Job Catalog: employer source registry, normalized job records, ingestion
-- observability, and member-saved jobs. Sources are configured in the database;
-- the crawler only processes sources explicitly recorded as crawl_allowed and
-- never automatically processes sources recorded as blocked or unknown.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'offerlab_crawler') then
    create role offerlab_crawler nologin noinherit;
  end if;
end
$$;

grant offerlab_crawler to postgres;
grant usage on schema app to offerlab_crawler;

create table app.company (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  website_url text,
  careers_url text not null,
  logo_url text,
  industry text,
  country text not null default 'UK',
  ats_provider text,
  source_type text not null default 'unknown',
  crawl_allowed text not null default 'unknown',
  crawl_status text not null default 'healthy',
  crawl_frequency_minutes integer not null default 1440,
  last_checked_at timestamptz,
  last_successful_check_at timestamptz,
  next_check_at timestamptz,
  consecutive_failures integer not null default 0,
  configuration jsonb not null default '{}'::jsonb,
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_name_check check(
    name = btrim(name) and char_length(name) between 1 and 200
  ),
  constraint company_slug_check check(
    slug = btrim(slug) and slug ~ '^[a-z0-9][a-z0-9-]{0,79}$'
  ),
  constraint company_country_check check(
    country = btrim(country) and char_length(country) between 1 and 80
  ),
  constraint company_url_check check(
    (website_url is null or website_url ~ '^https?://[^[:space:]]+$')
    and careers_url ~ '^https?://[^[:space:]]+$'
    and (logo_url is null or logo_url ~ '^https?://[^[:space:]]+$')
  ),
  constraint company_ats_provider_check check(
    ats_provider is null or (ats_provider = btrim(ats_provider) and char_length(ats_provider) between 1 and 80)
  ),
  constraint company_source_type_check check(
    source_type in ('direct_html','workday','greenhouse','lever','smartrecruiters','ashby','custom','unknown')
  ),
  constraint company_crawl_allowed_check check(
    crawl_allowed in ('allowed','unknown','blocked')
  ),
  constraint company_crawl_status_check check(
    crawl_status in ('healthy','warning','failing','paused')
  ),
  constraint company_crawl_frequency_check check(
    crawl_frequency_minutes between 15 and 10080
  ),
  constraint company_failures_check check(
    consecutive_failures between 0 and 1000
  ),
  constraint company_configuration_check check(
    jsonb_typeof(configuration) = 'object'
  )
);

create unique index company_slug_unique on app.company (slug);

create table app.job (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references app.company(id) on delete restrict,
  slug text not null,
  external_job_id text,
  source_url text,
  application_url text not null,
  title text not null,
  normalized_title text,
  location_text text,
  city text,
  region text,
  country text,
  remote_type text,
  employment_type text,
  seniority_level text,
  job_category text,
  salary_min numeric(14,2),
  salary_max numeric(14,2),
  salary_currency text,
  salary_period text,
  description_raw text,
  description_text text,
  description_summary text,
  responsibilities jsonb not null default '[]'::jsonb,
  requirements jsonb not null default '[]'::jsonb,
  skills jsonb not null default '[]'::jsonb,
  preferred_skills jsonb not null default '[]'::jsonb,
  degree_requirements jsonb not null default '[]'::jsonb,
  experience_requirements text,
  visa_sponsorship_status text not null default 'unknown',
  visa_sponsorship_evidence text,
  application_deadline timestamptz,
  posted_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_changed_at timestamptz not null default now(),
  missed_crawls integer not null default 0,
  content_hash text not null,
  source_payload jsonb,
  enrichment_status text not null default 'pending',
  enrichment_model text,
  enrichment_version integer,
  enrichment_error text,
  enrichment_attempts integer not null default 0,
  enrichment_input_tokens integer,
  enrichment_output_tokens integer,
  enrichment_latency_ms integer,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_slug_check check(
    slug = btrim(slug) and slug ~ '^[a-z0-9][a-z0-9-]{1,159}$'
  ),
  constraint job_title_check check(
    title = btrim(title) and char_length(title) between 1 and 300
  ),
  constraint job_url_check check(
    (source_url is null or source_url ~ '^https?://[^[:space:]]+$')
    and application_url ~ '^https?://[^[:space:]]+$'
  ),
  constraint job_external_id_check check(
    external_job_id is null or (external_job_id = btrim(external_job_id) and char_length(external_job_id) between 1 and 500)
  ),
  constraint job_content_hash_check check(
    content_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint job_remote_type_check check(
    remote_type is null or remote_type in ('remote','hybrid','on_site','unknown')
  ),
  constraint job_employment_type_check check(
    employment_type is null or employment_type in ('full_time','part_time','contract','internship','graduate_programme','other','unknown')
  ),
  constraint job_seniority_check check(
    seniority_level is null or seniority_level in ('intern','graduate','entry','junior','mid','senior','lead','manager','other','unknown')
  ),
  constraint job_category_check check(
    job_category is null or job_category in (
      'investment_banking','markets_sales_trading','asset_management','quant','risk',
      'compliance','accounting_audit','consulting','technology_software','data_analytics',
      'product','operations','marketing','sales','hr','engineering','legal','healthcare','other'
    )
  ),
  constraint job_visa_status_check check(
    visa_sponsorship_status in ('confirmed','likely','unlikely','not_offered','unknown')
  ),
  constraint job_enrichment_status_check check(
    enrichment_status in ('pending','completed','failed','skipped')
  ),
  constraint job_salary_check check(
    (salary_min is null or salary_min >= 0)
    and (salary_max is null or salary_max >= 0)
    and (salary_min is null or salary_max is null or salary_max >= salary_min)
  ),
  constraint job_missed_crawls_check check(missed_crawls between 0 and 100),
  constraint job_arrays_check check(
    jsonb_typeof(responsibilities) = 'array'
    and jsonb_typeof(requirements) = 'array'
    and jsonb_typeof(skills) = 'array'
    and jsonb_typeof(preferred_skills) = 'array'
    and jsonb_typeof(degree_requirements) = 'array'
    and jsonb_array_length(responsibilities) <= 20
    and jsonb_array_length(requirements) <= 20
    and jsonb_array_length(skills) <= 20
    and jsonb_array_length(preferred_skills) <= 20
    and jsonb_array_length(degree_requirements) <= 20
  ),
  constraint job_payload_check check(
    source_payload is null or jsonb_typeof(source_payload) = 'object'
  ),
  constraint job_enrichment_telemetry_check check(
    (enrichment_status = 'completed' and enrichment_version > 0 and enrichment_model is not null)
    or (enrichment_status <> 'completed' and enrichment_version is null and enrichment_model is null)
  ),
  constraint job_visa_evidence_check check(
    (visa_sponsorship_status = 'unknown' and visa_sponsorship_evidence is null)
    or (
      visa_sponsorship_status <> 'unknown'
      and visa_sponsorship_evidence is not null
      and visa_sponsorship_evidence = btrim(visa_sponsorship_evidence)
      and char_length(visa_sponsorship_evidence) between 1 and 400
    )
  ),
  constraint job_enrichment_usage_check check(
    enrichment_attempts between 0 and 10
    and (enrichment_input_tokens is null or enrichment_input_tokens >= 0)
    and (enrichment_output_tokens is null or enrichment_output_tokens >= 0)
    and (enrichment_latency_ms is null or enrichment_latency_ms >= 0)
  )
);

create unique index job_company_external_id_unique
  on app.job (company_id, external_job_id) where external_job_id is not null;
create unique index job_company_source_url_unique
  on app.job (company_id, source_url) where source_url is not null;
create unique index job_company_application_url_unique
  on app.job (company_id, application_url) where application_url is not null;
create unique index job_slug_unique on app.job (slug);
create index job_company_id_idx on app.job (company_id);
create index job_active_idx on app.job (active);
create index job_title_idx on app.job (title);
create index job_normalized_title_idx on app.job (normalized_title);
create index job_category_idx on app.job (job_category);
create index job_country_idx on app.job (country);
create index job_city_idx on app.job (city);
create index job_posted_at_idx on app.job (posted_at desc) where posted_at is not null;
create index job_deadline_idx on app.job (application_deadline) where application_deadline is not null;
create index job_first_seen_idx on app.job (first_seen_at desc);
create index job_content_hash_idx on app.job (content_hash);
create index job_enrichment_pending_idx on app.job (enrichment_status, updated_at)
  where enrichment_status in ('pending','failed');
create index job_catalog_listing_idx
  on app.job (active, posted_at desc, first_seen_at desc, id)
  where active;

alter table app.job
  add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(normalized_title, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(location_text, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(description_text, '')), 'C')
  ) stored;

create index job_search_vector_idx on app.job using gin (search_vector);

create table app.job_ingestion_run (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references app.company(id) on delete restrict,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  jobs_discovered integer not null default 0,
  jobs_new integer not null default 0,
  jobs_updated integer not null default 0,
  jobs_unchanged integer not null default 0,
  jobs_deactivated integer not null default 0,
  error_count integer not null default 0,
  error_summary text,
  duration_ms integer,
  metadata jsonb not null default '{}'::jsonb,
  constraint job_ingestion_run_status_check check(
    status in ('running','succeeded','failed','skipped')
  ),
  constraint job_ingestion_run_counts_check check(
    jobs_discovered >= 0 and jobs_new >= 0 and jobs_updated >= 0
    and jobs_unchanged >= 0 and jobs_deactivated >= 0 and error_count >= 0
    and (duration_ms is null or duration_ms >= 0)
  ),
  constraint job_ingestion_run_metadata_check check(jsonb_typeof(metadata) = 'object')
);

create index job_ingestion_run_company_started_idx
  on app.job_ingestion_run (company_id, started_at desc);
create index job_ingestion_run_started_idx on app.job_ingestion_run (started_at desc);

create table app.job_source_event (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references app.company(id) on delete restrict,
  kind text not null,
  occurred_at timestamptz not null default now(),
  message text,
  metadata jsonb not null default '{}'::jsonb,
  constraint job_source_event_kind_check check(
    kind in (
      'crawl_succeeded','crawl_failed','robots_blocked','source_paused',
      'source_resumed','job_deactivated','job_reactivated','source_disabled',
      'enrichment_failed','listing_empty'
    )
  ),
  constraint job_source_event_message_check check(
    message is null or (message = btrim(message) and char_length(message) between 1 and 500)
  ),
  constraint job_source_event_metadata_check check(jsonb_typeof(metadata) = 'object')
);

create index job_source_event_company_time_idx
  on app.job_source_event (company_id, occurred_at desc);
create index job_source_event_time_idx on app.job_source_event (occurred_at desc);

create table app.user_saved_job (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references app."user"(id) on delete restrict,
  job_id uuid not null references app.job(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint user_saved_job_owner_id_unique unique(owner_user_id,id)
);

create unique index user_saved_job_identity_unique on app.user_saved_job (owner_user_id, job_id);
create index user_saved_job_owner_created_idx on app.user_saved_job (owner_user_id, created_at desc);

-- RLS: catalog tables are globally readable and crawler-maintained; member
-- saves are owner-scoped. offerlab_crawler is a no-login server role used only
-- by the scheduled ingestion worker; it can maintain catalog tables but cannot
-- touch member-owned records.

alter table app.company enable row level security;
alter table app.company force row level security;
alter table app.job enable row level security;
alter table app.job force row level security;
alter table app.job_ingestion_run enable row level security;
alter table app.job_ingestion_run force row level security;
alter table app.job_source_event enable row level security;
alter table app.job_source_event force row level security;
alter table app.user_saved_job enable row level security;
alter table app.user_saved_job force row level security;

create policy job_catalog_company_read on app.company
  for select to offerlab_app using(true);
create policy job_catalog_job_read on app.job
  for select to offerlab_app using(true);
create policy job_catalog_run_read on app.job_ingestion_run
  for select to offerlab_app
  using(exists(select 1 from app."user" u where u.id = app.current_user_id() and u.role = 'administrator'));
create policy job_catalog_event_read on app.job_source_event
  for select to offerlab_app
  using(exists(select 1 from app."user" u where u.id = app.current_user_id() and u.role = 'administrator'));

create policy job_catalog_company_crawler_write on app.company
  for all to offerlab_crawler using(true) with check(true);
create policy job_catalog_job_crawler_write on app.job
  for all to offerlab_crawler using(true) with check(true);
create policy job_catalog_run_crawler_write on app.job_ingestion_run
  for all to offerlab_crawler using(true) with check(true);
create policy job_catalog_event_crawler_write on app.job_source_event
  for all to offerlab_crawler using(true) with check(true);

create policy job_catalog_company_admin_write on app.company
  for update to offerlab_app
  using(exists(select 1 from app."user" u where u.id = app.current_user_id() and u.role = 'administrator'))
  with check(exists(select 1 from app."user" u where u.id = app.current_user_id() and u.role = 'administrator'));

create policy user_saved_job_select_own on app.user_saved_job
  for select to offerlab_app using(owner_user_id = app.current_user_id());
create policy user_saved_job_insert_own on app.user_saved_job
  for insert to offerlab_app with check(owner_user_id = app.current_user_id());
create policy user_saved_job_delete_own on app.user_saved_job
  for delete to offerlab_app using(owner_user_id = app.current_user_id());

grant select (
  id, name, slug, website_url, careers_url, logo_url, industry, country,
  ats_provider, source_type, crawl_allowed, crawl_status, crawl_frequency_minutes,
  last_checked_at, last_successful_check_at, next_check_at, consecutive_failures,
  active, created_at, updated_at
) on app.company to offerlab_app;
grant update (crawl_allowed, crawl_status, updated_at) on app.company to offerlab_app;
grant select (
  id, company_id, slug, external_job_id, source_url, application_url, title,
  normalized_title, location_text, city, region, country, remote_type,
  employment_type, seniority_level, job_category, salary_min, salary_max,
  salary_currency, salary_period, description_summary, responsibilities,
  requirements, skills, preferred_skills, degree_requirements,
  experience_requirements, visa_sponsorship_status, visa_sponsorship_evidence,
  application_deadline, posted_at, first_seen_at, last_seen_at, last_changed_at,
  missed_crawls, enrichment_status, enrichment_model, enrichment_version, active,
  created_at, updated_at, search_vector
) on app.job to offerlab_app;
grant select on app.job_ingestion_run, app.job_source_event to offerlab_app;
grant select, insert, update, delete on app.company, app.job,
  app.job_ingestion_run, app.job_source_event
  to offerlab_crawler;
grant select, insert, delete on app.user_saved_job to offerlab_app;

revoke all on app.company, app.job, app.job_ingestion_run, app.job_source_event,
  app.user_saved_job
  from public, anon, authenticated, offerlab_identity_sync;

comment on table app.company is
  'Employer source registry. The crawler only processes sources with crawl_allowed=allowed; unknown and blocked sources are never crawled automatically.';
comment on table app.job is
  'Normalized job records sourced from employer career sites and ATS job board APIs. source_payload and description fields are plain text or structured data only; external HTML is never rendered.';
comment on table app.job_ingestion_run is
  'Per-source crawl observability: timing, outcome counts, and error summary.';
comment on table app.job_source_event is
  'Append-only source-level audit trail for debugging source behaviour.';
comment on table app.user_saved_job is
  'Owner-scoped member saves of public catalog jobs.';

commit;
