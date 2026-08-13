begin;

-- Phase G: member integration with canonical employers.
-- - Owner-scoped saved employers with forced RLS (mirrors user_saved_job).
-- - Applications and career job targets gain an optional canonical company_id
--   while preserving free-text fallback.
-- - Onboarding gains taxonomy-aligned preference dimensions (target
--   industries, job functions, preferred locations) alongside the legacy
--   columns; the completion rule is unchanged.
-- - The public employer profile view exposes employer aliases so member
--   autocomplete can match trading names and sponsor legal entities.

create table app.user_saved_employer (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references app."user"(id) on delete restrict,
  company_id uuid not null references app.company(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint user_saved_employer_owner_id_unique unique(owner_user_id, id)
);

create unique index user_saved_employer_identity_unique
  on app.user_saved_employer (owner_user_id, company_id);
create index user_saved_employer_owner_created_idx
  on app.user_saved_employer (owner_user_id, created_at desc);

alter table app.user_saved_employer enable row level security;
alter table app.user_saved_employer force row level security;

create policy user_saved_employer_owner_access on app.user_saved_employer
  for all to offerlab_app
  using (owner_user_id = app.current_user_id())
  with check (owner_user_id = app.current_user_id());

grant select, insert, update, delete on app.user_saved_employer to offerlab_app;
revoke all on app.user_saved_employer from public, anon, authenticated, offerlab_identity_sync, offerlab_crawler;

comment on table app.user_saved_employer is
  'Owner-scoped saved employers; never used to create notifications without member preference.';

alter table app.application
  add column company_id uuid references app.company(id) on delete set null;

alter table app.career_job_target
  add column company_id uuid references app.company(id) on delete set null;

create index application_company_idx on app.application (company_id) where company_id is not null;
create index career_job_target_company_idx on app.career_job_target (company_id) where company_id is not null;

create function app.onboarding_preferred_locations_valid(locations text[])
returns boolean
language sql
immutable
return (
  select bool_and(entry = lower(btrim(entry)) and char_length(entry) between 1 and 80)
  from unnest(locations) as entry
);

grant execute on function app.onboarding_preferred_locations_valid(text[]) to offerlab_app;

alter table app.onboarding_profile
  add column target_industries text[] not null default '{}',
  add column target_functions text[] not null default '{}',
  add column preferred_locations text[] not null default '{}',
  add constraint onboarding_target_industries_check check (
    app.onboarding_controlled_array_valid(
      target_industries,
      array[
        'financial_services', 'professional_services_consulting', 'technology_software',
        'engineering_manufacturing', 'energy_utilities_infrastructure',
        'consumer_retail_fmcg', 'healthcare_pharma_life_sciences',
        'media_telecom_entertainment', 'transport_logistics_travel',
        'real_estate_construction', 'legal_services', 'public_sector_government',
        'education_research', 'charity_nonprofit', 'hospitality_leisure', 'other'
      ]::text[],
      8
    )
  ),
  add constraint onboarding_target_functions_check check (
    app.onboarding_controlled_array_valid(
      target_functions,
      array[
        'finance_accounting', 'investment_banking_corporate_finance',
        'markets_trading_research', 'asset_wealth_investment_management',
        'consulting_strategy', 'software_engineering', 'data_analytics_ai',
        'product_management', 'cybersecurity_it', 'engineering', 'science_research',
        'operations_supply_chain', 'project_programme_management',
        'sales_business_development', 'marketing_communications',
        'human_resources_recruitment', 'legal', 'risk_compliance_controls',
        'customer_service', 'design_ux', 'healthcare_clinical',
        'public_policy_government', 'administration', 'other'
      ]::text[],
      8
    )
  ),
  add constraint onboarding_preferred_locations_check check (
    array_length(preferred_locations, 1) is null
    or (
      array_length(preferred_locations, 1) between 1 and 12
      and app.onboarding_preferred_locations_valid(preferred_locations)
    )
  );

comment on column app.onboarding_profile.target_industries is
  'Canonical employer-industry preferences (Phase G); legacy industries column retained.';
comment on column app.onboarding_profile.target_functions is
  'Canonical job-function preferences (Phase G).';
comment on column app.onboarding_profile.preferred_locations is
  'Lower-cased preferred city/region labels for transparent job discovery.';

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
  coalesce(ls.live_sources, 0) as live_sources,
  coalesce(
    (select jsonb_agg(a.alias order by a.alias)
     from app.employer_alias a
     where a.company_id = c.id),
    '[]'::jsonb
  ) as aliases
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

comment on view app.employer_public_profile is
  'Privacy-safe public employer facts derived from the researched universe; internal research fields are never exposed.';

commit;
