begin;

-- The (company_id, candidate_url) unique constraint in the employer research
-- foundation migration cannot enforce uniqueness while company_id is NULL
-- (ambiguous identities awaiting review). The importer already checks first,
-- but a partial unique index gives the database the same guarantee directly.

create unique index job_source_candidate_unresolved_url_unique
  on app.job_source_candidate (candidate_url)
  where company_id is null;

comment on index app.job_source_candidate_unresolved_url_unique is
  'Prevents duplicate candidates for unresolved identities awaiting review.';

commit;
