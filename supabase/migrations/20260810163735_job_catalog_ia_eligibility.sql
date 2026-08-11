begin;

-- Job catalogue information architecture, eligibility and publication pipeline.
-- Extends the 20260810120000 ingestion foundation with:
--  - sector / subsector taxonomy tables and explicit parent mapping;
--  - opportunity-type, eligibility and publication columns on app.job;
--  - multi-location support (app.job_location);
--  - source-permission review provenance on app.company;
--  - audit policies for permission / publication / classification changes.

create table app.job_sector (
  sector_key text primary key,
  display_name text not null,
  description text not null default '',
  position integer not null,
  active boolean not null default true,
  constraint job_sector_key_check check (
    sector_key = btrim(sector_key) and sector_key ~ '^[a-z0-9_]{2,60}$'
  ),
  constraint job_sector_display_check check (
    display_name = btrim(display_name) and char_length(display_name) between 1 and 120
  ),
  constraint job_sector_description_check check (char_length(description) <= 400),
  constraint job_sector_position_check check (position between 1 and 100)
);

create table app.job_subsector (
  subsector_key text primary key,
  display_name text not null,
  description text not null default '',
  position integer not null,
  active boolean not null default true,
  sector_key text references app.job_sector(sector_key) on delete restrict,
  constraint job_subsector_key_check check (
    subsector_key = btrim(subsector_key) and subsector_key ~ '^[a-z0-9_]{2,60}$'
  ),
  constraint job_subsector_display_check check (
    display_name = btrim(display_name) and char_length(display_name) between 1 and 120
  ),
  constraint job_subsector_description_check check (char_length(description) <= 400),
  constraint job_subsector_position_check check (position between 1 and 200),
  constraint job_subsector_parent_check check (
    subsector_key = 'other' or sector_key is not null
  )
);

insert into app.job_sector (sector_key, display_name, description, position) values
  ('consulting', 'Consulting',
   'Advisory and transformation work helping organisations solve problems and improve performance.', 1),
  ('consumer_fmcg_retail', 'Consumer, FMCG & Retail',
   'Brands, fast-moving consumer goods, retail operations and the supply chains behind them.', 2),
  ('engineering_energy_infrastructure', 'Engineering, Energy & Infrastructure',
   'Design, build and operate the physical world: engineering, construction, energy and property.', 3),
  ('financial_services', 'Financial Services',
   'Banking, insurance and professional financial operations serving businesses and individuals.', 4),
  ('investment_banking_asset_management', 'Investment Banking & Asset Management',
   'Capital markets, advisory, investing and trading careers in banking and investment firms.', 5),
  ('law', 'Law',
   'Legal practice, from commercial transactions to criminal and public law.', 6),
  ('management_operations', 'Management & Operations',
   'Business leadership, operations, people and process roles inside organisations.', 7),
  ('marketing_media_pr', 'Marketing, Media & PR',
   'Communications, brand, journalism, media production and public relations.', 8),
  ('pharmaceuticals_science', 'Pharmaceuticals & Science',
   'Research, development and production in life sciences and applied science.', 9),
  ('public_sector_charity', 'Public Sector & Charity',
   'Government, public services, education and charitable organisations.', 10),
  ('sales_recruitment_commercial', 'Sales, Recruitment & Commercial',
   'Revenue-facing and people-facing commercial roles: sales, recruitment and account management.', 11),
  ('technology_it', 'Technology & IT Infrastructure',
   'Software, data, cyber security and the technology infrastructure that runs organisations.', 12);

insert into app.job_subsector (subsector_key, display_name, description, position, sector_key) values
  ('accounting_audit_tax', 'Accounting, Audit & Tax', 'Financial reporting, assurance and tax work.', 1, 'financial_services'),
  ('insurance_pensions', 'Insurance & Pensions', 'Insurance products, underwriting, claims and pensions.', 2, 'financial_services'),
  ('retail_corporate_banking', 'Retail & Corporate Banking', 'Banking products and relationships for consumers and businesses.', 3, 'financial_services'),
  ('asset_investment_management', 'Asset & Investment Management', 'Managing investment portfolios and funds.', 1, 'investment_banking_asset_management'),
  ('investment_banking', 'Investment Banking', 'Advisory, capital raising and transactions.', 2, 'investment_banking_asset_management'),
  ('private_equity', 'Private Equity', 'Investing in and growing private companies.', 3, 'investment_banking_asset_management'),
  ('trading', 'Trading', 'Buying and selling financial instruments and markets.', 4, 'investment_banking_asset_management'),
  ('consulting_project_management', 'Consulting & Project Management', 'Advisory delivery and project leadership.', 1, 'consulting'),
  ('financial_consulting', 'Financial Consulting', 'Advisory on financial performance, risk and transactions.', 2, 'consulting'),
  ('management_consulting', 'Management Consulting', 'Strategy and operational improvement advice.', 3, 'consulting'),
  ('strategy_consulting', 'Strategy Consulting', 'Long-term direction and business strategy advice.', 4, 'consulting'),
  ('commercial_law', 'Commercial Law', 'Legal work for businesses and transactions.', 1, 'law'),
  ('criminal_law', 'Criminal Law', 'Legal work in criminal justice.', 2, 'law'),
  ('business_management', 'Business Management', 'Running teams, units and organisations.', 1, 'management_operations'),
  ('entrepreneurship', 'Entrepreneurship', 'Starting and growing ventures.', 2, 'management_operations'),
  ('human_resources', 'Human Resources', 'People operations, talent and workplace culture.', 3, 'management_operations'),
  ('operations_communications', 'Operations & Communications', 'Day-to-day operations and internal communication.', 4, 'management_operations'),
  ('consumer_goods_fmcg', 'Consumer Goods & FMCG', 'Brands and fast-moving consumer products.', 1, 'consumer_fmcg_retail'),
  ('retail_fashion', 'Retail & Fashion', 'Retail operations and fashion businesses.', 2, 'consumer_fmcg_retail'),
  ('supply_chain_logistics', 'Supply Chain & Logistics', 'Moving, storing and delivering products.', 3, 'consumer_fmcg_retail'),
  ('architecture', 'Architecture', 'Designing buildings and the built environment.', 1, 'engineering_energy_infrastructure'),
  ('engineering', 'Engineering', 'Designing and building products, systems and infrastructure.', 2, 'engineering_energy_infrastructure'),
  ('energy', 'Energy', 'Energy generation, distribution and transition.', 3, 'engineering_energy_infrastructure'),
  ('property_construction', 'Property & Construction', 'Real estate and construction delivery.', 4, 'engineering_energy_infrastructure'),
  ('journalism_publishing', 'Journalism & Publishing', 'Reporting, writing and publishing.', 1, 'marketing_media_pr'),
  ('marketing', 'Marketing', 'Brand, growth and marketing delivery.', 2, 'marketing_media_pr'),
  ('media_film_tv', 'Media, Film & TV', 'Content production across media and broadcast.', 3, 'marketing_media_pr'),
  ('public_relations', 'Public Relations', 'Reputation, media relations and communications.', 4, 'marketing_media_pr'),
  ('pharmaceuticals', 'Pharmaceuticals', 'Drug development, regulation and production.', 1, 'pharmaceuticals_science'),
  ('science_research', 'Science & Research', 'Applied and academic scientific research.', 2, 'pharmaceuticals_science'),
  ('charity_social_enterprise', 'Charity & Social Enterprise', 'Charities, foundations and mission-driven ventures.', 1, 'public_sector_charity'),
  ('education_teaching', 'Education & Teaching', 'Schools, universities and learning delivery.', 2, 'public_sector_charity'),
  ('public_sector_government', 'Public Sector & Government', 'Civil service, policy and public bodies.', 3, 'public_sector_charity'),
  ('recruitment', 'Recruitment', 'Talent sourcing and recruitment delivery.', 1, 'sales_recruitment_commercial'),
  ('sales_commercial', 'Sales & Commercial', 'Sales, account management and commercial roles.', 2, 'sales_recruitment_commercial'),
  ('cyber_security', 'Cyber Security', 'Protecting systems, data and networks.', 1, 'technology_it'),
  ('data_science_analytics', 'Data Science & Analytics', 'Data analysis, machine learning and insight.', 2, 'technology_it'),
  ('it_infrastructure', 'IT Infrastructure', 'Networks, platforms and technology operations.', 3, 'technology_it'),
  ('software_development', 'Software Development', 'Building and maintaining software products.', 4, 'technology_it'),
  ('other', 'Other', 'Roles that do not fit another subsector.', 200, null);

alter table app.job
  add column sector_key text references app.job_sector(sector_key) on delete restrict,
  add column subsector_key text references app.job_subsector(subsector_key) on delete restrict,
  add column opportunity_type text not null default 'unknown',
  add column eligibility_status text not null default 'needs_review',
  add column eligibility_reasons text[] not null default '{}',
  add column eligibility_evidence text,
  add column publication_status text not null default 'draft',
  add column classification_source text not null default 'deterministic',
  add column classification_version integer not null default 1;

alter table app.job
  add constraint job_opportunity_type_check check (
    opportunity_type in (
      'graduate_job','graduate_scheme','internship','industrial_placement',
      'work_experience','degree_apprenticeship','apprenticeship','immediate_start',
      'knowledge_transfer_partnership','training_contract','vacation_scheme',
      'volunteering','entry_level','junior','postgraduate_opportunity',
      'other_early_career','unknown'
    )
  ),
  add constraint job_eligibility_status_check check (
    eligibility_status in ('eligible','ineligible','needs_review')
  ),
  add constraint job_publication_status_check check (
    publication_status in ('draft','published','suppressed','expired')
  ),
  add constraint job_classification_source_check check (
    classification_source in ('source','deterministic','administrator','ai_assisted')
  ),
  add constraint job_classification_version_check check (classification_version > 0),
  add constraint job_eligibility_reasons_check check (cardinality(eligibility_reasons) <= 12),
  add constraint job_eligibility_evidence_check check (
    eligibility_evidence is null or (
      eligibility_evidence = btrim(eligibility_evidence)
      and char_length(eligibility_evidence) between 1 and 300
    )
  );

create index job_public_catalogue_idx on app.job (
  publication_status, eligibility_status, active, posted_at desc, first_seen_at desc
) where publication_status = 'published' and eligibility_status = 'eligible' and active;
create index job_sector_idx on app.job (sector_key) where sector_key is not null;
create index job_subsector_idx on app.job (subsector_key) where subsector_key is not null;
create index job_opportunity_type_idx on app.job (opportunity_type);
create index job_eligibility_review_queue_idx on app.job (eligibility_status, updated_at)
  where eligibility_status in ('needs_review','ineligible');

create table app.job_location (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references app.job(id) on delete cascade,
  city text,
  region text,
  country text,
  source_text text not null default '',
  remote boolean not null default false,
  hybrid boolean not null default false,
  on_site boolean not null default false,
  position integer not null default 0,
  constraint job_location_text_check check (
    (city is null or (city = btrim(city) and char_length(city) between 1 and 120))
    and (region is null or (region = btrim(region) and char_length(region) between 1 and 120))
    and (country is null or (country = btrim(country) and char_length(country) between 1 and 80))
    and (source_text = '' or (source_text = btrim(source_text) and char_length(source_text) between 1 and 200))
  ),
  constraint job_location_mode_check check (
    remote or hybrid or on_site or source_text <> '' or city is not null
  ),
  constraint job_location_position_check check (position between 0 and 50)
);

create index job_location_job_idx on app.job_location (job_id, position);
create index job_location_city_idx on app.job_location (city) where city is not null;
create index job_location_region_idx on app.job_location (region) where region is not null;
create index job_location_country_idx on app.job_location (country) where country is not null;

insert into app.job_location (job_id, city, region, country, source_text)
select id, city, region, country, location_text
from app.job
where location_text <> '' or city is not null or region is not null or country is not null;

alter table app.company
  add column review_date date,
  add column reviewed_by_user_id uuid references app."user"(id) on delete restrict,
  add column robots_result text not null default 'not_checked',
  add column terms_result text not null default 'not_reviewed',
  add column evidence_url text,
  add column review_notes text not null default '';

alter table app.company
  add constraint company_robots_result_check check (
    robots_result in ('allowed','blocked','unknown','not_checked')
  ),
  add constraint company_terms_result_check check (
    terms_result in ('allowed','blocked','unknown','not_reviewed')
  ),
  add constraint company_evidence_url_check check (
    evidence_url is null or evidence_url ~ '^https?://'
  ),
  add constraint company_review_notes_check check (
    review_notes = btrim(review_notes) and char_length(review_notes) <= 2000
  );

create unique index company_careers_url_unique on app.company (lower(careers_url))
  where careers_url is not null;

alter table app.job_location enable row level security;
alter table app.job_location force row level security;
alter table app.job_sector enable row level security;
alter table app.job_sector force row level security;
alter table app.job_subsector enable row level security;
alter table app.job_subsector force row level security;

create policy job_catalog_location_read on app.job_location
  for select to offerlab_app using(true);
create policy job_catalog_job_admin_write on app.job
  for all to offerlab_app
  using(exists(select 1 from app."user" u where u.id = app.current_user_id() and u.role = 'administrator'))
  with check(exists(select 1 from app."user" u where u.id = app.current_user_id() and u.role = 'administrator'));
create policy job_catalog_sector_read on app.job_sector
  for select to offerlab_app using(true);
create policy job_catalog_subsector_read on app.job_subsector
  for select to offerlab_app using(true);
create policy job_catalog_location_crawler_write on app.job_location
  for all to offerlab_crawler using(true) with check(true);
create policy job_catalog_sector_crawler_read on app.job_sector
  for select to offerlab_crawler using(true);
create policy job_catalog_subsector_crawler_read on app.job_subsector
  for select to offerlab_crawler using(true);

create policy audit_event_insert_job_catalog on app.audit_event
  for insert to offerlab_app with check(
    actor_user_id = app.current_user_id() and metadata = '{}'::jsonb and (
      (
        entity_type = 'job_source'
        and action in (
          'job_source.permission_changed',
          'job_source.reviewed',
          'job_source.paused',
          'job_source.resumed'
        )
        and exists(select 1 from app.company s where s.id = entity_id)
      ) or (
        entity_type = 'job'
        and action in (
          'job.publication_changed',
          'job.classification_changed',
          'job.eligibility_changed'
        )
        and exists(select 1 from app.job j where j.id = entity_id)
      )
    )
  );

grant select on app.job_location, app.job_sector, app.job_subsector to offerlab_app;
grant select (sector_key, subsector_key, opportunity_type, eligibility_status,
  eligibility_reasons, eligibility_evidence, publication_status,
  classification_source, classification_version)
  on app.job to offerlab_app;
grant update (sector_key, subsector_key, opportunity_type, eligibility_status,
  eligibility_reasons, eligibility_evidence, publication_status,
  classification_source, classification_version, updated_at)
  on app.job to offerlab_app;
grant select (review_date, reviewed_by_user_id, robots_result, terms_result,
  evidence_url, review_notes)
  on app.company to offerlab_app;
grant update (crawl_allowed, crawl_status, updated_at, review_date,
  reviewed_by_user_id, robots_result, terms_result, evidence_url, review_notes)
  on app.company to offerlab_app;
grant select, insert, update, delete on app.job_location to offerlab_crawler;
grant select on app.job_sector, app.job_subsector to offerlab_crawler;

revoke all on app.job_location, app.job_sector, app.job_subsector
  from public, anon, authenticated, offerlab_identity_sync;

comment on table app.job_sector is
  'Catalogue sector taxonomy with stable machine keys; display labels are never identifiers.';
comment on table app.job_subsector is
  'Catalogue subsector taxonomy with an explicit parent-sector mapping; other is unassigned.';
comment on column app.job.publication_status is
  'Public visibility: only eligible + published + active jobs are publicly queryable.';
comment on column app.job.classification_source is
  'source | deterministic | administrator | ai_assisted. Rows classified by an administrator are never reclassified or republished automatically.';
comment on table app.job_location is
  'Multiple locations per requisition; remote/hybrid/on-site flags are recorded per location when the source provides them.';
comment on column app.company.review_date is
  'Date of the recorded source-permission review; empty until an administrator records one.';

commit;
