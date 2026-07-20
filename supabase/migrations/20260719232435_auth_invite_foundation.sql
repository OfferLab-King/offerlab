begin;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'offerlab_identity_sync') then
    create role offerlab_identity_sync nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'offerlab_auth_function_owner') then
    create role offerlab_auth_function_owner
      nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
  end if;
end
$$;

grant usage on schema app to offerlab_identity_sync;
grant usage on schema app to offerlab_auth_function_owner;

create view app.auth_user_identity
with (security_barrier = true)
as
select auth_user.id, auth_user.email, auth_user.email_confirmed_at
from auth.users as auth_user;

revoke all on app.auth_user_identity from public, anon, authenticated, offerlab_app, offerlab_identity_sync;
grant select on app.auth_user_identity to offerlab_auth_function_owner;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'offerlab_runtime_login') then
    grant offerlab_app to offerlab_runtime_login;
  end if;
  if exists (select 1 from pg_roles where rolname = 'offerlab_identity_sync_login') then
    grant offerlab_identity_sync to offerlab_identity_sync_login;
  end if;
end
$$;

create table app.invitation (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token_hash text not null,
  expires_at timestamptz not null,
  bound_auth_user_id uuid references auth.users(id) on delete restrict,
  bound_at timestamptz,
  revoked_at timestamptz,
  consumed_at timestamptz,
  consumed_by_user_id uuid references app."user"(id) on delete restrict,
  created_at timestamptz not null default now(),
  created_by_user_id uuid references app."user"(id) on delete restrict,
  constraint invitation_email_normalized check (email = lower(btrim(email))),
  constraint invitation_token_hash_format check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint invitation_expiry_after_creation check (expires_at > created_at),
  constraint invitation_binding_complete check (
    (bound_at is null and bound_auth_user_id is null)
    or (bound_at is not null and bound_auth_user_id is not null and bound_at >= created_at)
  ),
  constraint invitation_consumption_complete check (
    (consumed_at is null and consumed_by_user_id is null)
    or (
      consumed_at is not null
      and consumed_by_user_id is not null
      and bound_auth_user_id is not null
      and consumed_at >= created_at
      and consumed_at >= bound_at
    )
  ),
  constraint invitation_revocation_after_creation check (
    revoked_at is null or revoked_at >= created_at
  ),
  constraint invitation_final_state_exclusive check (
    not (revoked_at is not null and consumed_at is not null)
  )
);

create unique index invitation_token_hash_unique on app.invitation (token_hash);
create index invitation_email_lookup on app.invitation (email, created_at desc);
create index invitation_bound_identity_lookup
on app.invitation (bound_auth_user_id, bound_at desc)
where bound_auth_user_id is not null;

alter table app.invitation enable row level security;
alter table app.invitation force row level security;

comment on column app.invitation.token_hash is
  'SHA-256 hash of a cryptographically random invitation token. Raw tokens must never be stored.';

create table app.beta_entitlement (
  user_id uuid primary key references app."user"(id) on delete restrict,
  status text not null,
  activated_at timestamptz not null,
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint beta_entitlement_status_check check (status in ('active', 'revoked')),
  constraint beta_entitlement_revocation_check check (
    (status = 'active' and revoked_at is null)
    or (status = 'revoked' and revoked_at is not null and revoked_at >= activated_at)
  ),
  constraint beta_entitlement_update_check check (updated_at >= activated_at)
);

alter table app.beta_entitlement enable row level security;
alter table app.beta_entitlement force row level security;

create table app.auth_rate_limit (
  action text not null,
  key_hash text not null,
  window_started_at timestamptz not null,
  attempt_count integer not null,
  primary key (action, key_hash),
  constraint auth_rate_limit_action_check check (
    action in ('registration', 'identity_link', 'recovery', 'verification_resend')
  ),
  constraint auth_rate_limit_key_hash_check check (key_hash ~ '^[0-9a-f]{64}$'),
  constraint auth_rate_limit_attempt_count_check check (attempt_count > 0)
);

create index auth_rate_limit_window_started_at_idx
on app.auth_rate_limit (window_started_at);

alter table app.auth_rate_limit enable row level security;
alter table app.auth_rate_limit force row level security;

create policy auth_function_owner_invitation_select
on app.invitation for select to offerlab_auth_function_owner using (true);
create policy auth_function_owner_invitation_update
on app.invitation for update to offerlab_auth_function_owner using (true) with check (true);
create policy auth_function_owner_user_select
on app."user" for select to offerlab_auth_function_owner using (true);
create policy auth_function_owner_user_insert
on app."user" for insert to offerlab_auth_function_owner with check (true);
create policy auth_function_owner_entitlement_select
on app.beta_entitlement for select to offerlab_auth_function_owner using (true);
create policy auth_function_owner_entitlement_insert
on app.beta_entitlement for insert to offerlab_auth_function_owner with check (true);
create policy auth_function_owner_audit_insert
on app.audit_event for insert to offerlab_auth_function_owner with check (true);
create policy auth_function_owner_rate_limit_insert
on app.auth_rate_limit for insert to offerlab_auth_function_owner with check (true);
create policy auth_function_owner_rate_limit_select
on app.auth_rate_limit for select to offerlab_auth_function_owner using (true);
create policy auth_function_owner_rate_limit_update
on app.auth_rate_limit for update to offerlab_auth_function_owner using (true) with check (true);
create policy auth_function_owner_rate_limit_delete
on app.auth_rate_limit for delete to offerlab_auth_function_owner using (true);

grant select on app.invitation, app."user", app.beta_entitlement to offerlab_auth_function_owner;
grant update (bound_auth_user_id, bound_at, consumed_at, consumed_by_user_id)
  on app.invitation to offerlab_auth_function_owner;
grant insert (auth_user_id, email) on app."user" to offerlab_auth_function_owner;
grant insert (user_id, status, activated_at, updated_at)
  on app.beta_entitlement to offerlab_auth_function_owner;
grant insert (actor_user_id, action, entity_type, entity_id, metadata)
  on app.audit_event to offerlab_auth_function_owner;
grant select, insert, update, delete on app.auth_rate_limit to offerlab_auth_function_owner;

create policy beta_entitlement_select_own
on app.beta_entitlement
for select
to offerlab_app
using (user_id = app.current_user_id());

grant select on app.beta_entitlement to offerlab_app;

create function app.invitation_is_usable(p_token_hash text, p_email text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from app.invitation as invitation
    where invitation.token_hash = p_token_hash
      and invitation.email = lower(btrim(p_email))
      and invitation.revoked_at is null
      and invitation.consumed_at is null
      and invitation.expires_at > statement_timestamp()
  )
$$;

create function app.bind_invitation_to_identity(p_token_hash text, p_auth_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  normalized_email text;
  invitation_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_auth_user_id::text, 0));

  select lower(btrim(auth_user.email))
  into normalized_email
  from app.auth_user_identity as auth_user
  where auth_user.id = p_auth_user_id
    and auth_user.email is not null;

  if normalized_email is null then
    return false;
  end if;

  if exists (
    select 1
    from app.invitation as existing_binding
    where existing_binding.bound_auth_user_id = p_auth_user_id
      and existing_binding.revoked_at is null
      and existing_binding.consumed_at is null
      and existing_binding.expires_at > statement_timestamp()
      and existing_binding.token_hash <> p_token_hash
  ) then
    return false;
  end if;

  update app.invitation as invitation
  set bound_auth_user_id = p_auth_user_id,
      bound_at = coalesce(invitation.bound_at, statement_timestamp())
  where invitation.token_hash = p_token_hash
    and invitation.email = normalized_email
    and invitation.revoked_at is null
    and invitation.consumed_at is null
    and invitation.expires_at > statement_timestamp()
    and (invitation.bound_auth_user_id is null or invitation.bound_auth_user_id = p_auth_user_id)
  returning invitation.id into invitation_id;

  return invitation_id is not null;
end
$$;

create function app.authorization_for_identity(p_auth_user_id uuid)
returns table (user_id uuid, role text, entitlement_status text)
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select app_user.id, app_user.role, entitlement.status
  from app."user" as app_user
  left join app.beta_entitlement as entitlement on entitlement.user_id = app_user.id
  where app_user.auth_user_id = p_auth_user_id
$$;

create function app.link_verified_identity(p_auth_user_id uuid)
returns table (user_id uuid, role text, entitlement_status text)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  normalized_email text;
  verified_at timestamptz;
  existing_user_id uuid;
  existing_role text;
  invitation_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_auth_user_id::text, 0));

  select lower(btrim(auth_user.email)), auth_user.email_confirmed_at
  into normalized_email, verified_at
  from app.auth_user_identity as auth_user
  where auth_user.id = p_auth_user_id;

  if verified_at is null or normalized_email is null then
    raise exception using errcode = 'P0001', message = 'offerlab_unverified_identity';
  end if;

  select app_user.id, app_user.role
  into existing_user_id, existing_role
  from app."user" as app_user
  where app_user.auth_user_id = p_auth_user_id;

  if existing_user_id is not null then
    return query
      select existing_user_id, existing_role, entitlement.status
      from app.beta_entitlement as entitlement
      where entitlement.user_id = existing_user_id;
    if not found then
      return query select existing_user_id, existing_role, null::text;
    end if;
    return;
  end if;

  if exists (select 1 from app."user" as email_owner where lower(email_owner.email) = normalized_email) then
    raise exception using errcode = 'P0001', message = 'offerlab_duplicate_identity';
  end if;

  select invitation.id
  into invitation_id
  from app.invitation as invitation
  where invitation.bound_auth_user_id = p_auth_user_id
    and invitation.email = normalized_email
    and invitation.revoked_at is null
    and invitation.consumed_at is null
    and invitation.expires_at > statement_timestamp()
  order by invitation.bound_at desc
  limit 1
  for update;

  if invitation_id is null then
    raise exception using errcode = 'P0001', message = 'offerlab_invalid_invitation';
  end if;

  insert into app."user" (auth_user_id, email)
  values (p_auth_user_id, normalized_email)
  returning id, app."user".role into existing_user_id, existing_role;

  update app.invitation as invitation
  set consumed_at = statement_timestamp(), consumed_by_user_id = existing_user_id
  where invitation.id = invitation_id
    and invitation.bound_auth_user_id = p_auth_user_id
    and invitation.revoked_at is null
    and invitation.consumed_at is null
    and invitation.expires_at > statement_timestamp();

  if not found then
    raise exception using errcode = 'P0001', message = 'offerlab_invalid_invitation';
  end if;

  insert into app.beta_entitlement (user_id, status, activated_at, updated_at)
  values (existing_user_id, 'active', statement_timestamp(), statement_timestamp());

  insert into app.audit_event (actor_user_id, action, entity_type, entity_id, metadata)
  values
    (existing_user_id, 'invitation.consumed', 'invitation', invitation_id, '{}'::jsonb),
    (existing_user_id, 'identity.linked', 'user', existing_user_id, '{}'::jsonb),
    (existing_user_id, 'beta_entitlement.activated', 'user', existing_user_id, '{}'::jsonb);

  return query select existing_user_id, existing_role, 'active'::text;
end
$$;

create function app.check_auth_rate_limit(p_action text, p_key_hash text)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_attempt_limit integer;
  v_window_seconds integer;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_current_count integer;
  v_current_window timestamptz;
begin
  select limits.attempt_limit, limits.window_seconds
  into v_attempt_limit, v_window_seconds
  from (values
    ('registration'::text, 5, 900),
    ('identity_link'::text, 10, 900),
    ('recovery'::text, 5, 900),
    ('verification_resend'::text, 3, 900)
  ) as limits(action, attempt_limit, window_seconds)
  where limits.action = p_action;

  if v_attempt_limit is null or p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_rate_limit_input';
  end if;

  insert into app.auth_rate_limit as rate_limit (
    action, key_hash, window_started_at, attempt_count
  ) values (
    p_action, p_key_hash, v_now, 1
  )
  on conflict (action, key_hash) do update
  set window_started_at = case
        when rate_limit.window_started_at + pg_catalog.make_interval(secs => v_window_seconds) <= v_now
          then v_now
        else rate_limit.window_started_at
      end,
      attempt_count = case
        when rate_limit.window_started_at + pg_catalog.make_interval(secs => v_window_seconds) <= v_now
          then 1
        else rate_limit.attempt_count + 1
      end
  returning attempt_count, window_started_at into v_current_count, v_current_window;

  return query select
    v_current_count <= v_attempt_limit,
    greatest(
      1,
      ceil(extract(epoch from (
        v_current_window + pg_catalog.make_interval(secs => v_window_seconds) - v_now
      )))::integer
    );
end
$$;

create function app.cleanup_expired_auth_rate_limits()
returns integer
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_deleted integer;
begin
  with expired as (
    select rate_limit.action, rate_limit.key_hash
    from app.auth_rate_limit as rate_limit
    where rate_limit.window_started_at < pg_catalog.clock_timestamp() - interval '24 hours'
    order by rate_limit.window_started_at
    limit 500
    for update skip locked
  )
  delete from app.auth_rate_limit as rate_limit
  using expired
  where rate_limit.action = expired.action
    and rate_limit.key_hash = expired.key_hash;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end
$$;

grant offerlab_auth_function_owner to postgres;
grant create on schema app to offerlab_auth_function_owner;
alter function app.invitation_is_usable(text, text) owner to offerlab_auth_function_owner;
alter function app.bind_invitation_to_identity(text, uuid) owner to offerlab_auth_function_owner;
alter function app.authorization_for_identity(uuid) owner to offerlab_auth_function_owner;
alter function app.link_verified_identity(uuid) owner to offerlab_auth_function_owner;
alter function app.check_auth_rate_limit(text, text) owner to offerlab_auth_function_owner;
alter function app.cleanup_expired_auth_rate_limits() owner to offerlab_auth_function_owner;
revoke create on schema app from offerlab_auth_function_owner;

alter default privileges for role postgres revoke execute on functions from public;

revoke all on function app.invitation_is_usable(text, text) from public, anon, authenticated, offerlab_app;
revoke all on function app.bind_invitation_to_identity(text, uuid) from public, anon, authenticated, offerlab_app;
revoke all on function app.authorization_for_identity(uuid) from public, anon, authenticated, offerlab_app;
revoke all on function app.link_verified_identity(uuid) from public, anon, authenticated, offerlab_app;
revoke all on function app.check_auth_rate_limit(text, text) from public, anon, authenticated, offerlab_app;
revoke all on function app.cleanup_expired_auth_rate_limits() from public, anon, authenticated, offerlab_app;

grant execute on function app.invitation_is_usable(text, text) to offerlab_identity_sync;
grant execute on function app.bind_invitation_to_identity(text, uuid) to offerlab_identity_sync;
grant execute on function app.authorization_for_identity(uuid) to offerlab_identity_sync;
grant execute on function app.link_verified_identity(uuid) to offerlab_identity_sync;
grant execute on function app.check_auth_rate_limit(text, text) to offerlab_identity_sync;
grant execute on function app.cleanup_expired_auth_rate_limits() to offerlab_identity_sync;

comment on function app.link_verified_identity(uuid) is
  'Atomically links one verified Supabase identity to its exact bound invitation and entitlement.';
comment on function app.authorization_for_identity(uuid) is
  'Narrow authorization projection executable only by the isolated identity-sync principal.';

revoke offerlab_auth_function_owner from postgres;

commit;
