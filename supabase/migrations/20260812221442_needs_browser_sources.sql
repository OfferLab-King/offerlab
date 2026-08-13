begin;

-- Browser-rendered crawling of bot-walled public career sites (founder
-- decision 2026-08-12): sources with needs_browser = true run through
-- Playwright/Chromium instead of plain HTTP.

alter table app.job_source
  add column needs_browser boolean not null default false;

comment on column app.job_source.needs_browser is
  'Render this source with a real browser engine (Playwright/Chromium) instead of plain HTTP.';

commit;
