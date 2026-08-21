begin;

alter table app.employer_web_discovery_attempt
  drop constraint employer_web_discovery_provider_check;

alter table app.employer_web_discovery_attempt
  add constraint employer_web_discovery_provider_check
  check (provider in ('brave_search', 'dns_https'));

commit;
