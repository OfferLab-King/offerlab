begin;

-- The employer directory is the single public industry/company index. These
-- fields are editorial directory metadata only; they do not grant crawl
-- permission and they do not imply that an employer has a current vacancy.
alter table app.company
  add column directory_sector_key text references app.job_sector(sector_key) on delete restrict,
  add column directory_priority_rank integer,
  add column directory_visible boolean not null default false,
  add constraint company_directory_priority_rank_check check (
    directory_priority_rank is null or directory_priority_rank between 1 and 500
  );

create unique index company_directory_priority_rank_unique
  on app.company (directory_priority_rank)
  where directory_priority_rank is not null;

create index company_directory_sector_name_idx
  on app.company (directory_sector_key, name)
  where active and directory_visible;

-- Preserve every employer that already has a public role. The most common
-- public job sector becomes its initial directory sector; administrators can
-- later correct this editorial classification without changing job records.
update app.company c
set directory_visible = true,
    directory_sector_key = ranked.sector_key
from (
  select distinct on (j.company_id)
    j.company_id,
    j.sector_key
  from app.job j
  where j.active
    and j.publication_status = 'published'
    and j.eligibility_status = 'eligible'
    and j.sector_key is not null
  group by j.company_id, j.sector_key
  order by j.company_id, count(*) desc, j.sector_key
) ranked
where c.id = ranked.company_id;

grant select (directory_sector_key, directory_priority_rank, directory_visible)
  on app.company to offerlab_app;
grant update (directory_sector_key, directory_priority_rank, directory_visible, updated_at)
  on app.company to offerlab_app;

comment on column app.company.directory_sector_key is
  'Editorial sector used by the combined public employer/sector directory; independent of per-job classification.';
comment on column app.company.directory_priority_rank is
  'Internal 1-500 source-onboarding priority, not a public quality ranking.';
comment on column app.company.directory_visible is
  'Whether the employer may appear in the public directory even when it has no current published roles.';

commit;
