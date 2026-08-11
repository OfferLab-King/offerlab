# CODEX_REVIEW_PROMPT.md

Copy the block below into your Codex session to run an independent review of the
job ingestion and discovery implementation.

---

## Review objective

Perform an independent production-readiness audit of the job ingestion and
discovery implementation in this repository. Do not trust the previous agent's
conclusions. Inspect the actual code and the git diff, run the tests yourself,
identify P0/P1/P2/P3 issues, fix P0/P1 issues and safe P2 issues, then rerun
validation.

## What to inspect

1. **`IMPLEMENTATION_REPORT.md`** (repository root) — treat it as a claim sheet to
   verify, not as ground truth. Specifically re-derive: connector verification
   status, test results, known issues, and the list of unverified assumptions.
2. **The git diff** — `git diff` for tracked files and `git status` for untracked
   paths. Confirm: no secrets, no `.env` files, no generated/cache files, no
   unrelated edits, and the migration is complete and correctly ordered.
3. **Supabase migrations and RLS** — `supabase/migrations/20260810120000_job_catalog.sql`:
   check every table's CHECK constraints and indexes, RLS enabled+forced, policy
   role boundaries (`offerlab_app` read, `offerlab_crawler` write, owner-scoped
   `user_saved_job`), grants/revokes, and the `offerlab_crawler` role grants
   (local migration + `supabase/snippets/provision-runtime-roles.sql`).
4. **Crawler/connectors** — `src/modules/job-catalog/infrastructure/connectors/`:
   HTTP client timeout/retry/backoff logic, error classification, robots.txt
   parser (wildcards, `$` anchors, most-specific rule), per-source caps, generic
   HTML heuristics, and the Workday scaffold's failure modes.
5. **Scheduling** — `scripts/jobs/`, `application/ingestion.ts`,
   `domain/scheduler.ts`: due-source selection, jitter, concurrency, and the
   per-company advisory locking and enrichment-worker locking; verify overlapping
   workers skip rather than issuing duplicate requests.
6. **Deduplication** — `domain/deduplication.ts` + `domain/urls.ts`: tracking-param
   stripping, canonicalization edge cases, the four match strategies, and slug
   collision handling in `infrastructure/job-repository.ts`.
7. **Inactive-job logic** — `domain/change-detection.ts`: missed-crawl counting,
   deactivation threshold, empty/failed-listing guards, reactivation, and
   enrichment-reset semantics.
8. **LLM enrichment** — `domain/enrichment-schema.ts`,
   `infrastructure/enrichment-provider.ts`, `application/enrichment.ts`: prompt
   honesty, strict zod schema, visa sponsorship evidence rules, retry/repair
   behavior, token telemetry, and `coalesce` overwrite semantics.
9. **Secrets** — scan the diff and the new module for API keys, service-role keys,
   connection strings with credentials, and accidental hardcoding. Confirm
   `.env.example` contains names only and `.env.local` is ignored.
10. **XSS/input sanitization** — `domain/html-text.ts`, and confirm raw HTML /
    `source_payload` is never rendered; verify every external URL path
    (validate → fetch → store → render) only allows http(s).
11. **Next.js frontend** — `src/app/jobs/*`, `src/app/api/*`, member saved jobs,
    admin job sources: server-side querying, URL-backed filters, loading/error
    states, accessibility of the new controls, and that no route handler issues ad
    hoc DB queries.
12. **SEO structured data** — `src/app/jobs/[slug]/page.tsx` JobPosting JSON-LD:
    only known fields; inactive roles excluded from JSON-LD and sitemap;
    canonical/robots correctness (`src/app/sitemap.ts`, `src/app/robots.ts`).
13. **Performance on 2 GB Lightsail** — crawler/enrichment memory bounds,
    concurrency defaults, absence of Playwright in the runtime path, DB pool
    sizes, and the `unsafe()` dynamic WHERE in `catalog-repository.ts`.

## Definitions

- P0 — breaks production data, privacy, or security (e.g. service-role exposure,
  RLS bypass, XSS vector, fabricated visa sponsorship claims, mass job deletion).
- P1 — clearly wrong behavior or a likely production failure (e.g. deactivation
  bug, dedupe collision, scheduler race that double-crawls, connector that will
  crash on real payloads).
- P2 — safe to fix, meaningful robustness/quality improvement (e.g. advisory lock,
  index tweaks, missing guards).
- P3 — cosmetic or nice-to-have; record but do not fix unless trivial.

## Constraints

- Do not add scope beyond the job ingestion/discovery feature.
- Do not bypass or weaken tests, RLS, or security checks to make validation pass.
- Do not enable crawling of sources with `crawl_allowed != 'allowed'`.
- Do not add Playwright/browser dependencies unless genuinely required.
- Preserve the repository's conventions (app schema, CHECK constraints, raw SQL
  migrations, module boundaries).

## Validation to run (and report exact results)

```bash
pnpm test:unit
pnpm test:integration
pnpm test:e2e
pnpm lint
pnpm typecheck
pnpm build
pnpm format:check
pnpm env:check && pnpm env:example:check
pnpm db:reset
```

Also run the job-catalog unit subset and the CLI workers against local Supabase:

```bash
pnpm exec vitest run --config vitest.unit.config.ts src/modules/job-catalog
pnpm jobs:seed-companies --confirm-local
pnpm jobs:status
```

A live crawl requires setting `crawl_allowed='allowed'` for one source first
(verify board tokens before doing so) — it is optional but the only way to verify
a connector end to end.

## Output

Report: what you inspected, issues found by severity (P0–P3) with file/line
references, what you fixed, and final validation results. Be explicit about what
remains unverified or unsafe. Update `IMPLEMENTATION_REPORT.md` and this prompt
only if your findings materially change the documented state.
