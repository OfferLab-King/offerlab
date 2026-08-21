begin;

create table app.employer_web_discovery_attempt (
  company_id uuid not null references app.company(id) on delete cascade,
  discovery_version text not null,
  provider text not null,
  status text not null,
  result_count integer not null default 0,
  safe_candidate_count integer not null default 0,
  checked_at timestamptz not null default now(),
  primary key (company_id, discovery_version, provider),
  constraint employer_web_discovery_version_check check (
    discovery_version = btrim(discovery_version) and char_length(discovery_version) between 1 and 80
  ),
  constraint employer_web_discovery_provider_check check (provider = 'brave_search'),
  constraint employer_web_discovery_status_check check (
    status in ('matched', 'no_safe_match', 'failed')
  ),
  constraint employer_web_discovery_counts_check check (
    result_count >= 0 and safe_candidate_count >= 0
  )
);

create index employer_web_discovery_status_idx
  on app.employer_web_discovery_attempt (discovery_version, provider, status, checked_at);

alter table app.employer_web_discovery_attempt enable row level security;
alter table app.employer_web_discovery_attempt force row level security;

create policy employer_web_discovery_admin_access
  on app.employer_web_discovery_attempt
  for all to offerlab_app
  using (exists (
    select 1 from app."user" u where u.id = app.current_user_id() and u.role = 'administrator'
  ))
  with check (exists (
    select 1 from app."user" u where u.id = app.current_user_id() and u.role = 'administrator'
  ));

revoke all on app.employer_web_discovery_attempt from public, anon, authenticated,
  offerlab_crawler, offerlab_identity_sync;
grant select, insert, update, delete on app.employer_web_discovery_attempt to offerlab_app;

comment on table app.employer_web_discovery_attempt is
  'Administrator-only versioned ledger for bounded official website and careers search discovery; never a source-verification authority.';

commit;
