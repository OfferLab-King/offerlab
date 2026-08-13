begin;

-- Phase E: public employer directory and profile surface. The public view is
-- the privacy-safe contract between the researched universe and the public
-- routes: it exposes only verifiable employer facts (industry, size band,
-- ownership, ticker/exchange, sponsor presence and snapshot date, official
-- URLs, current roles) and NEVER internal research fields (priority tier,
-- internal rank, scores, identity confidence, research status, notes).

-- The view runs with the owner's rights (postgres), so it may read the
-- administrator-only research tables. Access is restricted by grant: only
-- offerlab_app (the server-rendered public route role) can select it.
-- Placeholder URLs (employer.invalid) are treated as absent so the public
-- surface never links to them.

create or replace view app.employer_public_profile
with (security_barrier = true)
as
with latest_snapshot as (
  select distinct on (company_id) *
  from app.employer_research_snapshot
  where company_id is not null
  order by company_id, research_date desc, dataset_version desc
),
current_jobs as (
  select j.company_id, count(*)::int as current_jobs
  from app.job j
  where j.active
    and j.publication_status = 'published'
    and j.eligibility_status = 'eligible'
    and (j.application_deadline is null or j.application_deadline >= now())
  group by j.company_id
),
live_sources as (
  select s.company_id, count(*)::int as live_sources
  from app.job_source s
  group by s.company_id
),
sponsor_presence as (
  select e.company_id, bool_or(e.active_in_snapshot) as has_sponsor,
    max(e.source_snapshot_date) as sponsor_snapshot_date
  from app.employer_sponsor_entity e
  where e.company_id is not null
  group by e.company_id
)
select
  c.id,
  c.slug,
  c.name,
  c.logo_url,
  c.description,
  c.directory_visible,
  nullif(c.website_url, '') as website_url,
  nullif(c.careers_url, '') as careers_url,
  c.employer_industry_key,
  c.employer_subindustry_key,
  s.employee_band,
  s.employee_scope,
  s.ownership_type,
  s.ticker,
  s.exchange,
  s.research_date as facts_as_of,
  coalesce(sp.has_sponsor, false) as has_sponsor,
  sp.sponsor_snapshot_date,
  coalesce(cj.current_jobs, 0) as current_jobs,
  coalesce(ls.live_sources, 0) as live_sources
from app.company c
left join latest_snapshot s on s.company_id = c.id
left join current_jobs cj on cj.company_id = c.id
left join live_sources ls on ls.company_id = c.id
left join sponsor_presence sp on sp.company_id = c.id
where c.active
  and (
    nullif(c.website_url, '') not like '%employer.invalid%'
    or nullif(c.careers_url, '') not like '%employer.invalid%'
    or coalesce(cj.current_jobs, 0) > 0
  );

grant select on app.employer_public_profile to offerlab_app;

comment on view app.employer_public_profile is
  'Privacy-safe public employer facts derived from the researched universe; internal research fields are never exposed.';

commit;
