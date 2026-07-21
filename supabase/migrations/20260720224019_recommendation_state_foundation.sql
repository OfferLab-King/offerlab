begin;

alter table app.application
add constraint application_owner_id_unique unique (owner_user_id, id);

create table app.recommendation_state (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references app."user"(id) on delete restrict,
  application_id uuid not null,
  recommendation_key text not null,
  rule_version integer not null,
  state text not null default 'pending',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  dismissed_at timestamptz,
  constraint recommendation_state_application_owner_fk
    foreign key (owner_user_id, application_id)
    references app.application (owner_user_id, id)
    on delete restrict,
  constraint recommendation_state_key_check check (
    recommendation_key ~ '^[a-z][a-z0-9_]{0,79}$'
  ),
  constraint recommendation_state_rule_version_check check (rule_version > 0),
  constraint recommendation_state_state_check check (
    state in ('pending', 'completed', 'dismissed')
  ),
  constraint recommendation_state_version_check check (version > 0),
  constraint recommendation_state_timestamps_check check (
    updated_at >= created_at
    and (completed_at is null or completed_at between created_at and updated_at)
    and (dismissed_at is null or dismissed_at between created_at and updated_at)
  ),
  constraint recommendation_state_transition_timestamps_check check (
    (state = 'pending' and completed_at is null and dismissed_at is null)
    or (state = 'completed' and completed_at is not null and dismissed_at is null)
    or (state = 'dismissed' and completed_at is null and dismissed_at is not null)
  ),
  constraint recommendation_state_identity_unique unique (
    owner_user_id,
    application_id,
    recommendation_key,
    rule_version
  )
);

create index recommendation_state_owner_application_state_idx
on app.recommendation_state (owner_user_id, application_id, state);

create function app.control_recommendation_state_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
declare
  mutation_timestamp timestamptz;
begin
  if tg_op = 'INSERT' then
    mutation_timestamp := pg_catalog.clock_timestamp();
    new.version := 1;
    new.created_at := mutation_timestamp;
    new.updated_at := mutation_timestamp;
    new.completed_at := case when new.state = 'completed' then mutation_timestamp else null end;
    new.dismissed_at := case when new.state = 'dismissed' then mutation_timestamp else null end;
    return new;
  end if;

  if new.id is distinct from old.id
    or new.owner_user_id is distinct from old.owner_user_id
    or new.application_id is distinct from old.application_id
    or new.recommendation_key is distinct from old.recommendation_key
    or new.rule_version is distinct from old.rule_version then
    raise exception using
      errcode = '23514',
      message = 'recommendation_state_identity_is_immutable';
  end if;

  new.created_at := old.created_at;

  if new.state is not distinct from old.state then
    new.version := old.version;
    new.updated_at := old.updated_at;
    new.completed_at := old.completed_at;
    new.dismissed_at := old.dismissed_at;
  else
    mutation_timestamp := pg_catalog.clock_timestamp();
    new.version := old.version + 1;
    new.updated_at := mutation_timestamp;
    new.completed_at := case when new.state = 'completed' then mutation_timestamp else null end;
    new.dismissed_at := case when new.state = 'dismissed' then mutation_timestamp else null end;
  end if;

  return new;
end
$$;

create trigger recommendation_state_mutation_is_database_controlled
before insert or update on app.recommendation_state
for each row execute function app.control_recommendation_state_mutation();

alter table app.recommendation_state enable row level security;
alter table app.recommendation_state force row level security;

create policy recommendation_state_select_own
on app.recommendation_state for select to offerlab_app
using (owner_user_id = app.current_user_id());

create policy recommendation_state_insert_own
on app.recommendation_state for insert to offerlab_app
with check (owner_user_id = app.current_user_id());

create policy recommendation_state_update_own
on app.recommendation_state for update to offerlab_app
using (owner_user_id = app.current_user_id())
with check (owner_user_id = app.current_user_id());

create policy audit_event_insert_own_recommendation_state
on app.audit_event for insert to offerlab_app
with check (
  actor_user_id = app.current_user_id()
  and entity_type = 'recommendation_state'
  and action in (
    'recommendation.completed',
    'recommendation.dismissed',
    'recommendation.restored'
  )
  and metadata = '{}'::jsonb
  and exists (
    select 1
    from app.recommendation_state as recommendation_state
    where recommendation_state.id = entity_id
      and recommendation_state.owner_user_id = app.current_user_id()
  )
);

revoke all on app.recommendation_state
  from public, anon, authenticated, offerlab_identity_sync, offerlab_auth_function_owner;
grant select, insert, update on app.recommendation_state to offerlab_app;
grant insert (actor_user_id, action, entity_type, entity_id, metadata)
  on app.audit_event to offerlab_app;

revoke all on function app.control_recommendation_state_mutation()
  from public, anon, authenticated, offerlab_identity_sync, offerlab_auth_function_owner;
grant execute on function app.control_recommendation_state_mutation() to offerlab_app;

comment on table app.recommendation_state is
  'Owner-scoped interaction state for code-owned, deterministic recommendations. Generated recommendation content is not persisted.';
comment on column app.recommendation_state.recommendation_key is
  'Stable code-catalogue key. PostgreSQL enforces only its bounded machine-key shape; catalogue applicability is enforced by the application.';
comment on column app.recommendation_state.version is
  'Database-controlled optimistic concurrency token incremented once per meaningful state transition.';

commit;
