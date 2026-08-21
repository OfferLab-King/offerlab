# IMPLEMENTATION_REPORT.md

> **Historical handoff snapshot:** This document records the original job
> catalogue implementation and its 10 August 2026 review. Later founder
> decisions approved official-source crawling and the repository now includes
> full sponsor-register import, free and bounded career-site discovery, typed
> API verification, automatic source activation/repair, exception-first admin
> operations and public jobs/employer experiences. Do not use the older release
> status below as current guidance. Use `docs/product/current-product-contract.md`,
> `crawler_readme.md`, `docs/crawler/architecture.md` and
> `docs/operations/job-catalog-operations.md`.

**Handoff report for the OfferLab job discovery and enrichment implementation.**
Prepared for an independent senior-engineer review (see `CODEX_REVIEW_PROMPT.md`).
This report is honest about what was verified, what was scaffolded, and what remains
uncertain. It does not claim production readiness.

## Independent review addendum — 10 August 2026

The review requested in `CODEX_REVIEW_PROMPT.md` found material defects and a
product-authority conflict. This addendum supersedes contrary statements later in
the original handoff:

- **Release status:** the implementation is now dormant by default behind
  `JOB_CATALOG_ENABLED=false`. The current founder decision approves gated JSearch
  and manual job targets, not persistent direct-employer crawling or a public job
  catalogue. ADR 0022 is therefore **Proposed**, not Accepted. A founder decision
  is required before this feature is operated in production.
- **Targeting gap:** connectors return whole-company feeds; there is no approved,
  deterministic rule yet for limiting results to UK graduate-relevant roles. Do
  not enable public catalogue publication until that inclusion policy is decided
  and tested.
- **Security fixes:** escaped `<` in JobPosting JSON-LD to prevent script-breakout
  XSS; restricted operational RLS reads to administrators; removed access to
  source configuration, payload/hash and errors from the web role; added a
  dedicated production crawler login so the web runtime cannot assume crawler
  write privileges; strengthened URL and database constraints; corrected the
  zero-body 204 analytics response.
- **Correctness/reliability fixes:** per-company and enrichment-worker advisory
  locks; dry-run no longer creates running ingestion records; duplicate listing
  rows are coalesced; different authoritative requisition IDs are not fuzzy-
  merged; malformed connector records fail safely; persistence failures are
  recorded; response bodies are capped; robots groups/ties/comments were fixed
  and unavailable robots now fail closed for HTML crawling; inactive jobs no
  longer show apply CTAs and are `noindex`; deadline-day handling uses the London
  calendar; category values now use stable internal keys.
- **AI fixes:** hosted enrichment defaults off; sponsorship evidence must be an
  exact source-description quote; schema failures no longer log model output;
  token/latency telemetry and a three-attempt ceiling were added; overlapping
  enrichment workers skip. Production enrichment still lacks the approved prompt
  pack, synthetic evaluation set, estimated-cost budget/alerts and recorded
  provider release review required by `docs/product/ai-product-strategy.md`.
- **Role boundary:** production workers require `JOB_CRAWLER_DATABASE_URL` for a
  dedicated `offerlab_crawler_login`. `offerlab_runtime_login` is deliberately
  not a member of `offerlab_crawler`.

The independent review replayed the migration and seed from zero and passed:
formatting, lint, strict type checking, production build, 542 unit tests, 198
integration tests, 28 existing end-to-end tests plus the new disabled-catalogue
regression test, environment checks, and the dependency security audit. Eight
environment-dependent end-to-end tests remained skipped. Local seed, status and
disabled dry-run worker commands also passed. No live employer crawl or hosted-AI
request was made during the independent review; the original live Greenhouse and
DeepSeek observations below are historical evidence only.

---

## Objective

Build a UK graduate job discovery and enrichment system inside the existing OfferLab
modular monolith (Next.js App Router + Supabase PostgreSQL) that:

- collects jobs directly from employer career sites and supported ATS job-board APIs
  (explicitly NOT LinkedIn, Indeed, Glassdoor, Reed or similar aggregators);
- records crawl permission per source (`allowed` / `unknown` / `blocked`) and never
  crawls sources that are not explicitly marked `allowed`;
- normalizes, deduplicates and stores jobs in Supabase;
- enriches jobs with a low-cost LLM (DeepSeek) using a strict, versioned schema with
  anti-hallucination rules;
- detects change via content hashing so unchanged jobs are never resent to the LLM;
- presents jobs to users via a polished public UI with honest provenance (source
  employer, freshness, official application link), SEO, saved jobs, and operational
  monitoring — deployable on a 2 GB AWS Lightsail instance while keeping Lightsail
  replaceable (all permanent data in Supabase).

## Architecture

```text
Employer career sites / ATS job-board APIs
  -> connectors (greenhouse | lever | ashby | smartrecruiters | workday* | generic-html)
       plain HTTP, configurable user-agent, timeouts, retries + exponential backoff,
       robots.txt gate (cached), per-source job/page caps
  -> change detection (sha256 content hash over meaningful fields)
       insert (enrichment pending) | update (hash changed, enrichment reset)
       | touch (hash unchanged, last_seen_at only) | deactivate (>= N consecutive misses)
  -> optional DeepSeek enrichment
       versioned prompt, strict zod output schema, honest "unknown" defaults,
       bounded retry, per-job model/version telemetry
  -> deduplication (same company only)
       1. company + external_job_id
       2. company + canonical source_url
       3. company + canonical application_url
       4. company + normalized title + normalized location + apply-host (fuzzy fallback)
  -> Supabase
       app.company, app.job, app.job_ingestion_run, app.job_source_event, app.user_saved_job
       web reads: offerlab_app + RLS          crawler writes: offerlab_crawler (no-login role)
  -> OfferLab UI
       /jobs (search, filters, pagination) -> /jobs/[slug] (JSON-LD, labelled AI summary,
       official apply link, sponsorship evidence)
       member saves -> /member/saved-jobs        ops -> /admin/job-sources + pnpm jobs:status
  scheduler: systemd timer -> tsx CLI worker (scripts/jobs/*) with concurrency limit and
       ±10% per-source jitter; the web process never crawls.
```

Module: `src/modules/job-catalog/` with `domain / application / infrastructure`
boundaries, mirroring the repo's modular-monolith conventions. All DB access is raw
parameterized SQL through postgres-js (`TransactionSql`), consistent with the
career-documents module; migrations remain the schema source of truth.

## Files Changed

### Created

| Path                                                                   | Purpose                                                                                        |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `supabase/migrations/20260810120000_job_catalog.sql`                   | All job catalog tables, indexes, RLS, roles, grants (see Database Changes).                    |
| `src/modules/job-catalog/domain/taxonomy.ts`                           | Job categories, seniority, employment type, remote type, visa sponsorship constants + parsers. |
| `src/modules/job-catalog/domain/urls.ts`                               | URL safety check, canonicalization (strips tracking params incl. `gh_src`), slugify.           |
| `src/modules/job-catalog/domain/content-hash.ts`                       | Versioned canonical content + sha256 hashing.                                                  |
| `src/modules/job-catalog/domain/html-text.ts`                          | Safe HTML -> plain text (scripts/styles stripped), truncation.                                 |
| `src/modules/job-catalog/domain/deduplication.ts`                      | `DiscoveredJob` type + identity resolution strategies.                                         |
| `src/modules/job-catalog/domain/change-detection.ts`                   | `planCrawlChanges`: insert/update/touch/deactivate/reactivate/missed-counter logic.            |
| `src/modules/job-catalog/domain/enrichment-schema.ts`                  | Enrichment output zod schema, versioned prompt builders, visa evidence validation.             |
| `src/modules/job-catalog/domain/scheduler.ts`                          | Due-source logic + jittered next-check computation.                                            |
| `src/modules/job-catalog/domain/catalog.ts`                            | Public filter parsing/serialization (search params).                                           |
| `src/modules/job-catalog/domain/source.ts`                             | Source registry domain types + `isCrawlable` gate.                                             |
| `src/modules/job-catalog/application/config.ts`                        | Crawler/enrichment configuration from env with defaults.                                       |
| `src/modules/job-catalog/application/ingestion.ts`                     | `runSourceCrawl`: gating, run bookkeeping, failure classification, company state transitions.  |
| `src/modules/job-catalog/application/enrichment.ts`                    | `runEnrichmentBatch`: concurrency-limited DeepSeek enrichment.                                 |
| `src/modules/job-catalog/application/catalog.ts`                       | Public query wrappers (search/detail/sitemap/filter options).                                  |
| `src/modules/job-catalog/application/saved-jobs.ts`                    | Member save/unsave/list.                                                                       |
| `src/modules/job-catalog/application/admin.ts`                         | Admin views + pause/permission actions.                                                        |
| `src/modules/job-catalog/application/seed-companies.ts`                | Deterministic example cohort (Monzo, Deliveroo, Skyscanner, Wise, Revolut).                    |
| `src/modules/job-catalog/infrastructure/crawler-database.ts`           | Crawler DB pool + `withCrawlerRole` + `jsonParameter`.                                         |
| `src/modules/job-catalog/infrastructure/logging.ts`                    | Module logger (pino, shared redaction list, tsx-safe).                                         |
| `src/modules/job-catalog/infrastructure/company-repository.ts`         | Company CRUD, due-source list, post-run state updates, seed upsert.                            |
| `src/modules/job-catalog/infrastructure/job-repository.ts`             | Job listing, `applyCrawlPlan` (transactional), enrichment state writes.                        |
| `src/modules/job-catalog/infrastructure/ingestion-run-repository.ts`   | Ingestion run + source event records.                                                          |
| `src/modules/job-catalog/infrastructure/catalog-repository.ts`         | Public search (FTS + filters), detail, sitemap queries.                                        |
| `src/modules/job-catalog/infrastructure/saved-job-repository.ts`       | Member save persistence.                                                                       |
| `src/modules/job-catalog/infrastructure/enrichment-provider.ts`        | DeepSeek chat-completions client with schema retry.                                            |
| `src/modules/job-catalog/infrastructure/connectors/errors.ts`          | Error taxonomy (`JobFetchError`).                                                              |
| `src/modules/job-catalog/infrastructure/connectors/http-client.ts`     | fetch wrapper: UA, timeout, retry/backoff, status classification.                              |
| `src/modules/job-catalog/infrastructure/connectors/robots.ts`          | robots.txt parser/evaluator with in-memory cache.                                              |
| `src/modules/job-catalog/infrastructure/connectors/types.ts`           | `JobSourceConnector` interface + `ConnectorContext`.                                           |
| `src/modules/job-catalog/infrastructure/connectors/greenhouse.ts`      | Greenhouse job-board API connector.                                                            |
| `src/modules/job-catalog/infrastructure/connectors/lever.ts`           | Lever postings API connector.                                                                  |
| `src/modules/job-catalog/infrastructure/connectors/ashby.ts`           | Ashby posting API connector.                                                                   |
| `src/modules/job-catalog/infrastructure/connectors/smartrecruiters.ts` | SmartRecruiters postings API connector.                                                        |
| `src/modules/job-catalog/infrastructure/connectors/workday.ts`         | Workday RaaS scaffold (requires per-tenant endpoint).                                          |
| `src/modules/job-catalog/infrastructure/connectors/generic-html.ts`    | Generic HTML careers listing connector (robots-gated).                                         |
| `src/modules/job-catalog/infrastructure/connectors/registry.ts`        | source_type -> connector factory map.                                                          |
| `src/modules/job-catalog/infrastructure/connectors/fixtures/*`         | Mock JSON/HTML fixtures for connector tests.                                                   |
| `scripts/jobs/*`                                                       | CLI worker scripts (see Scheduler).                                                            |
| `src/infrastructure/logging/redaction.ts`                              | Redaction paths extracted from logger.ts (byte-identical array; tsx-safe).                     |
| `src/app/jobs/page.tsx`                                                | Public job listing with filters/pagination.                                                    |
| `src/app/jobs/loading.tsx` / `error.tsx`                               | Skeleton loading + failure state.                                                              |
| `src/app/jobs/job-card.tsx` / `job-display.ts`                         | Job card component + formatting helpers.                                                       |
| `src/app/jobs/[slug]/page.tsx`                                         | SEO job detail page with JSON-LD, AI summary, sponsorship evidence.                            |
| `src/app/jobs/[slug]/save-job-button.tsx`                              | Client save/unsave control.                                                                    |
| `src/app/jobs/[slug]/apply-tracking.tsx`                               | Client apply-click beacon.                                                                     |
| `src/app/api/member/saved-jobs/route.ts`                               | POST/DELETE/GET saved jobs (owner-scoped).                                                     |
| `src/app/api/jobs/events/route.ts`                                     | Content-free analytics beacon (allow-listed events only).                                      |
| `src/app/member/saved-jobs/page.tsx`                                   | Member saved-jobs list.                                                                        |
| `src/app/admin/job-sources/page.tsx` + `actions.ts`                    | Admin source registry + pause/permission actions.                                              |
| `tests/integration/job-catalog.test.ts`                                | RLS two-user isolation, crawler role boundary, full crawl change cycle.                        |
| `docs/architecture/decisions/0022-job-catalog.md`                      | ADR for the architecture decision.                                                             |
| `docs/operations/job-catalog-operations.md`                            | Operations runbook (seeding, verification, systemd, Lightsail).                                |

### Modified

| Path                                            | What changed                                                                                                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.env.example`                                  | Added `JOB_*` and `JOB_ENRICHMENT_*` names only (values stay empty).                                                                                                |
| `package.json`                                  | Added `jobs:*` scripts and `node-html-parser` dependency.                                                                                                           |
| `pnpm-lock.yaml`                                | Lockfile for `node-html-parser`.                                                                                                                                    |
| `src/infrastructure/config/environment.ts`      | 17 new optional env keys + production gate for `JOB_CRAWLER_MODEL_DATA_APPROVED`.                                                                                   |
| `src/infrastructure/config/environment.test.ts` | Two production test fixtures now set the new gate flag (2 lines).                                                                                                   |
| `src/infrastructure/logging/logger.ts`          | Redaction array extracted to `redaction.ts` (verified byte-identical; logger behavior unchanged).                                                                   |
| `src/infrastructure/analytics/analytics.ts`     | 7 allow-listed property-free events: `jobs_search`, `job_filter_used`, `job_view`, `employer_apply_click`, `job_saved`, `job_match_started`, `job_match_completed`. |
| `src/app/sitemap.ts`                            | Added `/jobs` + active job entries (lastmod from `last_changed_at`).                                                                                                |
| `src/app/robots.ts`                             | Allowed `/jobs/` for crawlers.                                                                                                                                      |
| `src/app/admin/admin-shell.tsx`                 | Added "Job sources" nav link.                                                                                                                                       |
| `src/app/styles.css`                            | Job catalog page/card/detail/filters/admin styles (existing tokens).                                                                                                |
| `supabase/snippets/provision-runtime-roles.sql` | Grants `offerlab_crawler` to the production runtime login.                                                                                                          |
| `README.md`                                     | Added "Job catalogue" command section.                                                                                                                              |
| `docs/architecture/overview.md`                 | Added Job Catalog module description.                                                                                                                               |

**Unrelated files touched:** none. `next-env.d.ts` is regenerated by `pnpm build`
(Next 16 toolchain noise; reverted before handoff — it changes again whenever the
build runs and is not caused by this feature).

## Database Changes

Migration `supabase/migrations/20260810120000_job_catalog.sql` (applied cleanly from
zero via `pnpm db:reset`). All tables live in the `app` schema, use CHECK constraints
rather than PG enums (repo convention), and have RLS enabled **and forced**.

**`app.company`** — source registry. `name`, unique `slug`, `website_url`,
`careers_url` (not null), `logo_url`, `industry`, `country` (default `UK`),
`ats_provider`, `source_type` (direct_html|workday|greenhouse|lever|smartrecruiters|
ashby|custom|unknown), `crawl_allowed` (allowed|unknown|blocked, default unknown),
`crawl_status` (healthy|warning|failing|paused), `crawl_frequency_minutes`,
`last_checked_at`, `last_successful_check_at`, `next_check_at`,
`consecutive_failures`, `configuration` jsonb (connector tokens), `notes`, `active`,
timestamps. Constraints: slug pattern, http(s) URLs, frequency 15–10080 min,
failures 0–1000.

**`app.job`** — normalized jobs. `company_id` FK (restrict), unique `slug`,
`external_job_id`, `source_url`, `application_url` (not null), `title`,
`normalized_title`, `location_text`, `city`, `region`, `country`, `remote_type`
(remote|hybrid|on_site|unknown), `employment_type` (full_time|part_time|contract|
internship|graduate_programme|other|unknown), `seniority_level`, `job_category`,
salary fields (`numeric(14,2)`, `salary_max >= salary_min`), `description_raw`
(always NULL in this implementation — reserved for future raw capture),
`description_text`, `description_summary`, jsonb arrays `responsibilities`,
`requirements`, `skills`, `preferred_skills`, `degree_requirements` (bounded ≤20/≤20/
≤20/≤20/≤6), `experience_requirements`, `visa_sponsorship_status` (confirmed|likely|
unlikely|not_offered|unknown), `visa_sponsorship_evidence`, `application_deadline`,
`posted_at`, `first_seen_at`, `last_seen_at`, `last_changed_at`, `missed_crawls`
(0–100), `content_hash` (sha256 hex, 64 chars), `source_payload` jsonb,
`enrichment_status` (pending|completed|failed|skipped), `enrichment_model`,
`enrichment_version` (constraint: completed ⇒ version > 0), `enrichment_error`,
`active`.

**Indexes (app.job):** unique partial `(company_id, external_job_id)`,
unique partial `(company_id, source_url)`, unique partial `(company_id, application_url)`,
unique `slug`, plus `company_id`, `active`, `title`, `normalized_title`,
`job_category`, `country`, `city`, `posted_at desc` (partial), `application_deadline`
(partial), `first_seen_at desc`, `content_hash`, `enrichment_status` (partial on
pending/failed), `(active, posted_at desc, first_seen_at desc, id)`. Full-text:
generated `search_vector` column (A:title, B:normalized_title+location, C:
description_text, english config) with a GIN index.

**`app.job_ingestion_run`** — per-source observability: status (running|succeeded|
failed|skipped), all outcome counts, `error_count`, `error_summary`, `duration_ms`,
`metadata` jsonb. Indexes on `(company_id, started_at desc)` and `started_at desc`.

**`app.job_source_event`** — append-only audit trail: `kind` (crawl_succeeded|
crawl_failed|robots_blocked|source_paused|source_resumed|job_deactivated|
job_reactivated|source_disabled|enrichment_failed|listing_empty), message,
metadata. Indexes on `(company_id, occurred_at desc)` and `occurred_at desc`.

**`app.user_saved_job`** — `owner_user_id` FK → `app."user"`, `job_id` FK → `app.job`,
unique `(owner_user_id, job_id)`, index `(owner_user_id, created_at desc)`.

**RLS policies:** safe catalog columns on `company`/`job` are readable by
`offerlab_app`; ingestion runs and source events require an administrator identity;
`offerlab_crawler` maintains catalog and operational rows. Company mutations are
administrator-only. `user_saved_job` is owner-scoped for select/insert/delete and
`offerlab_crawler` has **no** grants on it.

**Roles:** new `offerlab_crawler` (nologin, noinherit) is granted to `postgres` for
local migration/test work and to a distinct production `offerlab_crawler_login`.
The web `offerlab_runtime_login` cannot assume it. Grants/revokes follow the repo
convention (nothing to `anon`/`authenticated`).

**Functions:** none added (no usage-reservation PL/pgSQL functions were needed).

## Job Ingestion

### Source registry

`app.company` is the system of record for sources. The crawler only processes rows
where `active` AND `crawl_allowed = 'allowed'` AND `crawl_status <> 'paused'`.
`unknown`/`blocked` sources are skipped and logged. Connector-specific tokens live in
`configuration` (jsonb): `greenhouseBoardToken`, `leverCompany`, `ashbyOrg`,
`smartRecruitersCompany`, `raasEndpoint` (Workday).

### Connectors implemented

All connectors are HTTP-first (no browser automation), implement
`discoverJobs(context)` and `healthCheck(context)`, and return the shared
`DiscoveredJob` shape. See "ATS Connectors" for verification status.

### Crawling flow

1. Load company; gate checks (active / allowed / not paused).
2. Create `job_ingestion_run` row (status `running`).
3. Run connector with per-source caps (`maxJobs` 500, `maxDetailPages` 40),
   timeouts (20s), retries (2 with exponential backoff), and robots gate (generic
   HTML).
4. Load existing jobs for the company; compute `planCrawlChanges`.
5. Apply plan in one transaction (insert/update/touch/deactivate/reactivate/
   missed-counter); insert assigns a unique slug (`{company-slug}-{title-slug}`,
   hash-suffixed on collision).
6. Finish the run row with outcome counts; record source events; update the company
   row: `last_checked_at`, `last_successful_check_at`, `next_check_at` (frequency
   ±10% jitter), `consecutive_failures` (reset on success).
7. On failure: classify error, increment `consecutive_failures`, set status
   `failing`, and **pause** (`crawl_status='paused'`) at the configurable threshold
   (default 5); record `crawl_failed` (+ `robots_blocked` where relevant). Failed
   crawls never touch job activity.

### Robots handling

`RobotsGate` fetches `robots.txt` per host (8s timeout, no retries), caches decisions
for 6h (configurable), and evaluates RFC-9309-style rules (group matching by our UA
token, `*` wildcards, `$` anchors, most-specific rule wins). An explicit disallow →
`robots_blocked` error and source event. Missing robots.txt → proceed (logged).
Only the generic-HTML connector actively checks robots today; ATS board APIs are
official public job-board APIs and are not robots-gated (documented assumption).

### Rate limiting / retries

No cross-source rate limiter beyond: configurable source concurrency (default 2),
per-source sequential request flow, 2 retries with exponential backoff (400ms × 2^n)
for transient failures (timeout, network, 429, 5xx), 403/404 treated as
non-retryable. Retry/backoff/limits live in `connectors/http-client.ts`.

### Content hashing

`content-hash.ts`: sha256 over a versioned JSON array (`JOB_CONTENT_HASH_VERSION=1`)
of meaningful fields — title, location, description text, employment type, remote
type, salary, period, deadline, application URL, posted date, external id.
Whitespace-normalized; invalid dates become null (no crash). Tracking params are
stripped at URL canonicalization before hashing.

### Change detection

`planCrawlChanges` (pure, unit-tested):

- new job → insert (enrichment `pending`);
- same hash → touch (`last_seen_at` only; **no LLM call**);
- hash changed → update source fields + `last_changed_at`, enrichment reset to
  `pending` (prior AI fields cleared — no stale summaries);
- previously inactive job rediscovered → reactivate + enrichment pending;
- active job absent from a **successful, non-empty** listing → `missed_crawls + 1`;
  deactivated only when `missed_crawls >= threshold` (default 2);
- empty or failed crawls never deactivate or increment anything.

### Job deactivation logic

Deactivation = `active = false` (row retained for archive/detail). Only from
non-empty successful listings after the consecutive-miss threshold. Reactivation
renews enrichment. Verified in unit tests + integration test.

### Deduplication

Same-company only. Order: (1) `external_job_id`, (2) canonical `source_url`,
(3) canonical `application_url`, (4) normalized title + normalized location +
matching apply host. Fuzzy strategy requires all three to match and an http(s)
apply host — no cross-company merging. Uniqueness is additionally enforced by the
three partial unique indexes.

## ATS Connectors

| Connector       | Status              | What was tested                                                                                                                                                                                                                                                                   | What remains uncertain                                                                                                                                                                                                                          |
| --------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Greenhouse      | **VERIFIED (live)** | Live crawl of Monzo's public board: 76 jobs discovered, normalized, inserted; second crawl → 76 unchanged / 0 new (change detection). Fixture tests for salary extraction, employment type, URL canonicalization, error classification (403/404/parser), missing token, job caps. | Other board tokens in the seed are unverified; `employment_type` values vary by tenant; salary only parsed from metadata entries named compensation/salary with a `£x - £y` range.                                                              |
| Lever           | PARTIALLY VERIFIED  | Fixture-based tests only (postings payload: titles, locations, commitment→employment type, workplaceType→remote/hybrid, createdAt→postedAt, HTML→text, missing token).                                                                                                            | No live run against a Lever board; `categories.workplaceType` may be absent on some postings; the API returns the full posting list in one response (no pagination), so very large boards are truncated by `maxJobs`.                           |
| Ashby           | PARTIALLY VERIFIED  | Fixture-based tests (jobs, employmentType mapping, remote boolean, compensationTierSummary salary parsing, paginationInfo loop, missing org).                                                                                                                                     | No live run; `compensationTierSummary` formats vary ("£50,000 - £65,000" parsed; other formats ignored); `remote: false` is left as unknown rather than on_site (deliberate honesty).                                                           |
| SmartRecruiters | PARTIALLY VERIFIED  | Fixture-based tests (list + detail fetch, description sections joined, location assembly, remote flag, missing token, 404 detail tolerated).                                                                                                                                      | No live run; detail fetches are capped at 100 (remaining jobs stored without descriptions); `continuationToken` pagination assumed from the documented API.                                                                                     |
| Workday         | **SCAFFOLDED ONLY** | Unit test only asserts `not_configured` until `raasEndpoint` is supplied.                                                                                                                                                                                                         | Workday has no stable public board API; RaaS JSON shapes vary per tenant (`Job_Requisition_Data` extraction is a best guess); will fail cleanly as `parser_changed`/`not_configured` until validated per tenant. Do NOT enable without testing. |
| Generic HTML    | PARTIALLY VERIFIED  | Fixture-based tests (listing link extraction, detail extraction incl. location/deadline heuristics, robots blocked listing + per-detail, parser_changed on no links).                                                                                                             | Real-world career pages vary enormously; heuristics (job-link regex, location/deadline patterns, main/article selection) will need per-site `custom` tuning; JS-rendered pages are unsupported (HTTP only).                                     |

**Honesty note:** only the Greenhouse path has been exercised against a real
employer. Nothing else should be considered verified until it has been run live
against the actual source and the output inspected.

## DeepSeek / LLM Enrichment

- **Model configuration:** reuses the existing `DEEPSEEK_API_KEY`,
  `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL` env vars; 30s timeout; temperature 0.1;
  `response_format: json_object`; thinking disabled. Master switch `JOB_LLM_ENABLED`
  (default false); production requires `JOB_CRAWLER_MODEL_DATA_APPROVED=true` when
  DeepSeek keys are set and enrichment is on.
- **Prompt/schema:** `JOB_ENRICHMENT_PROMPT_VERSION = 1`; system prompt demands
  extraction-only, no invention; user prompt contains title, location, description
  (truncated to 14k chars), salary, deadline, employment type, remote type, posted
  date — job data only, never member content.
- **Output schema (strict zod):** `normalizedTitle`, `jobCategory` (fixed taxonomy),
  `seniorityLevel`, `employmentType`, `remoteType`, `responsibilities` (≤12),
  `essentialRequirements` (≤12), `preferredRequirements` (≤12), `coreSkills` (≤20),
  `degreeRequirements` (≤6), `experienceRequirements`, `visaSponsorshipStatus`,
  `visaSponsorshipEvidence`, `descriptionSummary` (≤500). `.strict()` rejects extra
  keys; enums validated.
- **Validation:** zod parse + semantic rules (see visa safeguards). Provider retries
  once with a targeted repair instruction on schema failure; final failure is
  recorded as `enrichment_status='failed'` + `enrichment_error` and retried on the
  next batch run. Successful calls record `enrichment_model`, `enrichment_version`,
  input/output token counts.
- **Fields generated:** all of the above. Connector-provided `employment_type` /
  `remote_type` are only overwritten when the model returns a non-null value
  (`coalesce` in the write).
- **Hallucination safeguards:** extraction-only system prompt; strict schema;
  bounded array/string sizes; no inference of salary/deadline/qualification/location
  — those stay null when the posting doesn't state them; AI summaries are labelled
  in the UI; prior AI fields are cleared whenever source content changes.
- **Visa sponsorship safeguards:** status is `unknown` by default; `confirmed` /
  `likely` / `unlikely` / `not_offered` require explicit posting evidence; the model
  must return `visaSponsorshipEvidence` quoting the posting for any non-unknown
  status (validated server-side — `job_enrichment_visa_status_without_evidence`),
  and `unknown` must have `null` evidence
  (`job_enrichment_visa_evidence_without_status`). Both rules are unit-tested.
- **Enrichment versioning:** `JOB_ENRICHMENT_PROMPT_VERSION` recorded per job
  (`enrichment_version`) so results can be reprocessed when the prompt/schema bumps;
  a mismatch is logged.

## Scheduler

- Runs as CLI workers (tsx), not in the web process:
  - `pnpm jobs:crawl:due [--limit=N] [--dry-run]` — crawls due sources
    (`next_check_at <= now` or never-checked), ordered soonest-first, with
    concurrency `JOB_CRAWLER_MAX_CONCURRENCY` (default 2) and `next_check_at`
    jittered ±10% per source so companies do not burst at the same minute.
  - `pnpm jobs:crawl --company=<slug> [--dry-run]` — one source (manual test path).
  - `pnpm jobs:enrich [--limit=N] [--dry-run]` — enrichment batch
    (`JOB_ENRICHMENT_BATCH_LIMIT` default 20, LLM concurrency default 2).
  - `pnpm jobs:seed-companies --confirm-local`, `pnpm jobs:status`.
- Production scheduling: systemd oneshot + timer (documented in
  `docs/operations/job-catalog-operations.md`), e.g. hourly at `*:25:00` with
  `RandomizedDelaySec=300`.
- Duplicate simultaneous scheduler runs are prevented with a per-company PostgreSQL
  advisory lock. A second scheduled or manual run skips a source already in progress.
  Enrichment batches use a separate worker advisory lock.

## Frontend

- **`/jobs`** (public, server-rendered): search box (full-text), company select,
  location, category, employment type, seniority, remote mode, visa sponsorship,
  posted-within, deadline status, sort (recent | deadline soonest), pagination
  (page-size 24). URL-backed filters (shareable). Cards show: title, employer,
  freshness ("Verified from employer careers site today" only when
  `last_successful_check_at < 24h`), location, type/mode/category/salary/deadline,
  sponsorship badge (only when not unknown/unlikely), summary, up to 4 skill tags,
  "View details", "Apply on employer website" (nofollow, new tab). Loading skeleton
  (`loading.tsx`) and error state (`error.tsx`).
- **`/jobs/[slug]`** (public, SEO): metadata title/description + canonical,
  JobPosting JSON-LD containing only known fields (no fabricated salary/datePosted/
  validThrough/location/employmentType), source attribution ("Source: [Company]
  Careers"), official apply CTA + "Application is completed on the employer's
  official website", labelled "OfferLab summary" with an AI-disclaimer, facts list
  (type/mode/category/seniority/salary/deadline/posted/first seen/last checked/
  freshness), responsibilities/essential/preferred/skills/qualifications/experience
  sections, visa sponsorship with quoted evidence or "Not specified", footer
  disclaiming any employer partnership, save button, apply-click beacon. Inactive
  roles: rendered with an explicit "no longer listed as open" banner and **no**
  JSON-LD; excluded from the sitemap.
- **Saved jobs:** `SaveJobButton` (client, posts to `/api/member/saved-jobs`;
  401 → sign-in redirect), `/member/saved-jobs` listing with inactive badges.
- **SEO:** sitemap includes `/jobs` + up to 10k active job URLs (lastmod =
  `last_changed_at`); robots.txt allows `/jobs/`.
- **Analytics events:** allow-listed, property-free definitions added
  (`jobs_search`, `job_filter_used`, `job_view`, `employer_apply_click`,
  `job_saved`, `job_match_started`, `job_match_completed`). The analytics backend is
  `NoOpAnalytics` (pre-existing); only `employer_apply_click`/`job_view` are wired
  through the `/api/jobs/events` beacon. No GA4 script is installed (pre-existing
  state; adding a provider is future work).

## Security

- **RLS:** enabled + forced on all five tables; member saves owner-scoped
  (integration-tested with two users); crawler role cannot touch member saves
  (integration-tested).
- **Service role:** never used. Web reads use `offerlab_app`; crawler uses
  `offerlab_crawler`; both are no-login roles assumed server-side via
  `set local role`. No service-role key in any env template or code path.
- **External URL validation:** `canonicalizeJobUrl`/`isSafeWebUrl` reject non-http(s)
  protocols, credentials in URLs, and malformed URLs; used for stored source/apply
  URLs and before any fetch. All fetched URLs are validated http(s) first.
- **HTML sanitization:** scraped HTML is converted to plain text via
  `htmlToPlainText` (script/style/noscript/iframe/svg stripped); only plain text and
  structured arrays are stored; raw HTML is never rendered. `description_raw`
  remains NULL (reserved). URLs rendered in anchors come from validated http(s)
  sources; `rel="nofollow noopener noreferrer"` on external apply links.
- **Secrets:** DeepSeek key and DB credentials are server-side env only;
  `.env.example` has names only (validated by `env:example:check`); pino redaction
  list covers titles/slugs/URLs/companies/etc. (byte-identical after refactor).
- **API protection:** member endpoints use `hasSameOrigin` + `currentMemberAccess`;
  the events beacon is same-origin-gated and accepts only two allow-listed event
  names with no properties. **No rate limiting** exists on the public `/jobs` pages
  (server-rendered, DB-indexed) or the events endpoint (cheap, content-free).

## Performance / Lightsail (2 GB)

- Crawler is sequential per source with 2-source concurrency; each source uses one
  fetch at a time. Memory footprint is bounded: no page accumulation beyond the
  per-run caps (500 jobs × ~60k description text ≈ worst case a few tens of MB in
  the worker). Connectors hold raw JSON responses transiently.
- Enrichment runs with 2 concurrent DeepSeek calls; the JSON payloads are bounded
  (description truncated at 14k chars).
- **Playwright is NOT used and NOT installed.** `JOB_BROWSER_MAX_CONCURRENCY`
  exists only as a documented future limit. If a browser connector is ever enabled,
  each Chromium process uses ~200–400 MB — with a default of 1 that is safe, but a
  single instance plus the Next.js app plus the crawler on 2 GB leaves little head
  room; do not raise browser concurrency on Lightsail.
- Web app: `/jobs` queries use the listing index + GIN FTS; cards never load full
  descriptions (`description_summary` only). `/jobs/[slug]` loads one row with
  joined company. Sitemap caps at 10k rows.
- Known risk: `searchJobs` builds dynamic WHERE via `unsafe()` with parameterized
  values — safe SQL-injection-wise (all values parameterized; structure from fixed
  code paths), but worth an independent look (recommended review area).
- `maxConnections`: crawler DB pool is 3; Next uses its own pool (max 5). Both
  small.

## Tests Run

All commands were run on this machine against the local Supabase stack.

| Command                                                                                                    | Result                                                                                            |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `pnpm test:unit`                                                                                           | PASS — 76 files, 528 tests                                                                        |
| `pnpm test:unit` (job-catalog subset: `vitest run --config vitest.unit.config.ts src/modules/job-catalog`) | PASS — 14 files, 72 tests                                                                         |
| `pnpm test:integration`                                                                                    | PASS — 24 files, 197 tests (includes `tests/integration/job-catalog.test.ts`, `tests/security/*`) |
| `pnpm test:e2e`                                                                                            | PASS — 28 passed, 8 skipped (pre-existing skips), 0 failed                                        |
| `pnpm lint`                                                                                                | PASS                                                                                              |
| `pnpm typecheck`                                                                                           | PASS                                                                                              |
| `pnpm build`                                                                                               | PASS                                                                                              |
| `pnpm format:check`                                                                                        | PASS                                                                                              |
| `pnpm env:check`                                                                                           | PASS                                                                                              |
| `pnpm env:example:check`                                                                                   | PASS                                                                                              |
| `pnpm db:reset`                                                                                            | PASS — migration applies from zero; seed replays                                                  |
| Python tests                                                                                               | N/A — this repository has no Python codebase                                                      |
| Live crawl smoke test                                                                                      | PASS — Monzo Greenhouse board: 76 jobs inserted, second crawl 76 unchanged                        |
| Live enrichment smoke test                                                                                 | PASS — 2 real DeepSeek enrichments, visa sponsorship correctly `unknown`                          |

## Known Issues

1. **Production approval (P1 blocker):** the capability is outside the current
   founder-approved JSearch/manual-target boundary and remains default-off.
2. **Robots only enforced for generic HTML:** ATS board APIs are crawled without a
   robots.txt check. Assumed acceptable because they are official public job-board
   APIs, but the assumption is untested for some hosts.
3. **`searchJobs` uses `unsafe()`** only for constant query fragments and positional,
   parameterized values. The independent review found no user-controlled SQL
   fragment; keep this invariant under review when filters change.
4. **SmartRecruiters detail cap:** jobs beyond the 100-detail cap are stored
   without descriptions (enrichment will still run on whatever text exists).
5. **Workday is scaffold-only** and must not be enabled without per-tenant
   validation.
6. **Lever/Ashby/SmartRecruiters connectors are fixture-tested only** (no live run).
7. **Generic HTML heuristics** (link detection, location, deadline) are best-effort;
   per-site `custom` tuning expected.
8. **`city`/`region` columns are never populated** (location stays in
   `location_text`); the "Location" filter ILIKEs against text columns, which works
   but is not indexed.
9. **`description_raw` is always NULL** — reserved, unused.
10. **Analytics is NoOp** (pre-existing); job events are defined and partially
    wired but nothing ships anywhere until a provider is configured.
11. **No rate limiting** on public endpoints (pages are server-rendered; beacon is
    content-free). Acceptable today; revisit if the site is exposed to abuse.
12. **Seed cohort tokens are unverified** (Monzo was verified live; the rest are
    plausible-but-unconfirmed board identifiers) and every seed source starts
    `crawl_allowed='unknown'` by design.
13. **Inactive jobs keep their detail page** for saved-job history, with a banner,
    no apply CTA, no JSON-LD and `noindex` metadata.
14. **`generateMetadata` performs a DB read** for every detail request (no
    caching); fine at current scale.
15. **Local dev DB currently contains only the seeded cohort** (the e2e run reset
    the database); run `pnpm jobs:crawl --company=<slug>` after flipping
    `crawl_allowed` to `allowed` to populate it.
16. **Product contract:** this feature extends the current contract's
    job-discovery boundary (presently gated behind JSearch). A recorded founder
    decision is required before production crawling (flagged in ADR 0022).
17. **UK graduate targeting:** whole-company ATS feeds are not yet filtered by an
    approved inclusion policy, so the public catalogue must remain disabled.
18. **AI release gates:** the enrichment path still needs its reviewed prompt pack,
    synthetic evaluation set, estimated-cost budget/alerts and provider release
    review before it may be enabled in production.
19. **`next-env.d.ts`** is regenerated by `pnpm build` (toolchain noise; reverted
    for this handoff, it will flip back on the next build).

## External Dependencies / Manual Setup

- **Environment variables** (`.env.local` on the server; `.env.example` names
  only): `DATABASE_URL`, `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL`,
  optional `JOB_CRAWLER_USER_AGENT`, `JOB_CRAWLER_MAX_CONCURRENCY`,
  `JOB_LLM_MAX_CONCURRENCY`, `JOB_CRAWLER_TIMEOUT_MS`, `JOB_CRAWLER_MAX_JOBS_PER_SOURCE`,
  `JOB_CRAWLER_MAX_DETAIL_PAGES`, `JOB_CRAWLER_ROBOTS_CACHE_TTL_MS`,
  `JOB_CRAWLER_MISSING_THRESHOLD`, `JOB_CRAWLER_FAILURE_PAUSE_THRESHOLD`,
  `JOB_ENRICHMENT_BATCH_LIMIT`, `JOB_ENRICHMENT_PROMPT_VERSION`, `JOB_LLM_ENABLED`,
  `JOB_CRAWLER_MODEL_DATA_APPROVED` (production, when enrichment is on).
- **Supabase migrations:** apply `supabase/migrations/20260810120000_job_catalog.sql`
  (ordered last) to the production project; re-run
  `supabase/snippets/provision-runtime-roles.sql` so the runtime login may assume
  `offerlab_crawler`.
- **Source approval:** verify each employer's careers site/robots/terms and the
  board tokens; set `crawl_allowed='allowed'` per source (admin page or SQL).
- **systemd:** install the crawler service + timer (units in the ops runbook).
- **Playwright:** NOT required. Only install if a future source needs browser
  rendering.
- **DNS / TLS / web app process manager:** unchanged from the existing OfferLab
  deployment (out of scope for this feature).
- **API keys:** only DeepSeek (reuses existing config).

## Deployment Instructions

Full runbook: `docs/operations/job-catalog-operations.md`. Summary for AWS
Lightsail Ubuntu:

```bash
# 1. Node 24 + pnpm (if not already installed per the existing deployment)
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs
corepack enable && corepack prepare pnpm@11.9.0 --activate

# 2. Deploy code
cd /opt/offerlab && git pull
pnpm install --frozen-lockfile

# 3. Configure environment (edit /opt/offerlab/.env.local)
#    add the JOB_* variables and DEEPSEEK_* if enrichment is enabled

# 4. Apply migrations (controlled release step — see docs/operations/migrations.md)
#    run supabase/migrations/20260810120000_job_catalog.sql via DATABASE_MIGRATION_URL,
#    then re-run supabase/snippets/provision-runtime-roles.sql

# 5. Build and restart the web app with the existing process manager
pnpm build
sudo systemctl restart offerlab        # unit name depends on the existing setup

# 6. Seed the cohort and verify
pnpm jobs:seed-companies --confirm-local
pnpm jobs:status

# 7. Enable sources deliberately (after verifying tokens/terms) — admin page or SQL:
#    update app.company set crawl_allowed='allowed' where slug='monzo';

# 8. Install the crawler timer
sudo cp /etc/systemd/system/offerlab-jobs.service /etc/systemd/system/offerlab-jobs.timer
sudo systemctl daemon-reload
sudo systemctl enable --now offerlab-jobs.timer

# 9. Verify
sudo journalctl -u offerlab-jobs.service -n 50
```

## Rollback

- **Database:** this feature is fully additive (one new migration, no alterations
  to existing tables). To roll back: drop the catalog objects, e.g.:
  `drop table app.user_saved_job, app.job_source_event, app.job_ingestion_run, app.job, app.company cascade;`
  then `drop role offerlab_crawler;` and remove the runtime-login grant from the
  production snippet (no forward migration was applied that needs undoing). If you
  prefer an expand-contract approach, keep the tables but set every
  `app.company.active = false` — the crawler then skips everything and the UI
  shows an empty catalogue.
- **Application:** revert the commit(s) containing this feature; the web app does
  not depend on the new tables for any pre-existing route (`sitemap.ts`/`robots.ts`
  are the only pre-existing files wired to the catalog; a revert restores them).
- **Data:** jobs/saves live only in Supabase (nothing permanent on Lightsail);
  deleting the rows removes the feature completely.

## Recommended Review Areas (independent audit)

Highest-risk areas for Codex to inspect independently:

1. RLS correctness and role boundaries (`job-catalog.sql`, `tests/integration/job-catalog.test.ts`).
2. Absence of service-role key usage; env/secret handling; `.env.example` names-only.
3. `searchJobs` `unsafe()` parameterization (SQL injection review).
4. Deduplication edge cases (URL canonicalization set, fuzzy fallback, unique-index
   collisions on `slug`).
5. Job deactivation logic (threshold semantics, empty-listing guard, reactivation).
6. Scheduler advisory locks, jitter and due-selection query.
7. Crawler behaviour: retries/backoff, timeout handling, caps, `fetch` redirect
   following, robots rule evaluation (wildcard/anchor correctness).
8. Stored-XSS safety: `htmlToPlainText`, never rendering `source_payload` or raw
   HTML, all rendered strings escaping through React.
9. External URL handling end-to-end (validate → fetch → store → render).
10. LLM enrichment: prompt honesty, schema strictness, visa evidence rules,
    overwrite semantics (`coalesce`), retry behavior.
11. SEO JobPosting JSON-LD — only known fields; inactive jobs excluded.
12. Index/constraint coverage (partial unique indexes, FTS GIN, listing index).
13. 2 GB Lightsail resource usage; Playwright absent by design.
14. Unverified ATS connectors (Lever, Ashby, SmartRecruiters, Workday, generic HTML).

## Repository Status (at handoff)

- The entire feature is **uncommitted**: 14 tracked files modified, 12 new
  paths/directories untracked (including the migration, the module, tests, docs,
  and this report). Nothing has been staged or committed by this agent.
- No secrets or `.env` files are part of the diff; `.env.local` is gitignored.
- `next-env.d.ts` was reverted to HEAD (it is regenerated by `pnpm build`).
- The local DB currently contains only the deterministic seed cohort (no jobs);
  the e2e run reset it after the live crawl smoke test.
