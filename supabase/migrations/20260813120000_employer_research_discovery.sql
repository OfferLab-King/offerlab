begin;

-- Phase B: source discovery. The research snapshot gains the workbook ATS
-- evidence so platform coverage analytics can use research evidence even for
-- employers without a source candidate. The live source registry and crawler
-- are untouched; candidates are promoted only by explicit discovery tooling.

alter table app.employer_research_snapshot
  add column ats_platform text,
  add column ats_verification_status text;

alter table app.employer_research_snapshot
  add constraint employer_snapshot_ats_platform_check check (
    ats_platform is null or (
      ats_platform = btrim(ats_platform) and char_length(ats_platform) between 1 and 120
    )
  ),
  add constraint employer_snapshot_ats_verification_check check (
    ats_verification_status is null or (
      ats_verification_status = btrim(ats_verification_status)
      and char_length(ats_verification_status) between 1 and 120
    )
  );

comment on column app.employer_research_snapshot.ats_platform is
  'Research workbook ATS/platform evidence (never proof of a live source).';
comment on column app.employer_research_snapshot.ats_verification_status is
  'Research workbook ATS verification status for the snapshot date.';

commit;
