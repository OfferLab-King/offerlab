begin;

-- Founder decision 2026-08-11: the catalogue covers current roles across
-- reviewed employer career sites, not only roles carrying early-career text.
-- Preserve administrator decisions and source-permission boundaries.
update app.job as job
set eligibility_status = 'eligible',
    publication_status = 'published',
    eligibility_reasons = array['active_job_listing'],
    eligibility_evidence = null,
    classification_version = classification_version + 1,
    updated_at = now()
from app.company as company
where company.id = job.company_id
  and company.crawl_allowed = 'allowed'
  and job.classification_source = 'deterministic'
  and job.active
  and (job.application_deadline is null or job.application_deadline >= now())
  and (job.eligibility_status <> 'eligible' or job.publication_status <> 'published');

comment on column app.job.eligibility_status is
  'Listing eligibility for the public catalogue. Career level is not an eligibility gate; administrator overrides remain authoritative.';

commit;
