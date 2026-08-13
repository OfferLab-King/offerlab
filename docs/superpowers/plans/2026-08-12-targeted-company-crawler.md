# Targeted Company Crawler Implementation Plan

> Execute in this worktree with strict red-green-refactor cycles. Do not enable
> production crawling or publish unverified jobs as part of implementation.

**Goal:** Deliver a source-isolated daily UK employer crawler with CMS operations,
URL health, a first-100 onboarding manifest, and optional OpenCode Go / DeepSeek
structuring.

**Architecture:** Keep `app.company` as the public employer identity and add
`app.job_source` as the unit of crawling, scheduling, health, and job ownership.
The web runtime requests work; the least-privileged CLI worker executes it.

**Stack:** Next.js App Router, strict TypeScript, PostgreSQL/Supabase, postgres.js,
Zod, Vitest, Playwright, systemd.

---

## Task 1: Record amended founder and product contracts

**Files:**

- Modify: `docs/architecture/founder-decisions.md`
- Modify: `docs/product/current-product-contract.md`
- Modify: `docs/architecture/decisions/0022-job-catalog.md`
- Modify: `docs/architecture/decisions/0023-job-catalog-ia-eligibility.md`
- Modify: `docs/architecture/overview.md`

1. Add the approved 12 August decision: official unauthenticated employer sources
   need no separate permission gate; UK location is required; all seniority levels
   are supported; source isolation and optional OpenCode Go review are approved.
2. Remove contradictory `crawl_allowed`, per-source permission, graduate-only, and
   dormant-production wording while retaining operational source status and the
   catalogue/LLM kill switches.
3. Run `pnpm exec prettier --check` on the changed documents and `git diff --check`.
4. Commit the documentation contract change.

## Task 2: Add source schema and safe backfill

**Files:**

- Create: `supabase/migrations/20260812120000_job_sources.sql`
- Modify: `tests/integration/job-catalog.test.ts`
- Modify: `tests/security/source-boundaries.test.ts`

1. Write failing integration assertions for `app.job_source`, backfilled source
   ownership, source-scoped uniqueness, application/crawler grants, forced RLS,
   and administrator-only source mutations.
2. Run the targeted integration/security tests and confirm failure.
3. Implement the expand migration, one-source-per-existing-company backfill, and
   `source_id` ownership on jobs/runs/events. Keep employer compatibility columns.
4. Re-run migration reset and targeted tests until green.
5. Commit the migration and tests.

## Task 3: Replace company-as-source domain and repositories

**Files:**

- Modify: `src/modules/job-catalog/domain/source.ts`
- Modify: `src/modules/job-catalog/domain/scheduler.ts`
- Modify: `src/modules/job-catalog/domain/scheduler.test.ts`
- Create: `src/modules/job-catalog/domain/source-health.ts`
- Create: `src/modules/job-catalog/domain/source-health.test.ts`
- Create: `src/modules/job-catalog/infrastructure/job-source-repository.ts`
- Modify: `src/modules/job-catalog/infrastructure/company-repository.ts`
- Modify: `src/modules/job-catalog/infrastructure/ingestion-run-repository.ts`

1. Add failing unit tests for active/paused/archived sources, scheduled/manual due
   status, jitter, URL-health transitions, redirects, and failure auto-pause.
2. Implement `JobSource`, source schedule/health rules, and source repository CRUD,
   due-work claiming, manual requests, health updates, and source-owned runs/events.
3. Keep company repository focused on employer identity and compatibility import.
4. Run targeted unit tests and typecheck.
5. Commit the domain/repository conversion.

## Task 4: Make ingestion source-isolated

**Files:**

- Modify: `src/modules/job-catalog/application/ingestion.ts`
- Modify: `src/modules/job-catalog/infrastructure/job-repository.ts`
- Modify: `src/modules/job-catalog/infrastructure/crawler-database.ts`
- Modify: `src/modules/job-catalog/infrastructure/connectors/types.ts`
- Modify: `src/modules/job-catalog/infrastructure/connectors/registry.ts`
- Modify: `tests/integration/job-catalog.test.ts`

1. Add a failing integration test with two sources under one employer proving that
   a successful empty/missing cycle for source A cannot touch source B jobs.
2. Convert connector context, source locks, existing-job reads, plan application,
   run/event writes, and health updates from company ID to source ID.
3. Preserve company ID on normalized jobs for public queries.
4. Run the targeted integration test, existing connector tests, and typecheck.
5. Commit source-isolated ingestion.

## Task 5: Add deterministic UK-location admission

**Files:**

- Create: `src/modules/job-catalog/domain/uk-location.ts`
- Create: `src/modules/job-catalog/domain/uk-location.test.ts`
- Modify: `src/modules/job-catalog/domain/eligibility.ts`
- Modify: `src/modules/job-catalog/domain/eligibility.test.ts`
- Modify: `src/modules/job-catalog/application/classification-pipeline.ts`
- Modify: `src/modules/job-catalog/infrastructure/job-repository.ts`
- Modify: `tests/integration/job-catalog.test.ts`

1. Add failing table-driven tests for four UK nations, GB/UK aliases, Northern
   Ireland versus Ireland, Crown Dependencies, UK remote, countryless remote,
   multi-location UK/global roles, explicit non-UK, and ambiguous values.
2. Implement deterministic `uk_confirmed | non_uk | ambiguous` classification and
   machine-readable reasons/evidence.
3. Suppress non-UK jobs and hold ambiguous jobs unpublished for admin review.
4. Remove graduate wording as an eligibility requirement.
5. Run targeted unit and integration tests.
6. Commit UK admission.

## Task 6: Convert workers and add reusable deployment assets

**Files:**

- Modify: `scripts/jobs/crawl-company.ts`
- Modify: `scripts/jobs/crawl-due.ts`
- Modify: `scripts/jobs/status.ts`
- Modify: `scripts/jobs/verify-sources.ts`
- Modify: `scripts/jobs/options.ts`
- Create: `deploy/systemd/offerlab-jobs.service`
- Create: `deploy/systemd/offerlab-jobs.timer`
- Modify: `docs/operations/job-catalog-operations.md`

1. Add unit-testable option/selection tests where missing.
2. Address sources by `<company-slug>/<source-slug>`, claim due/manual work, and
   report trigger plus UK rejection/hold counts.
3. Commit a five-minute systemd polling timer while source schedules remain daily.
4. Replace permission-review runbook language with source verification,
   operational enable/pause, URL correction, and deployment verification.
5. Run script tests/typecheck and formatting.
6. Commit worker/deployment changes.

## Task 7: Build CMS source registry and manual run workflow

**Files:**

- Modify: `src/modules/job-catalog/application/admin.ts`
- Modify: `src/app/admin/job-sources/actions.ts`
- Modify: `src/app/admin/job-sources/page.tsx`
- Modify: relevant CMS styles in `src/app/globals.css`
- Create/modify: unit tests under `tests/unit/`
- Modify: `e2e/job-catalog-enabled.spec.ts`

1. Add failing action/application tests for create/edit source, run-now, pause,
   resume, archive, URL correction, and redirect acceptance with administrator
   authorization and audit attribution.
2. Implement application use cases and validated server-action adapters.
3. Replace permission controls with a compact employer/source registry, health,
   recent runs/events, and review queues.
4. Add browser coverage for the administrator workflow and responsive layout.
5. Run unit tests, targeted E2E, lint, and typecheck.
6. Commit CMS operations.

## Task 8: Add provider-neutral OpenCode Go enrichment

**Files:**

- Modify: `.env.example`
- Modify: `src/infrastructure/config/environment.ts`
- Modify: `src/infrastructure/config/environment.test.ts`
- Modify: `src/modules/job-catalog/application/config.ts`
- Modify: `src/modules/job-catalog/application/config.test.ts`
- Modify: `src/modules/job-catalog/application/enrichment.ts`
- Modify: `src/modules/job-catalog/infrastructure/enrichment-provider.ts`
- Modify: `src/modules/job-catalog/infrastructure/enrichment-provider.test.ts`
- Modify: `src/modules/job-catalog/domain/enrichment-schema.ts`
- Modify: `src/modules/job-catalog/domain/enrichment-schema.test.ts`

1. Add failing tests for OpenCode Go endpoint/model selection, direct DeepSeek
   fallback, provider-neutral telemetry, strict JSON, source grounding, and disabled
   or unavailable fallback.
2. Add server-only `JOB_ENRICHMENT_*`/`OPENCODE_API_KEY` configuration without
   exposing secrets or logging content.
3. Broaden the prompt from graduate-only to all UK roles and include structured
   classification suggestions without granting publication authority.
4. Ensure only new/content-changed jobs become pending; unchanged jobs cost zero
   model tokens.
5. Run enrichment/config tests and typecheck.
6. Commit provider-neutral enrichment.

## Task 9: Create the first-100 versioned cohort manifest

**Files:**

- Replace/refactor: `src/modules/job-catalog/application/seed-companies.ts`
- Create: `src/modules/job-catalog/application/employer-cohort.ts`
- Create: `src/modules/job-catalog/application/employer-cohort.test.ts`
- Modify: `scripts/jobs/seed-companies.ts`
- Modify: `scripts/jobs/verify-sources.ts`

1. Add failing tests for exactly 100 unique employers, sector coverage, mandatory
   UK evidence, stable ranks/bands, source-channel uniqueness, and preservation of
   manual overrides.
2. Build a balanced first-100 manifest using official employer URLs and
   independently verified source endpoints. Mark incomplete connector records
   inactive rather than guessing.
3. Implement idempotent import and bounded verification reporting.
4. Run manifest tests and local dry-run import/verification.
5. Commit the cohort.

## Task 10: Verify SEO, documentation, and production readiness

**Files:**

- Modify as required: `src/modules/job-catalog/domain/job-indexability.ts`
- Modify: `tests/integration/job-detail-seo.test.ts`
- Modify: `tests/unit/job-detail-seo-routes.test.ts`
- Modify: `e2e/job-catalog.spec.ts`
- Modify: `README.md`

1. Add/adjust tests proving only UK-confirmed active published jobs enter routes,
   sitemap, canonical metadata, and `JobPosting` JSON-LD.
2. Verify employer pages aggregate jobs across sources and expired jobs remain
   honest and non-indexable.
3. Run `pnpm format`, `pnpm lint`, `pnpm typecheck`, unit/integration/security/E2E
   tests, `pnpm build`, `pnpm validate`, and `pnpm security:audit`.
4. Run the bounded synthetic OpenCode Go smoke test without printing credentials or
   source content; record only pass/fail and token counts.
5. Review the final diff, migrations, generated files, and repository status.
6. Commit final fixes and report production readiness plus any deployment-only
   actions.
