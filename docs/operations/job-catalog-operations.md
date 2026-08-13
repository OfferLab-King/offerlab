# Job catalog operations

This document describes how to seed, verify, schedule, deploy and debug the
OfferLab job catalogue (module `src/modules/job-catalog`).

## Data model summary

| Table                   | Purpose                                                                  | Roles                                                                  |
| ----------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `app.company`           | Public employer identity and directory metadata                          | safe-column `offerlab_app` read, `offerlab_crawler` write, admin write |
| `app.job_source`        | Careers channel, connector, schedule, URL health and manual run requests | administrator read/write, `offerlab_crawler` write                     |
| `app.job`               | Normalized jobs, deduplication keys, content hash, enrichment state      | `offerlab_app` read, `offerlab_crawler` write                          |
| `app.job_ingestion_run` | Per-source crawl observability                                           | administrator read, `offerlab_crawler` write                           |
| `app.job_source_event`  | Source-level audit trail (failures, robots decisions, deactivations)     | administrator read, `offerlab_crawler` write                           |
| `app.user_saved_job`    | Owner-scoped member saves (forced RLS)                                   | `offerlab_app` owner policies                                          |

The crawler role `offerlab_crawler` is a no-login role. Production uses a separate
`offerlab_crawler_login`; the web runtime login is deliberately not a member of
the crawler role. Provision the dedicated login with
`supabase/snippets/provision-runtime-roles.sql` and configure its connection string
as `JOB_CRAWLER_DATABASE_URL`.

```sql
grant offerlab_crawler to offerlab_crawler_login;
```

## Environment variables

All names-only entries live in `.env.example`; local values in `.env.local`.
Relevant keys:

| Variable                                                    | Default                        | Purpose                                                                       |
| ----------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------- |
| `JOB_CATALOG_ENABLED`                                       | `false`                        | Master release gate; keep false until the required founder decision           |
| `JOB_CRAWLER_DATABASE_URL`                                  | —                              | Dedicated production crawler login connection string                          |
| `JOB_CRAWLER_USER_AGENT`                                    | `OfferLabJobCrawler/1.0 (...)` | Crawler user agent                                                            |
| `JOB_CRAWLER_MAX_CONCURRENCY`                               | `2`                            | Concurrent sources in `jobs:crawl:due`                                        |
| `JOB_BROWSER_MAX_CONCURRENCY`                               | `1`                            | Concurrent browser-rendered (`needs_browser`) sources                         |
| `JOB_LLM_MAX_CONCURRENCY`                                   | `2`                            | Concurrent enrichment calls                                                   |
| `JOB_CRAWLER_TIMEOUT_MS`                                    | `20000`                        | Per-request timeout                                                           |
| `JOB_CRAWLER_MAX_JOBS_PER_SOURCE`                           | `500`                          | Hard cap per source per run                                                   |
| `JOB_CRAWLER_MAX_DETAIL_PAGES`                              | `40`                           | Detail pages for generic HTML sources                                         |
| `JOB_CRAWLER_ROBOTS_CACHE_TTL_MS`                           | `21600000`                     | robots.txt decision cache (6h)                                                |
| `JOB_CRAWLER_MISSING_THRESHOLD`                             | `2`                            | Consecutive misses before deactivation                                        |
| `JOB_CRAWLER_FAILURE_PAUSE_THRESHOLD`                       | `5`                            | Failures before automatic pause                                               |
| `JOB_ENRICHMENT_BATCH_LIMIT`                                | `20`                           | Jobs per enrichment run                                                       |
| `JOB_ENRICHMENT_PROMPT_VERSION`                             | `1`                            | Prompt/schema version recorded on jobs                                        |
| `JOB_LLM_ENABLED`                                           | `false`                        | Master enrichment switch                                                      |
| `JOB_LOCAL_WORKER_POLL_INTERVAL_MS`                         | `5000`                         | Local `dev:jobs` poll interval; minimum `1000`                                |
| `JOB_LOCAL_WORKER_BATCH_LIMIT`                              | `3`                            | Sources per local `dev:jobs` poll (1–25)                                      |
| `JOB_CRAWLER_MODEL_DATA_APPROVED`                           | —                              | Required `true` in production when enrichment is on and DeepSeek keys are set |
| `DEEPSEEK_API_KEY` / `DEEPSEEK_BASE_URL` / `DEEPSEEK_MODEL` | —                              | Shared DeepSeek config reused by enrichment                                   |

## Employer research universe (Top 1,000)

The workbook at `data/research/employer-targets/` is the human research
artifact; the deterministic machine-readable derivative lives at
`data/generated/employer-targets/top-1000.json` and is generated from the
workbook so they cannot drift.

```bash
pnpm jobs:targets:validate   # parse and validate the workbook (no DB)
pnpm jobs:targets:export     # regenerate data/generated/employer-targets/top-1000.json
pnpm jobs:targets:import --dry-run   # diff the dataset against the database
pnpm jobs:targets:import --confirm   # apply idempotently
```

The import is typed, deterministic, idempotent and provenance-preserving. It:

- matches researched employers to canonical `app.company` identities with a
  confidence-gated matcher; ambiguous identities stay research-only for
  administrator review;
- creates canonical employer identity rows (never activating sources);
- records Home Office sponsor legal entities one-to-many per employer;
- stores dated research snapshots with scores, employee evidence, ownership
  and confidence (internal research data, never public rankings);
- creates unverified `app.job_source_candidate` rows for researched career
  URLs; candidates are never crawled and never auto-promoted to
  `app.job_source`;
- never touches `app.job_source`; existing live sources are preserved.

## Taxonomy dimensions (Phase D)

The employer-industry, job-function and career-level dimensions are
backward-compatible additions over the legacy sector/subsector model. After
the migration, populate them from research and legacy classification:

```bash
pnpm jobs:taxonomy:backfill            # dry-run report of planned updates
pnpm jobs:taxonomy:backfill --confirm  # fill only NULL cells; idempotent
```

Rules:

- employer industry comes from the Top 1,000 research snapshot sector, falling
  back to the legacy directory sector;
- job function derives from the job's own legacy subsector classification,
  never from employer industry;
- career level derives from opportunity type and seniority; general and
  experienced roles remain valid catalogue records;
- the deterministic classification pipeline writes the new job dimensions for
  every discovered or changed job (review-gated like the legacy dimensions);
- nothing reads the new dimensions publicly yet; public facets and onboarding
  migrate in later phases.

Research tables (`app.employer_alias`, `app.employer_sponsor_entity`,
`app.employer_research_snapshot`, `app.job_source_candidate`) are
administrator-only. The `/admin/employers` page is the research/operations
view; `/admin/job-sources` remains the live source operations page.

## Source discovery (research → live sources)

Deterministic ATS/platform fingerprinting turns the researched universe into a
discovery backlog without touching the crawler or activating anything.

```bash
pnpm jobs:discover-source                      # fingerprint candidates (dry run)
pnpm jobs:discover-source --confirm            # apply fingerprint updates
pnpm jobs:discover-source --verify             # bounded HTTP verification of careers URLs
pnpm jobs:discover-source --promote --confirm  # create paused sources for verified candidates
pnpm jobs:discover-source --homepage           # discover careers links for P0/P1 employers without candidates
pnpm jobs:discover-source --company=<slug>     # one employer
pnpm jobs:discover-source --tier=P0 --limit=50 # a cohort, ordered by crawler priority
```

Behaviour:

- fingerprinting is pure URL/host classification (Workday, Greenhouse, Lever,
  Ashby, SmartRecruiters, Oracle, SuccessFactors, TAL, iCIMS, Avature, Taleo,
  Teamtailor, Personio, Workable, PageUp, Recruitee, Eightfold) with no LLM;
- `--verify` respects robots.txt through the crawler's `RobotsGate` and marks
  candidates `verified` only after a successful bounded fetch;
- `--homepage` fetches employer homepages (robots-gated, bounded) for P0/P1
  employers that have real website evidence but no discovery candidate, scores
  careers links deterministically and inserts new `job_source_candidate` rows;
- `--promote` creates `app.job_source` rows in `paused` state for verified,
  high-confidence candidates; sources are never activated by discovery;
  re-running is idempotent and never overwrites existing sources for the same
  URL or a manually-overridden source; verified candidates can also be
  promoted from the `/admin/source-discovery` queue;
- `/admin/source-discovery` shows platform-grouped coverage (employers per
  platform by tier, verified and live counts) and the candidate queue; live
  source operations remain in `/admin/job-sources`.

The promotion guard uses the fingerprint high-confidence host match and the
existing URL-identity check, so a spreadsheet row or guessed URL can never
become an active crawler source.

## Platform adapter prioritisation (Phase C measurement)

Measured coverage of the researched universe (2026-08-12 dataset, as of the
2026-08-13 discovery run) drives adapter decisions:

- **Workday: 15 employers, all P0** — the dominant reusable platform; the
  native Workday CXS/RaaS connectors already cover it.
- **Greenhouse / Lever / Ashby / SmartRecruiters: 4 employers each** — native
  connectors already cover them.
- **Custom branded careers portals: ~9 employers** (Amazon jobs, Google
  careers, Apple, EY, PwC, Babcock, Marriott, Admiral) — employer-specific;
  covered by `direct_html` and browser connectors, not reusable adapters.
- **Oracle: 1, SuccessFactors: 1, TAL: 0** — no missing platform currently
  unlocks more than one employer, so no new typed adapter is justified yet.

Adapter build rule (from the founder directive): implement a typed reusable
connector only when a platform shows repeated measured frequency (at least
2-3 verified employers). The discovery pipeline is the measurement tool; the
moment a platform crosses the threshold (e.g. after `--homepage` expansion or
new research evidence), register the connector in
`src/modules/job-catalog/infrastructure/connectors/registry.ts`, add the
`source_type` enum value and update `sourceTypeForPlatform` in
`ats-fingerprint.ts`.

## Public employer directory (Phase E)

The public `/employers` directory and `/employers/[slug]` profiles read the
`app.employer_public_profile` security-barrier view — the privacy-safe
contract between the researched universe and the public routes.

- The view exposes only verifiable employer facts (industry, size band,
  ownership, ticker/exchange, sponsor presence and snapshot date, official
  URLs, current roles). Internal research fields (tier, rank, scores,
  confidence, notes) are never selected by the view and never reach public
  pages.
- Visibility is quality-based: an employer is listed when it has current
  published roles, is explicitly curated (`directory_visible`), or carries a
  credible researched profile (verified industry plus size/ownership/sponsor
  evidence and an official URL). Placeholder `employer.invalid` URLs are
  treated as absent, so nothing public links to them.
- Search and filters (industry, size, ownership, sponsor, hiring) are
  URL-backed; hiring-first, most-roles and A–Z sorts are supported.
- SEO: `isEmployerIndexable` now also qualifies credible researched profiles
  (no filler required), and the sitemap includes them; filtered directory
  URLs stay noindex.

## Local CMS-triggered crawling

The CMS **Run now** control never crawls inside the web request. It records a
durable run request on `app.job_source` (`run_requested_at` and the requesting
administrator) and the worker executes it.

For local development, run the web app and the crawler worker together:

```bash
pnpm dev:jobs
```

This starts Next.js and a local poller beside it. The poller invokes the same
due-source worker as production (`pnpm jobs:crawl:due --limit=3`) every five
seconds by default, so a CMS **Run now** request is picked up promptly and the
page transitions through **Queued** → **Running** → latest result. The ordinary
`pnpm dev` command does not execute queued work; the poller only runs when
`JOB_CATALOG_ENABLED=true`.

Tunables: `JOB_LOCAL_WORKER_POLL_INTERVAL_MS` (minimum 1000ms) and
`JOB_LOCAL_WORKER_BATCH_LIMIT` (1–25, default 3). Polls never overlap, a failed
poll is logged and retried on the next interval, and Ctrl+C stops Next.js and
the worker together. Production keeps using the systemd service and timer below;
the same source locks and due-worker logic remain authoritative in both modes.

> **Local persistence warning:** a local database that contains persistent
> accounts (such as an administrator identity), jobs, sources or crawl history
> must never be reset or wiped. Never run `pnpm db:reset`, `pnpm validate`,
> `pnpm db:seed`, `pnpm test:integration` or `pnpm test:e2e` against such a
> database; use them only against disposable, purpose-built test databases.
> `dev:jobs` itself never invokes reset, seed, migration or test commands.

## Commands

```bash
pnpm jobs:seed-companies --confirm-local   # seed/update the example cohort (idempotent)
pnpm jobs:status                           # operational snapshot: sources, runs, events
pnpm jobs:crawl --company=<slug>           # crawl one source now
pnpm jobs:crawl --company=<slug> --dry-run # crawl one source without DB writes
pnpm jobs:crawl:due [--limit=N]            # crawl all due sources
pnpm jobs:crawl:due --dry-run              # report due sources without crawling
pnpm jobs:enrich [--limit=N]               # enrich pending jobs
pnpm jobs:enrich --dry-run                 # count pending jobs
```

All scripts load `.env.local` and require `DATABASE_URL` to reach the
application database in the historical setup. The current production worker
requires `JOB_CRAWLER_DATABASE_URL`; local development may use the local migration
connection and still immediately assumes the restricted `offerlab_crawler` role.

Keep `JOB_CATALOG_ENABLED=false` during deployment and migration, then enable it
after the registry, restricted worker credentials, monitoring and deterministic
UK publication gate have been verified. Enrichment has a separate kill switch.

## Adding an employer source

1. Verify the employer's careers site and robots policy, and confirm the ATS
   board token (for Greenhouse/Lever/Ashby/SmartRecruiters the official public
   job-board APIs are used).
2. Create or reuse the `app.company` identity, then create one `app.job_source`
   for each distinct channel (for example early careers and professional roles).
   Connector tokens live in `configuration`:
   - Greenhouse: `{"greenhouseBoardToken": "<board>"}`
   - Lever: `{"leverCompany": "<company>"}`
   - Ashby: `{"ashbyOrg": "<org>"}`
   - SmartRecruiters: `{"smartRecruitersCompany": "<company>"}`
   - Workday: `{"raasEndpoint": "<tenant raas url>"}`
3. Keep incomplete connector records paused; never guess an ATS identifier.
4. Verify with `pnpm jobs:crawl --company=<slug> --source=<slug> --dry-run` first.
5. Watch `pnpm jobs:status` for failures; repeated failures pause the source
   automatically. Resume or correct the source from `/admin/job-sources`.

Frequency tier guidance: tier 1 (large high-value employers) 720 min,
tier 2 (important) 1440 min, tier 3 (lower priority) 2880 min. The scheduler
adds ±10% jitter to every next-check time so sources do not burst together.

## Priority UK employer cohort

The researched Top 1,000 employer universe (founder decision 2026-08-13)
supersedes the historical 500-employer ceiling. Visibility is driven by data
quality and product usefulness; researched employers, public profiles, source
candidates, verified sources and active sources may each have different
counts. The versioned cohort manifest remains a bootstrap/core source
manifest.
`directory_priority_rank` is an internal processing order, not a public league
table. `directory_visible` controls directory presence independently from each
source's operational status.

Selection is refreshed at least annually and uses a documented combination of:

1. current UK candidate-demand evidence, beginning with the current
   [Times Top 100 Graduate Employers](https://t100ge.uk/);
2. employers with a material UK presence from current listed-company and large
   private-employer sources, checked against an official employer website;
3. major public employers, informed by current
   [ONS public-sector employment data](https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/publicsectorpersonnel)
   and department-level government workforce statistics;
4. deliberate sector coverage so the cohort is not dominated by finance,
   consulting and listed companies.

For each candidate record the evidence URL, evidence date, selection basis,
official website and proposed sector. Before the candidate becomes a crawler
source, separately verify the official careers URL and ATS identifier, review
the connector endpoint. Never copy a commercial
directory's descriptions, rankings, jobs, logos or private identifiers.

Expand through the researched employer universe import path
(`pnpm jobs:targets:import`); a spreadsheet row never activates crawling, and
only records with confirmed connector configuration become live sources.

## Scheduling on the deployment host

The crawler is a CLI worker. Install the versioned units from
`deploy/systemd/offerlab-jobs.service` and `deploy/systemd/offerlab-jobs.timer`.
The timer polls every five minutes so CMS run requests are picked up promptly;
each source still retains its own daily or explicitly configured schedule.

Reference unit contents:

`/etc/systemd/system/offerlab-jobs.service`:

```ini
[Unit]
Description=OfferLab targeted employer crawler
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=offerlab
WorkingDirectory=/srv/offerlab/current
EnvironmentFile=/etc/offerlab/jobs.env
ExecStart=/usr/bin/corepack pnpm jobs:crawl:due --limit=25
```

`/etc/systemd/system/offerlab-jobs.timer`:

```ini
[Unit]
Description=Poll OfferLab due and manually requested job sources
[Timer]
OnCalendar=*:0/5
RandomizedDelaySec=30
Persistent=true
[Install]
WantedBy=timers.target
```

Enable with:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now offerlab-jobs.timer
sudo journalctl -u offerlab-jobs.service -n 100   # inspect runs
```

The timer adds a short randomized delay and per-source jitter spreads daily work.

## Deploying on AWS Lightsail (Ubuntu)

The web app and the crawler worker run on the same instance; permanent data
lives in Supabase, so the instance remains replaceable.

1. Install Node.js 24 and pnpm:

   ```bash
   sudo apt-get update && sudo apt-get install -y ca-certificates
   curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
   sudo apt-get install -y nodejs
   corepack enable && corepack prepare pnpm@11.9.0 --activate
   ```

   Browser-rendered crawling of bot-walled public career sites is approved
   (founder decision 12 August 2026). For `needs_browser` sources, install
   Chromium with `pnpm exec playwright install chromium` and keep
   `JOB_BROWSER_MAX_CONCURRENCY` low. The generic HTML connector remains
   HTTP-only and checks robots.txt.

2. Deploy the repository and install dependencies:

   ```bash
   sudo mkdir -p /opt/offerlab
   sudo chown $USER /opt/offerlab
   git clone <repo> /opt/offerlab
   cd /opt/offerlab
   pnpm install --frozen-lockfile
   ```

3. Configure: copy `.env.example` to `/opt/offerlab/.env.local`, fill in
   Supabase URL/keys, `DATABASE_URL`, `AUTH_RATE_LIMIT_SECRET`,
   `DEEPSEEK_*`, `JOB_CRAWLER_MODEL_DATA_APPROVED=true` (only if enrichment is
   approved and enabled), and crawler tunables.

4. Apply migrations (controlled release step; see `docs/operations/migrations.md`):

   ```bash
   pnpm db:reset            # local only, never production
   # production: run supabase/migrations/*.sql in order via the migration
   # database URL, then re-run the role provisioning snippet.
   ```

5. Build and run the web app with your existing process manager (systemd unit
   recommended; the current deployment pattern is documented in
   `docs/operations/authentication.md`):

   ```bash
   pnpm build
   # example systemd unit:
   # ExecStart=/usr/bin/node /opt/offerlab/node_modules/.bin/next start -p 3000
   ```

6. Import the versioned cohort and inspect source status:

   ```bash
   pnpm jobs:seed-companies --confirm-local
   pnpm jobs:status
   ```

   Keep incomplete connector records paused. Confirm official URLs and board
   identifiers before setting a source active in `/admin/job-sources`.

7. Install the crawler timer (above), then verify:

   ```bash
   sudo systemctl start offerlab-jobs.service
   sudo journalctl -u offerlab-jobs.service -n 50
   ```

8. Restart services after deploys:

   ```bash
   sudo systemctl restart offerlab  # web app unit name depends on your setup
   sudo systemctl restart offerlab-jobs.timer
   ```

## Debugging

- `pnpm jobs:status` gives a snapshot of sources, runs and events.
- `/admin/job-sources` (administrator) shows the same data in the browser and
  can request runs, pause/resume sources and correct source URLs.
- Structured logs use `event` names such as `job_source_crawl_succeeded`,
  `job_source_crawl_failed`, `job_source_skipped`, `robots_txt_unavailable`,
  `job_enrichment_failed`. Sensitive fields (titles, URLs, slugs, companies)
  are redacted by the shared pino redaction list.
- Error codes on runs: `network_timeout`, `network_error`, `http_403`,
  `http_404`, `http_429`, `http_error`, `robots_blocked`, `parser_changed`,
  `source_unavailable`, `not_configured`, `unsupported`.
- Enrichment failures are recorded per job (`enrichment_status='failed'`,
  `enrichment_error`) and retried on the next `jobs:enrich` run.

## Honesty and safety rules

- Crawl only active sources; paused, archived and repeatedly failing sources do not run.
- Browser-rendered crawling of public, unauthenticated employer career pages
  (including pages behind JavaScript challenges or anti-bot walls) is approved
  by the founder decision of 12 August 2026. Keep browser concurrency bounded
  and pace requests; sources remain public and unauthenticated.
- Only successful, non-empty crawls can deactivate jobs (after the
  consecutive-miss threshold). Failed crawls never touch job activity.
- User-facing pages show freshness only after a successful crawl and clearly
  label AI-generated summaries. Application always happens on the employer's
  official site.

## Eligibility, classification and publication pipeline

Every ingested or changed job passes through the deterministic pipeline
(`src/modules/job-catalog/application/classification-pipeline.ts`):

- **Eligibility** (`domain/eligibility.ts`): `eligible` / `ineligible` /
  `needs_review` with machine-readable reasons and exact source-phrase
  evidence. Strong early-career signals (graduate, intern, placement,
  apprenticeship, training contract, vacation scheme, work experience, KTP,
  entry-level, junior) make a role eligible; senior signals (senior, lead,
  principal, staff, manager, director, head of, VP, executive, several-years
  experience requirements) make it ineligible; conflicting signals force
  `needs_review`. Expired or closed applications are ineligible. Ambiguous
  roles are never automatically published.
- **Classification** (`domain/classification.ts`): sector + subsector from the
  fixed taxonomy, derived deterministically from department/team then title
  keywords. Low-confidence or ambiguous matches stay unclassified (admin queue).
- **Publication**: eligible → `published`; needs_review → `draft`;
  ineligible → `suppressed`. Jobs missing from successful crawls are
  deactivated and set to `expired`. Only `eligible` + `published` + `active`
  roles with a future deadline are publicly visible (single predicate in
  `domain/publication.ts`).
- **Indexability**: the public detail page, its metadata and structured data,
  and the sitemap share one deterministic policy
  (`domain/job-indexability.ts`). An indexable role must be publicly visible,
  have an official application URL, the employer's original posting date, and
  enough visible stored description content to support valid JobPosting data
  (a factual summary, responsibilities, requirements or experience). Location,
  taxonomy or salary alone cannot qualify a thin page. A publicly valid but thin role still renders normally but
  is `noindex, follow`, emits no JobPosting structured data and is excluded
  from the sitemap; the sitemap SQL is an exact mirror of the domain policy
  and parity is covered by `tests/integration/job-detail-seo.test.ts`.
  Job detail pages also link compact, bounded related-role sections (more
  roles at the same employer and similar current roles), sourced through the
  job-catalog application boundary and limited to public, non-expired roles.
- **Administrator overrides** (admin page): eligibility, classification,
  publication and source changes set
  `classification_source='administrator'`, bump `classification_version`, and
  write an audit event. Rows owned by an administrator are never reclassified
  or republished by the pipeline.

## Retention and deletion

- Suppressed, draft and expired job rows are retained for archive/debugging;
  they are never publicly visible and never appear in the sitemap.
- A suppressed or expired row may be purged once it has not been seen for 180
  days and has no member saves:
  ```sql
  delete from app.job j
  where j.active = false
    and j.publication_status = 'expired'
    and j.last_seen_at <= now() - interval '180 days'
    and not exists (select 1 from app.user_saved_job s where s.job_id = j.id);
  ```
- `job_location`, `job_ingestion_run` and `job_source_event` rows cascade with
  their job/company. No member content, employer marketing copy or aggregator
  editorial content is ingested; source descriptions are stored as plain text
  only and never rendered as HTML.

## Source verification and URL health

The seeded registry covers every top-level sector using identifiers verified
with single bounded, unauthenticated GETs against the official public ATS
job-board APIs (`scripts/jobs/verify-sources.ts` lists the exact requests).
Landing pages and connector endpoints have independent health fields, including
redirect destinations and invalid-since timestamps. Administrators can correct
URLs and request a bounded run from `/admin/job-sources`; manual corrections are
preserved by cohort imports. Incomplete or invalid records remain paused.

JSearch remains temporarily disabled (`JSEARCH_ENABLED=false`); the member
job-discovery page links into the catalogue and manual job targets continue to
work. Re-enabling JSearch requires a fresh founder decision.
