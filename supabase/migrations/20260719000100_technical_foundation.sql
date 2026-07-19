begin;

create schema if not exists app;
revoke all on schema app from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'offerlab_app') then
    create role offerlab_app nologin noinherit;
  end if;
end
$$;

grant offerlab_app to postgres;
grant usage on schema app to offerlab_app;

create function app.current_user_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.current_user_id', true), '')::uuid
$$;

revoke all on function app.current_user_id() from public, anon, authenticated;
grant execute on function app.current_user_id() to offerlab_app;

create table app."user" (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete restrict,
  email text not null,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_role_check check (role in ('member', 'administrator'))
);

create unique index user_auth_user_id_unique on app."user" (auth_user_id);
create unique index user_email_lower_unique on app."user" (lower(email));
create unique index user_single_administrator on app."user" (role)
where role = 'administrator';

alter table app."user" enable row level security;
alter table app."user" force row level security;

create policy user_select_own
on app."user"
for select
to offerlab_app
using (id = app.current_user_id());

grant select on app."user" to offerlab_app;

create table app.audit_event (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references app."user"(id) on delete restrict,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_event_entity_idx on app.audit_event (entity_type, entity_id);

alter table app.audit_event enable row level security;
alter table app.audit_event force row level security;

comment on table app.audit_event is
  'Append-only security and administrative audit events; deliberately separate from analytics.';
comment on column app.audit_event.metadata is
  'Allow-listed non-sensitive metadata only. Never store tokens, notes, passwords, or onboarding answers.';

commit;
