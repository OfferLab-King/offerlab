begin;

create function app.link_open_member_identity(p_auth_user_id uuid)
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

  insert into app."user" (auth_user_id, email, role)
  values (p_auth_user_id, normalized_email, 'member')
  returning id, app."user".role into existing_user_id, existing_role;

  insert into app.beta_entitlement (user_id, status, activated_at, updated_at)
  values (existing_user_id, 'active', statement_timestamp(), statement_timestamp());

  insert into app.audit_event (actor_user_id, action, entity_type, entity_id, metadata)
  values
    (existing_user_id, 'identity.linked', 'user', existing_user_id, '{}'::jsonb),
    (existing_user_id, 'beta_entitlement.activated', 'user', existing_user_id, '{}'::jsonb);

  return query select existing_user_id, existing_role, 'active'::text;
end
$$;

revoke all on function app.link_open_member_identity(uuid) from public, anon, authenticated, offerlab_app;
grant execute on function app.link_open_member_identity(uuid) to offerlab_identity_sync;

comment on table app.invitation is
  'Inactive legacy invite-only registration data retained for non-destructive history. Open registration does not read or write this table.';
comment on function app.link_open_member_identity(uuid) is
  'Managed-migration-owned, narrowly granted gateway that idempotently links one verified Supabase identity as a normal member without invitation state.';

commit;
