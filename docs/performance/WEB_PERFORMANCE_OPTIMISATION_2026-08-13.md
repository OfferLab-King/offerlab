# OfferLab web performance optimisation — 2026-08-13

Scope: warm and cold web request latency for `/`, `/jobs`, `/employers`, job
detail and employer detail, measured in production mode (`next start`) against
a local Postgres 17 catalogue with deterministic synthetic fixtures
(`scripts/jobs/perf-fixtures.ts`). No product features, crawler architecture,
URLs, facet semantics, RLS or SEO behaviour were removed.

## 1. Root causes confirmed

1. **`/jobs` performed 14 sequential DB round trips per request.** Results,
   count, salary probe and 11 disjunctive facet counts each awaited a separate
   query with its own WHERE rebuild (verified by proxy instrumentation:
   14 awaited queries per request).
2. **`app.employer_public_profile` was joined into every job query.** The view
   materialises catalogue-wide aggregates (`current_jobs` scans the whole
   `app.job` table, plus live sources, sponsor presence, aliases) even when
   the hot path only needed `has_sponsor`. At 50k jobs this added ~32ms per
   reference (results query and the sponsor-licence `EXISTS` both re-evaluated
   it).
3. **`/employers` loaded the whole directory into application code.** All
   1,000 employer profiles were fetched (view materialisation included) and
   filtered/sorted in JavaScript.
4. **Signed-in `/jobs` loaded the entire employer directory** just to render a
   handful of saved-employer chips (`listSavedEmployersForMember`).
5. **Employer autocomplete and directory filter options re-materialised the
   full view** per request.
6. **Detail pages ran their queries sequentially** and joined the full view.

## 2. Root causes rejected

- **Turbopack/dev-mode compilation**: measured separately; production-mode
  warm latency was the target. Dev-mode cold compilation is a first-request
  cost only.
- **`dev:jobs` crawler contention**: the poller already runs as a separate
  child process; with an idle poller (batch limit 3) web latency and CPU were
  unchanged (`/jobs` 179ms dev vs 170ms dev:jobs at 50k jobs). No change made.
- **Missing hot indexes**: the catalogue indexes (`job_public_catalogue_idx`,
  sector/subsector/opportunity indexes, company industry index, sponsor and
  snapshot company indexes) already exist and were used by the plans.
- **PostgreSQL itself**: 1,000 employers / 50k jobs is trivial for Postgres;
  the cost was per-request work shape, not data size.

## 3. Before measurements (production mode, warm p50)

| Route                               | 5k jobs | 50k jobs |
| ----------------------------------- | ------- | -------- |
| `/jobs`                             | 101ms   | 578ms    |
| `/jobs` multi-filter                | 116ms   | 485ms    |
| `/jobs` keyword                     | 84ms    | 280ms    |
| `/employers`                        | 82ms    | 97ms     |
| `/employers?industry=…`             | 28ms    | 49ms     |
| job detail `/jobs/[slug]`           | 49ms    | 212ms    |
| employer detail `/employers/[slug]` | 29ms    | 63ms     |
| `/`                                 | 6ms     | 5ms      |

## 4. Changes made

- **`searchJobsFaceted` rewritten as one SQL statement, one round trip**: a
  shared `base` CTE (visible jobs joined to company) is materialised once; the
  page rows, count, salary probe and every disjunctive facet read it.
  Disjunctive semantics unchanged — each facet still excludes only its own
  selections; a pure `buildJobFilterClauses` option set (`onlyFacets`,
  `excludeAllFacets`, location/sponsor condition refs) keeps the clause
  builder the single source of truth. Page rows sort/limit inside the
  statement and join the wide tables only for the 24 returned ids.
- **Narrow public sponsor projection** (`app.employer_public_sponsor`,
  migration 20260813200000): job search reads `has_sponsor`/snapshot date
  from this view instead of the full profile view; the sponsor-licence filter
  in `buildJobFilterClauses` uses it too. Source of truth remains
  `app.employer_sponsor_entity`; the view is derived and never written.
- **Narrow public search projection** (`app.employer_public_search`, same
  migration): autocomplete and directory filter options read name/aliases and
  latest-snapshot band/ownership without catalogue aggregates.
- **Job card/detail queries** (`findJobDetail`, `findJobsByIds`,
  `listCompanyActiveJobs`, related roles) join the sponsor projection and a
  `lateral` latest-snapshot lookup instead of the full view.
- **`findEmployerPublicProfile`** replaced the view with a direct query
  (indexed snapshot/sponsor/job-source lookups).
- **`/employers`**: filters, sorts and pagination (48/page) moved into SQL
  with truthful windowed totals; filter options come from the narrow search
  projection; size bands now order semantically (1-49 → 100,000+) instead of
  lexicographically; pagination links preserve URL filters.
- **Saved-employer chips**: bounded `WHERE id = any(...)` projection instead
  of the whole directory.
- **Page request paths parallelised** (`/jobs`, `/jobs/[slug]`,
  `/employers/[slug]`): auth/session, catalogue and member-state lookups run
  concurrently; member-only queries still never run for anonymous visitors.
- **60s in-process facet cache for the unfiltered `/jobs` state** (facets +
  salary probe only; rows, counts and saved state always come from the
  database). Public data only, never member-specific.
- **`scripts/jobs/perf-fixtures.ts`**: deterministic synthetic benchmark
  fixtures (idempotent, `.example.com` URLs only).

## 5. After measurements (production mode, warm p50, 5k jobs = representative)

| Route                   | Before | After | % change |
| ----------------------- | ------ | ----- | -------- |
| `/jobs`                 | 101ms  | 37ms  | −63%     |
| `/jobs?page=2`          | —      | 37ms  | —        |
| `/jobs` industry filter | 75ms   | 54ms  | −28%     |
| `/jobs` multi-filter    | 116ms  | 49ms  | −58%     |
| `/jobs` keyword         | 84ms   | 34ms  | −60%     |
| `/jobs` location filter | 77ms   | 54ms  | −30%     |
| `/employers`            | 82ms   | 29ms  | −65%     |
| `/employers?industry=…` | 28ms   | 17ms  | −39%     |
| job detail              | 49ms   | 36ms  | −27%     |
| employer detail         | 29ms   | 24ms  | −17%     |
| `/`                     | 6ms    | 6ms   | —        |

50k-job stress (first request vs cached facet state):

| Route                | Before | After (full)                      | After (cached unfiltered) |
| -------------------- | ------ | --------------------------------- | ------------------------- |
| `/jobs`              | 578ms  | 328ms                             | 92ms (page-only path)     |
| `/jobs` keyword      | 280ms  | 61ms                              | —                         |
| `/jobs` multi-filter | 485ms  | 238ms                             | —                         |
| job detail           | 212ms  | ~40ms (DB 14.5ms + related ~65ms) | —                         |
| employer detail      | 63ms   | ~30ms                             | —                         |

## 6. DB round-trip reductions

| Operation                                | Before                                     | After                                    |
| ---------------------------------------- | ------------------------------------------ | ---------------------------------------- |
| `/jobs` (results+count+salary+11 facets) | 14 queries                                 | 1 statement / 1 round trip               |
| `/jobs` cached unfiltered                | 14                                         | 1 (page-only statement)                  |
| `/employers`                             | 2 queries (full directory + sector counts) | 3 SQL calls incl. bounded page + options |
| job detail related sections              | 2 sequential + view joins                  | 2 parallel, no view joins                |
| saved employers for signed-in `/jobs`    | full directory query                       | 1 bounded `id = any(...)`                |

## 7. Query-plan improvements

- The `/jobs` statement materialises the visible-job base once; facets
  aggregate over it in memory instead of 11 re-scans of the job table.
- `employer_public_profile` (full-table `current_jobs` scan) is no longer in
  any job-search plan; `employer_public_sponsor` is a 700-row aggregate with
  a `company_id` index.
- Detail queries use indexed snapshot (`employer_snapshot_company_idx`),
  sponsor (`employer_sponsor_company_idx`) and job-location
  (`job_location_job_idx`) lookups.

## 8. Index changes

None added. The existing index set (visibility partial index, sector/
subsector/opportunity, company industry, sponsor/snapshot company indexes)
already supported the hot patterns; plans confirmed no additional index was
justified.

## 9. Caching changes

- 60-second in-process cache of the **unfiltered** `/jobs` facet state
  (public counts + salary probe) in `job-catalog/application/catalog.ts`.
  Invalidation: fixed TTL; crawls refresh the next request after expiry.
  Rows, counts and member data are never cached; the cache is a single
  module-level entry and never keyed by member.

## 10. dev vs dev:jobs findings

- Warm latency at 50k jobs: `/jobs` 179ms (`pnpm dev`) vs 170ms (`pnpm
dev:jobs`); `/employers` 110ms vs 146ms — no material web-latency impact
  from the local poller.
- The poller is already a separate child process (dev-with-jobs supervisor);
  idle-poller CPU was ~0%. Browser crawling is bounded (concurrency 1) and
  only runs for `needs_browser` sources. No change needed.

## 11. Remaining bottlenecks

- **Filtered `/jobs` at 50k+ jobs**: facet counts still aggregate the full
  visible-job base per request (~240-350ms at 50k, ~450ms at 100k). The
  unfiltered case (dominant traffic) is cached; filtered states recompute.
  Next lever: caching filtered facet states keyed by the filter signature, or
  lazy-loading secondary facets — only if the catalogue actually reaches that
  size.
- **`listSimilarJobs`** (~63ms at 50k): the OR-similarity predicate over the
  catalogue is inherently scan-ish; fine at realistic scale.
- **`sectorJobCounts`** footer (~34ms at 50k, ~5ms at 5k): one visibility
  scan per `/employers` request.
- **Pre-existing E2E failures** (confirmed on the pre-change codebase):
  mobile `auth-invite` member-menu click; a wrong heading assertion in
  `job-catalog-enabled.spec.ts` (fixed in this PR).

## 12. Future improvements (only if the catalogue grows)

- Filtered-facet cache keyed by filter signature with explicit invalidation
  on crawl publication events.
- Push `sectorJobCounts` into the directory statement or a maintained
  projection.
- Revisit `listSimilarJobs` with a narrower similarity strategy if 100k+ jobs
  become real.
