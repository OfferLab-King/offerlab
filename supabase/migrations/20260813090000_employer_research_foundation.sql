begin;

-- Employer research foundation for the Top 1,000 sponsor-aware employer
-- universe. These tables hold research/provenance data only: canonical
-- employer identity lives in app.company and live crawler sources live in
-- app.job_source. Research rows may exist without a canonical company match
-- (ambiguous identities awaiting administrator review).

create table app.employer_alias (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references app.company(id) on delete cascade,
  alias text not null,
  alias_type text not null default 'trading_name',
  source text not null default 'research',
  created_at timestamptz not null default now(),
  constraint employer_alias_text_check check (
    alias = btrim(alias) and char_length(alias) between 1 and 200
  ),
  constraint employer_alias_type_check check (
    alias_type in ('canonical_name_variant', 'sponsor_legal', 'trading_name', 'historical', 'user_entered')
  ),
  constraint employer_alias_source_check check (
    source = btrim(source) and char_length(source) between 1 and 120
  ),
  constraint employer_alias_unique unique (company_id, alias)
);

create index employer_alias_lookup_idx on app.employer_alias (lower(alias));

create table app.employer_sponsor_entity (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references app.company(id) on delete set null,
  legal_name text not null,
  town_city text,
  sponsor_rating text,
  routes text[] not null default '{}',
  source_snapshot_date date not null,
  active_in_snapshot boolean not null default true,
  identity_confidence text,
  identity_notes text,
  source_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employer_sponsor_legal_name_check check (
    legal_name = btrim(legal_name) and char_length(legal_name) between 1 and 300
  ),
  constraint employer_sponsor_town_check check (
    town_city is null or (town_city = btrim(town_city) and char_length(town_city) between 1 and 160)
  ),
  constraint employer_sponsor_rating_check check (
    sponsor_rating is null or (sponsor_rating = btrim(sponsor_rating) and char_length(sponsor_rating) between 1 and 80)
  ),
  constraint employer_sponsor_confidence_check check (
    identity_confidence is null or identity_confidence in ('High', 'Medium', 'Low', 'Ambiguous')
  ),
  constraint employer_sponsor_legal_unique unique (legal_name, source_snapshot_date)
);

create index employer_sponsor_company_idx on app.employer_sponsor_entity (company_id);
create index employer_sponsor_snapshot_idx on app.employer_sponsor_entity (source_snapshot_date desc);

create table app.employer_research_snapshot (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references app.company(id) on delete set null,
  canonical_name text not null,
  dataset_version text not null,
  research_date date not null,
  priority_tier text not null,
  internal_rank integer not null,
  crawler_wave text,
  employer_value_score numeric(6,2),
  crawler_readiness_score numeric(6,2),
  crawler_priority_score numeric(6,2),
  sponsorship_score numeric(6,2),
  early_career_score numeric(6,2),
  scale_score numeric(6,2),
  brand_market_score numeric(6,2),
  uk_relevance_score numeric(6,2),
  sector_score numeric(6,2),
  listing_ownership_score numeric(6,2),
  source_leverage_score numeric(6,2),
  sector text,
  subsector text,
  finance_asset_class text,
  employee_count numeric(12,0),
  employee_band text,
  employee_scope text,
  employee_source text,
  employee_confidence text,
  ownership_type text,
  ownership_confidence text,
  ticker text,
  exchange text,
  identity_confidence text,
  research_status text not null,
  evidence_urls jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  constraint employer_snapshot_tier_check check (
    priority_tier in ('P0', 'P1', 'P2', 'P3')
  ),
  constraint employer_snapshot_rank_check check (internal_rank between 1 and 5000),
  constraint employer_snapshot_identity_confidence_check check (
    identity_confidence is null or identity_confidence in ('High', 'Medium', 'Low', 'Ambiguous')
  ),
  constraint employer_snapshot_research_status_check check (
    research_status in (
      'not_researched',
      'verified_platform',
      'verified_careers_url',
      'needs_re_verification',
      'blocked_review',
      'verified_source'
    )
  ),
  constraint employer_snapshot_scores_check check (
    (employer_value_score is null or employer_value_score between 0 and 100)
    and (crawler_readiness_score is null or crawler_readiness_score between 0 and 100)
    and (crawler_priority_score is null or crawler_priority_score between 0 and 100)
    and (sponsorship_score is null or sponsorship_score between 0 and 100)
    and (early_career_score is null or early_career_score between 0 and 100)
    and (scale_score is null or scale_score between 0 and 100)
    and (brand_market_score is null or brand_market_score between 0 and 100)
    and (uk_relevance_score is null or uk_relevance_score between 0 and 100)
    and (sector_score is null or sector_score between 0 and 100)
    and (listing_ownership_score is null or listing_ownership_score between 0 and 100)
    and (source_leverage_score is null or source_leverage_score between 0 and 100)
  ),
  constraint employer_snapshot_evidence_check check (jsonb_typeof(evidence_urls) = 'array'),
  constraint employer_snapshot_identity_unique unique (dataset_version, research_date, internal_rank)
);

create index employer_snapshot_company_idx on app.employer_research_snapshot (company_id);
create index employer_snapshot_dataset_idx on app.employer_research_snapshot (dataset_version, research_date desc);

create table app.job_source_candidate (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references app.company(id) on delete set null,
  channel text not null default 'general',
  candidate_url text,
  candidate_endpoint text,
  platform_hint text,
  ats_verification_status text,
  discovery_method text,
  status text not null default 'not_researched',
  confidence text,
  evidence text,
  research_status text,
  discovered_at timestamptz,
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_source_candidate_channel_check check (
    channel in ('early_careers', 'professional', 'apprenticeships', 'general', 'other')
  ),
  constraint job_source_candidate_url_check check (
    (candidate_url is null or candidate_url ~ '^https?://[^[:space:]]+$')
    and (candidate_endpoint is null or candidate_endpoint ~ '^https?://[^[:space:]]+$')
  ),
  constraint job_source_candidate_status_check check (
    status in (
      'not_researched',
      'researching',
      'candidate_found',
      'platform_identified',
      'endpoint_identified',
      'verified',
      'failed',
      'blocked',
      'unsupported',
      'promoted'
    )
  ),
  constraint job_source_candidate_platform_check check (
    platform_hint is null or (platform_hint = btrim(platform_hint) and char_length(platform_hint) between 1 and 120)
  ),
  constraint job_source_candidate_unique unique (company_id, candidate_url)
);

create index job_source_candidate_company_idx on app.job_source_candidate (company_id, status);

-- RLS: research data is administrator-only. Live crawler source operations in
-- app.job_source remain unchanged.

alter table app.employer_alias enable row level security;
alter table app.employer_alias force row level security;
alter table app.employer_sponsor_entity enable row level security;
alter table app.employer_sponsor_entity force row level security;
alter table app.employer_research_snapshot enable row level security;
alter table app.employer_research_snapshot force row level security;
alter table app.job_source_candidate enable row level security;
alter table app.job_source_candidate force row level security;

create policy employer_research_admin_access on app.employer_alias
  for all to offerlab_app
  using (exists (
    select 1 from app."user" u where u.id = app.current_user_id() and u.role = 'administrator'
  ))
  with check (exists (
    select 1 from app."user" u where u.id = app.current_user_id() and u.role = 'administrator'
  ));

create policy employer_research_admin_access on app.employer_sponsor_entity
  for all to offerlab_app
  using (exists (
    select 1 from app."user" u where u.id = app.current_user_id() and u.role = 'administrator'
  ))
  with check (exists (
    select 1 from app."user" u where u.id = app.current_user_id() and u.role = 'administrator'
  ));

create policy employer_research_admin_access on app.employer_research_snapshot
  for all to offerlab_app
  using (exists (
    select 1 from app."user" u where u.id = app.current_user_id() and u.role = 'administrator'
  ))
  with check (exists (
    select 1 from app."user" u where u.id = app.current_user_id() and u.role = 'administrator'
  ));

create policy employer_research_admin_access on app.job_source_candidate
  for all to offerlab_app
  using (exists (
    select 1 from app."user" u where u.id = app.current_user_id() and u.role = 'administrator'
  ))
  with check (exists (
    select 1 from app."user" u where u.id = app.current_user_id() and u.role = 'administrator'
  ));

grant select, insert, update, delete on app.employer_alias,
  app.employer_sponsor_entity, app.employer_research_snapshot,
  app.job_source_candidate
  to offerlab_app;

revoke all on app.employer_alias, app.employer_sponsor_entity,
  app.employer_research_snapshot, app.job_source_candidate
  from public, anon, authenticated, offerlab_identity_sync;

comment on table app.employer_alias is
  'Research-derived aliases linking alternate employer names to canonical app.company identities.';
comment on table app.employer_sponsor_entity is
  'Home Office sponsor register legal entities mapped to a canonical employer; one employer may have many entities.';
comment on table app.employer_research_snapshot is
  'Dated research evidence (scores, employee scale, ownership, identity confidence) for the employer universe.';
comment on table app.job_source_candidate is
  'Unverified source-discovery candidates; never crawled until promoted to app.job_source.';

commit;
