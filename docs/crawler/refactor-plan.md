# Crawler refactor: implementation report (2026-08-15)

Scope: evaluate an external crawler-refactor proposal against the existing
architecture, then implement only the genuine gaps. Full review in
`docs/crawler/architecture.md`.

## Proposal vs reality

The external proposal (employer master data, career sources 1:N, canonical
ATS enums, adapters, crawl runs, staged disappearance, change detection,
UK scope, CSV migration, admin, tests) is **already implemented** across
`app.company`, `app.job_source`, `app.job`, `app.job_ingestion_run`,
`app.job_source_event`, the connectors registry, the fingerprinting and
import pipelines, and the admin screens. Those parts were adapted rather
than duplicated.

## Implemented changes

### 1. Zero-result anomaly tracking (proposal §15)

- Migration `20260815010000_job_lifecycle_events.sql`:
  - `app.job_source.consecutive_zero_results` + `last_non_zero_result_at`
  - `app.job_event` lifecycle table (RLS: administrator read, crawler write)
- `zeroResultTrackingAfterSuccessfulCrawl` in `domain/source-health.ts`
  (pure, unit-tested): counts consecutive zero-result successful crawls,
  records the last non-zero time, and flags an anomaly only when a source
  with active jobs suddenly returns empty with a successful crawl.
- Ingestion: anomaly runs are recorded as `partial` (new run status) with a
  `listing_empty_anomaly` source event; **jobs are never deactivated by a
  zero-result crawl** (unchanged invariant, now explicit).
- Admin `/admin/job-sources` shows consecutive zero results + last non-zero
  time per source.

### 2. Per-job lifecycle events (proposal §12, §13)

- `app.job_event` rows written inside the ingestion transaction by
  `applyCrawlPlan`:
  - `discovered` on insert (new title/url/external id)
  - `updated` with field-level diff (`changed_fields`, `previous_values`,
    `new_values`) over the canonical content-hash inputs
  - `possibly_closed` on the first absence (missed_crawls 0 → 1)
  - `closed` on deactivation past the threshold
  - `reopened` on reappearance of a previously closed job
- Unchanged rows record no event (hash untouched → only `last_seen_at`).

## Files

- `supabase/migrations/20260815010000_job_lifecycle_events.sql` (new)
- `src/modules/job-catalog/domain/source-health.ts` (+ test)
- `src/modules/job-catalog/application/ingestion.ts`
- `src/modules/job-catalog/infrastructure/job-source-repository.ts`
- `src/modules/job-catalog/infrastructure/job-repository.ts`
- `src/modules/job-catalog/infrastructure/ingestion-run-repository.ts`
- `src/modules/job-catalog/domain/source.ts` (+ test fixture)
- `src/app/admin/job-sources/page.tsx`
- `tests/integration/job-catalog.test.ts` (lifecycle + event assertions)
- `docs/crawler/architecture.md` (this architecture reference)

## Validation

- `pnpm typecheck`, `pnpm lint`, `pnpm format` pass.
- Unit tests pass (incl. new zero-result tracking tests).
- Integration lifecycle test passes (discovered/updated/possibly_closed/
  closed/reopened events asserted).
- Local integration failures are the known pre-existing single-administrator
  environment artifact (CI's fresh database passes them).

## Remaining limitations

- Conditional fetching (ETag/If-None-Match) not implemented.
- Scheduled source re-verification not automated.
- Programme intake windows (`career_programmes`/`programme_cycles`) not
  implemented; the channel model already covers per-programme sources, and a
  cycles model should be added together with a discovery integration that
  writes it.
- Job events are written but no UI surface consumes them yet (foundation for
  "new today / recently updated / recently closed").
