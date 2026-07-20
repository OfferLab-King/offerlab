begin;

create table app.application (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references app."user"(id) on delete restrict,
  company_name text not null,
  role_title text not null,
  opportunity_type text not null,
  industry text,
  current_stage text not null,
  location text,
  application_deadline date,
  applied_date date,
  next_stage_deadline date,
  notes text,
  archived_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint application_company_check check (
    company_name <> ''
    and company_name = btrim(company_name)
    and company_name = regexp_replace(company_name, '[[:space:]]+', ' ', 'g')
    and char_length(company_name) <= 120
  ),
  constraint application_role_check check (
    role_title <> ''
    and role_title = btrim(role_title)
    and role_title = regexp_replace(role_title, '[[:space:]]+', ' ', 'g')
    and char_length(role_title) <= 160
  ),
  constraint application_opportunity_type_check check (
    opportunity_type in ('graduate_scheme', 'internship', 'placement', 'entry_level_role')
  ),
  constraint application_industry_check check (
    industry is null or industry in (
      'consulting', 'accounting_professional_services', 'financial_services', 'technology',
      'public_sector', 'consumer_retail', 'general_corporate', 'other'
    )
  ),
  constraint application_stage_check check (
    current_stage in (
      'preparing', 'applied', 'online_assessment', 'video_interview', 'interview',
      'assessment_centre', 'offer', 'rejected', 'withdrawn'
    )
  ),
  constraint application_location_check check (
    location is null or (
      location <> ''
      and location = btrim(location)
      and location = regexp_replace(location, '[[:space:]]+', ' ', 'g')
      and char_length(location) <= 120
    )
  ),
  constraint application_notes_check check (
    notes is null or (notes <> '' and notes = btrim(notes) and char_length(notes) <= 2000)
  ),
  constraint application_version_check check (version > 0),
  constraint application_timestamps_check check (
    updated_at >= created_at
    and (archived_at is null or (archived_at >= created_at and archived_at <= updated_at))
  )
);

create index application_owner_active_deadline_idx
on app.application (owner_user_id, next_stage_deadline, application_deadline)
where archived_at is null;

create index application_owner_archived_idx
on app.application (owner_user_id, archived_at desc)
where archived_at is not null;

create function app.control_application_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.company_name is not distinct from old.company_name
    and new.role_title is not distinct from old.role_title
    and new.opportunity_type is not distinct from old.opportunity_type
    and new.industry is not distinct from old.industry
    and new.current_stage is not distinct from old.current_stage
    and new.location is not distinct from old.location
    and new.application_deadline is not distinct from old.application_deadline
    and new.applied_date is not distinct from old.applied_date
    and new.next_stage_deadline is not distinct from old.next_stage_deadline
    and new.notes is not distinct from old.notes
    and new.archived_at is not distinct from old.archived_at then
    new.version := old.version;
    new.updated_at := old.updated_at;
  else
    new.version := old.version + 1;
    new.updated_at := pg_catalog.clock_timestamp();
  end if;
  return new;
end
$$;

create trigger application_mutation_is_database_controlled
before update on app.application
for each row execute function app.control_application_mutation();

alter table app.application enable row level security;
alter table app.application force row level security;

create policy application_select_own
on app.application for select to offerlab_app
using (owner_user_id = app.current_user_id());

create policy application_insert_own
on app.application for insert to offerlab_app
with check (owner_user_id = app.current_user_id());

create policy application_update_own
on app.application for update to offerlab_app
using (owner_user_id = app.current_user_id())
with check (owner_user_id = app.current_user_id());

create policy audit_event_insert_own_application
on app.audit_event for insert to offerlab_app
with check (
  actor_user_id = app.current_user_id()
  and entity_type = 'application'
  and action in (
    'application.created', 'application.updated', 'application.stage_changed',
    'application.archived', 'application.restored'
  )
  and metadata = '{}'::jsonb
);

grant select, insert, update on app.application to offerlab_app;
revoke all on app.application from public, anon, authenticated, offerlab_identity_sync;
revoke all on function app.control_application_mutation()
  from public, anon, authenticated, offerlab_identity_sync;
grant execute on function app.control_application_mutation() to offerlab_app;

comment on table app.application is
  'Private owner-scoped graduate-job applications. Soft archive preserves history.';
comment on column app.application.version is
  'Database-controlled optimistic concurrency token incremented by each meaningful mutation.';
comment on column app.application.notes is
  'Private member notes prohibited from analytics, audit metadata, logs, URLs, and page titles.';

commit;
