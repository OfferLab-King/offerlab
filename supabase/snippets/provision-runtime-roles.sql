-- Run once after migrations with psql variables supplied by the deployment
-- secret store. Never commit or echo the substituted password values.
\set ON_ERROR_STOP on

create role offerlab_runtime_login login password :'offerlab_runtime_password'
  nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
create role offerlab_identity_sync_login login password :'offerlab_identity_sync_password'
  nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
create role offerlab_crawler_login login password :'offerlab_crawler_password'
  nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;

grant offerlab_app to offerlab_runtime_login;
grant offerlab_crawler to offerlab_crawler_login;
grant offerlab_identity_sync to offerlab_identity_sync_login;

-- The migration, not this login-provisioning script, creates and owns functions
-- with offerlab_auth_function_owner. Confirm it exists with the required attributes
-- and confirm neither login is a member before accepting the hosted deployment.
select rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolinherit,
       rolreplication, rolbypassrls
from pg_roles
where rolname = 'offerlab_auth_function_owner';
