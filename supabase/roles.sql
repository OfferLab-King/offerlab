-- Local and CI login principals only. The migration creates the NOLOGIN
-- offerlab_auth_function_owner; it must never be granted to either login below.
-- Production principals are provisioned with supabase/snippets/provision-runtime-roles.sql.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'offerlab_runtime_login') then
    create role offerlab_runtime_login login password 'postgres'
      nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'offerlab_identity_sync_login') then
    create role offerlab_identity_sync_login login password 'postgres'
      nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
  end if;
end
$$;
