begin;

create extension if not exists pg_trgm with schema extensions;

create index if not exists company_name_trgm_idx
  on app.company using gin (name extensions.gin_trgm_ops);

create index if not exists employer_alias_text_trgm_idx
  on app.employer_alias using gin (alias extensions.gin_trgm_ops);

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
  case when c.careers_url like '%employer.invalid%' then null else nullif(c.careers_url, '') end as careers_url,
  s.employee_band,
  s.ownership_type,
  coalesce(
    (select jsonb_agg(a.alias order by a.alias)
     from app.employer_alias a
     where a.company_id = c.id),
    '[]'::jsonb
  ) as aliases,
  coalesce(sp.has_sponsor, false) as has_sponsor,
  sp.sponsor_snapshot_date
from app.company c
left join latest_snapshot s on s.company_id = c.id
left join app.employer_public_sponsor sp on sp.company_id = c.id
where c.active
  and (
    nullif(c.website_url, '') not like '%employer.invalid%'
    or nullif(c.careers_url, '') not like '%employer.invalid%'
    or coalesce(sp.has_sponsor, false)
  );

grant select on app.employer_public_search to offerlab_app, offerlab_crawler;
revoke all on app.employer_public_search from public, anon, authenticated,
  offerlab_identity_sync;

comment on view app.employer_public_search is
  'Narrow employer search projection including current licensed sponsor-only legal organisations; no internal research fields.';

commit;
