begin;

-- Workable and Teamtailor become first-class connector source types.
-- Discovery fingerprinting already detects both platforms; the crawler
-- registry now has typed connectors for them.

alter table app.job_source
  drop constraint job_source_source_type_check,
  add constraint job_source_source_type_check check (
    source_type in (
      'direct_html','workday','greenhouse','lever','smartrecruiters','ashby',
      'workable','teamtailor','custom','unknown'
    )
  );

commit;
