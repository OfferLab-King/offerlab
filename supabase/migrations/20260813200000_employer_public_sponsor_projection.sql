begin;

-- Narrow privacy-safe sponsor projection for the hot public job search path.
--
-- `app.employer_public_profile` is the full public employer contract and its
-- derivation aggregates the whole job catalogue (`current_jobs`, `live_sources`,
-- aliases). The job search hot path only needs employer sponsor presence, so it
-- must not materialise those aggregates per request. This view exposes exactly
-- the sponsor facts the public search already displays (mirroring the
-- `has_sponsor` / `sponsor_snapshot_date` semantics of
-- `app.employer_public_profile`) while the restricted research table
-- `app.employer_sponsor_entity` stays administrator-only.
--
-- Source of truth: `app.employer_sponsor_entity`. This view is derived, never
-- written; sponsor register refresh and identity matching continue to maintain
-- the underlying rows.
create or replace view app.employer_public_sponsor
with (security_barrier = true)
as
select e.company_id,
  bool_or(e.active_in_snapshot) as has_sponsor,
  max(e.source_snapshot_date) as sponsor_snapshot_date
from app.employer_sponsor_entity e
where e.company_id is not null
group by e.company_id;

grant select on app.employer_public_sponsor to offerlab_app;
grant select on app.employer_public_sponsor to offerlab_crawler;
revoke all on app.employer_public_sponsor from public, anon, authenticated,
  offerlab_identity_sync;

comment on view app.employer_public_sponsor is
  'Narrow public sponsor-presence projection (company_id, has_sponsor, sponsor_snapshot_date) for hot job search paths; derived from the administrator-only sponsor entity register.';

-- Narrow public employer search projection for autocomplete and directory
-- filter options. Matches the name/alias matching and facts contract of
-- `app.employer_public_profile` (aliases are trading names and sponsor legal
-- entities; employee facts come from the latest research snapshot) without
-- materialising the catalogue-wide aggregates that profile view computes.
create or replace view app.employer_public_search
with (security_barrier = true)
as
with latest_snapshot as (
  select distinct on (company_id) company_id, employee_band, ownership_type
  from app.employer_research_snapshot
  where company_id is not null
  order by company_id, research_date desc, dataset_version desc
)
select c.id,
  c.slug,
  c.name,
  c.logo_url,
  c.employer_industry_key,
  nullif(c.website_url, '') as website_url,
  nullif(c.careers_url, '') as careers_url,
  s.employee_band,
  s.ownership_type,
  coalesce(
    (select jsonb_agg(a.alias order by a.alias)
     from app.employer_alias a
     where a.company_id = c.id),
    '[]'::jsonb
  ) as aliases
from app.company c
left join latest_snapshot s on s.company_id = c.id
where c.active
  and (
    nullif(c.website_url, '') not like '%employer.invalid%'
    or nullif(c.careers_url, '') not like '%employer.invalid%'
  );

grant select on app.employer_public_search to offerlab_app;
grant select on app.employer_public_search to offerlab_crawler;
revoke all on app.employer_public_search from public, anon, authenticated,
  offerlab_identity_sync;

comment on view app.employer_public_search is
  'Narrow public employer name/alias search projection for autocomplete; no catalogue aggregates.';

commit;
