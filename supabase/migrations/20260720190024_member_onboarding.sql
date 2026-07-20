begin;

create function app.onboarding_controlled_array_valid(
  p_values text[],
  p_allowed text[],
  p_maximum integer
)
returns boolean
language sql
immutable
parallel safe
strict
set search_path = pg_catalog
as $$
  select
    pg_catalog.cardinality(p_values) between 0 and p_maximum
    and pg_catalog.array_position(p_values, null) is null
    and p_values <@ p_allowed
    and pg_catalog.cardinality(p_values) = (
      select pg_catalog.count(distinct item)
      from pg_catalog.unnest(p_values) as item
    )
$$;

create function app.onboarding_target_companies_valid(p_values text[])
returns boolean
language sql
immutable
parallel safe
strict
set search_path = pg_catalog
as $$
  select
    pg_catalog.cardinality(p_values) between 0 and 10
    and pg_catalog.array_position(p_values, null) is null
    and pg_catalog.char_length(pg_catalog.array_to_string(p_values, '')) <= 800
    and not exists (
      select 1
      from pg_catalog.unnest(p_values) as company(value)
      where company.value = ''
        or company.value <> pg_catalog.btrim(company.value)
        or pg_catalog.char_length(company.value) > 80
        or company.value <> pg_catalog.regexp_replace(
          company.value,
          '[[:space:]]+',
          ' ',
          'g'
        )
    )
    and pg_catalog.cardinality(p_values) = (
      select pg_catalog.count(distinct pg_catalog.lower(company.value))
      from pg_catalog.unnest(p_values) as company(value)
    )
$$;

create table app.onboarding_profile (
  user_id uuid primary key references app."user"(id) on delete restrict,
  education_stage text,
  opportunity_types text[] not null default '{}',
  industries text[] not null default '{}',
  preparation_priorities text[] not null default '{}',
  target_companies text[] not null default '{}',
  support_needs text[] not null default '{}',
  confidence text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint onboarding_education_stage_check check (
    education_stage is null or education_stage in ('undergraduate', 'postgraduate', 'recent_graduate')
  ),
  constraint onboarding_opportunity_types_check check (
    app.onboarding_controlled_array_valid(
      opportunity_types,
      array['graduate_scheme', 'internship', 'placement', 'entry_level_role']::text[],
      4
    )
  ),
  constraint onboarding_industries_check check (
    app.onboarding_controlled_array_valid(
      industries,
      array[
        'consulting', 'accounting_professional_services', 'financial_services', 'technology',
        'public_sector', 'consumer_retail', 'general_corporate', 'other'
      ]::text[],
      8
    )
  ),
  constraint onboarding_preparation_priorities_check check (
    app.onboarding_controlled_array_valid(
      preparation_priorities,
      array[
        'application_cv', 'online_tests', 'video_interview', 'behavioural_interview',
        'assessment_centre', 'motivation_commercial_awareness',
        'professional_communication', 'application_planning'
      ]::text[],
      8
    )
  ),
  constraint onboarding_target_companies_check check (
    app.onboarding_target_companies_valid(target_companies)
  ),
  constraint onboarding_support_needs_check check (
    app.onboarding_controlled_array_valid(
      support_needs,
      array[
        'structured_plan', 'feedback', 'interview_practice', 'assessment_centre_practice',
        'accountability', 'international_student_guidance'
      ]::text[],
      6
    )
  ),
  constraint onboarding_confidence_check check (
    confidence is null or confidence in ('building', 'mixed', 'confident')
  ),
  constraint onboarding_timestamps_check check (
    updated_at >= created_at and (completed_at is null or completed_at >= created_at)
  ),
  constraint onboarding_completion_derived_check check (
    (completed_at is not null) = (
      education_stage is not null
      and cardinality(opportunity_types) > 0
      and cardinality(industries) > 0
      and cardinality(preparation_priorities) > 0
    )
  )
);

create function app.prevent_onboarding_completion_reversion()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if old.completed_at is not null and new.completed_at is distinct from old.completed_at then
    raise exception using
      errcode = '23514',
      message = 'onboarding_completion_cannot_revert_or_change';
  end if;
  return new;
end
$$;

create trigger onboarding_completion_is_permanent
before update on app.onboarding_profile
for each row execute function app.prevent_onboarding_completion_reversion();

alter table app.onboarding_profile enable row level security;
alter table app.onboarding_profile force row level security;

create policy onboarding_profile_select_own
on app.onboarding_profile for select to offerlab_app
using (user_id = app.current_user_id());

create policy onboarding_profile_insert_own
on app.onboarding_profile for insert to offerlab_app
with check (user_id = app.current_user_id());

create policy onboarding_profile_update_own
on app.onboarding_profile for update to offerlab_app
using (user_id = app.current_user_id())
with check (user_id = app.current_user_id());

create policy audit_event_insert_own_onboarding
on app.audit_event for insert to offerlab_app
with check (
  actor_user_id = app.current_user_id()
  and entity_type = 'onboarding_profile'
  and entity_id = app.current_user_id()
  and action in ('onboarding.completed', 'onboarding.updated')
  and metadata = '{}'::jsonb
);

grant select, insert, update on app.onboarding_profile to offerlab_app;
grant insert (actor_user_id, action, entity_type, entity_id, metadata)
  on app.audit_event to offerlab_app;

create unique index onboarding_first_completion_audit_unique
on app.audit_event (entity_id, action)
where entity_type = 'onboarding_profile' and action = 'onboarding.completed';

revoke all on function app.onboarding_controlled_array_valid(text[], text[], integer)
  from public, anon, authenticated, offerlab_identity_sync;
revoke all on function app.onboarding_target_companies_valid(text[])
  from public, anon, authenticated, offerlab_identity_sync;
revoke all on function app.prevent_onboarding_completion_reversion()
  from public, anon, authenticated, offerlab_identity_sync;
grant execute on function app.onboarding_controlled_array_valid(text[], text[], integer)
  to offerlab_app;
grant execute on function app.onboarding_target_companies_valid(text[])
  to offerlab_app;
grant execute on function app.prevent_onboarding_completion_reversion()
  to offerlab_app;

comment on table app.onboarding_profile is
  'One current, owner-scoped onboarding profile per internal OfferLab user.';
comment on column app.onboarding_profile.completed_at is
  'Set by the server exactly when all required controlled fields are valid; protected by a table constraint.';
comment on column app.onboarding_profile.target_companies is
  'Optional canonical company display names. PostgreSQL enforces trim, whitespace collapse, length, count, and case-insensitive uniqueness; the application also applies Unicode NFC.';

commit;
