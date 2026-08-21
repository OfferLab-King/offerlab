# Job catalog operations

**Status:** Active operational reference

**Last reviewed:** 2026-08-21

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
| `JOB_CATALOG_ENABLED`                                       | `false`                        | Deployment and emergency release gate; enable after operational checks        |
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

## Employer identity and research universes

The full dated Home Office licensed-sponsor register is the canonical sponsor
identity universe. Exact case-insensitive legal identities remain distinct;
aliases may connect verified trading names without fuzzy-merging separate legal
organisations. Sponsor-only employers remain outside the default curated
directory but are available through exact search, the sponsor filter and member
employer selection.

The Top 1,000 workbook at `data/research/employer-targets/` is the curated
research, evidence and crawler-priority overlay. It is not the catalogue ceiling.
It is the human research
artifact; the deterministic machine-readable derivative lives at
`data/generated/employer-targets/top-1000.json` and is generated from the
workbook so they cannot drift.

```bash
pnpm jobs:targets:validate   # parse and validate the workbook (no DB)
pnpm jobs:targets:export     # regenerate data/generated/employer-targets/top-1000.json
pnpm jobs:targets:import --dry-run   # diff the dataset against the database
pnpm jobs:targets:import --confirm   # apply idempotently
pnpm jobs:sponsors:import --file=/absolute/register.csv --snapshot=YYYY-MM-DD
                                      # dry-run the full sponsor snapshot
pnpm jobs:sponsors:import --file=/absolute/register.csv --snapshot=YYYY-MM-DD --confirm-local
                                      # apply it to the local canonical universe
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
  URLs; import alone never crawls or promotes them. The separate typed-API
  verification pass may automate a candidate later;
- never touches `app.job_source`; existing live sources are preserved.

### External URL-validation review pass

A third-party review (for example a ChatGPT batch) can triage the 1,000
careers URLs without touching the workbook, the dataset or the database:

```bash
pnpm jobs:targets:export-validation-csv   # emits url-validation.csv (7 columns, no internal fields)
pnpm jobs:targets:merge-validation-reviews --input=<verdicts.json>  # merges verdicts into a review sheet
```

- The CSV is derived from `top-1000.json` and deliberately excludes every
  internal research field (scores, confidence, notes, evidence) — those are
  administrator-only and must never be exported to a third-party model.
- `careerSearchUrl` is the employer's general UK careers/job-search page and
  covers the full catalogue scope: the public catalogue is not limited to
  early-career work (general and experienced-hire roles appear too), and one
  employer may have separate early-career, professional, apprenticeship and
  general sources. The review should therefore validate the general board and
  additionally flag when a distinct early-career page exists.
- Ask the model for JSON-only verdicts per rank in batches of ~200–250 rows:
  `{"rank": 1, "verdict": "ok|suspect|better_url|needs_review", "suggestedUrl": "...", "earlyCareerUrls": ["..."], "reason": "...", "confidence": "high|low"}` —
  `earlyCareerUrls` is optional and captures separate graduate/early-career
  pages (an employer may have several program-specific subpages).
- The merge script matches verdicts by rank against the current dataset,
  reports unknown ranks, and writes
  `data/generated/employer-targets/url-validation-review.csv` with the
  current vs suggested URL, the early-career URLs and a `changed`/`unchanged`
  state column.
- `--import-candidates` additionally inserts accepted URLs into
  `app.job_source_candidate` as **unverified** candidates (`channel`
  general/early_careers, `discovery_method` external_url_review,
  `status` candidate_found). It never verifies URLs, never activates
  sources and never touches `app.job_source`; the rank→company mapping comes
  from the latest research snapshot, and ranks without a researched company
  are reported and skipped. Verify the candidates with
  `pnpm jobs:sources:automate`; unsupported candidates remain visible in
  `/admin/source-discovery`.
- Verdicts never edit anything: apply accepted corrections to the XLSX
  workbook (the source of truth) and regenerate with
  `pnpm jobs:targets:export`. URL liveness, redirects and robots policy are
  still verified by the real HTTP discovery pipeline (`--verify`), never by
  the review model.

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
pnpm jobs:sources:automate                      # verify typed APIs, activate and queue first crawls
pnpm jobs:discover-source --promote --confirm  # promote candidates already verified by typed API
pnpm jobs:discover-source --homepage           # discover careers links for P0/P1 employers without candidates
pnpm jobs:discover-source --company=<slug>     # one employer
pnpm jobs:discover-source --tier=P0 --limit=50 # a cohort, ordered by crawler priority
pnpm jobs:discover-source --offset=500         # page through large candidate sets (limit caps at 500)
pnpm jobs:careers:discover --max-queries=1000  # zero-cost plan for a sponsor discovery batch
pnpm jobs:careers:discover --max-queries=1000 --execute
                                                # explicitly authorise the bounded paid search batch
pnpm jobs:careers:discover-free                 # free DNS/HTTPS identity and homepage-link pass
pnpm jobs:careers:discover-free --dns-prefilter --concurrency=500
                                                # eliminate nonexistent domains before HTTP verification
```

Verification (`--verify`) persists independently of `--confirm`: it derives the
typed connector, probes the provider's real public API and validates its response
shape. `--automate` combines verification, complete configuration, activation and
the first durable crawl request. `--confirm` remains the gate for standalone
fingerprint applies, promotions and homepage discovery. Large candidate sets page
with `--limit=500` plus `--offset`.

Full-register discovery uses the official Brave web-search API only when
`BRAVE_SEARCH_API_KEY` is configured and `--execute` is present. Every batch is
hard-capped at 1,000 queries and prints the maximum provider cost before its first
request. A versioned administrator-only ledger advances every successful or
no-safe-match company and leaves provider failures eligible for retry, so each
invocation resumes without a fragile numeric offset. One exact legal-name query can retain
separate `general`, `early_careers`, `apprenticeships` and `professional`
candidates. Corporate domains are filled only from strong identity evidence;
government/company directories, job aggregators and social networks are
rejected. Search results remain inactive in the administrator discovery queue.
Run typed verification and automation separately; the search provider is never
an activation authority.

The free pass tries a deliberately small set of legal-suffix-free `.co.uk`,
and `.com` domains, then requires matching employer identity in both the
live hostname and homepage metadata before storing a website. It respects
robots.txt, applies the crawler's SSRF and response bounds, rejects parked or
unrelated domains, and stores a newly guessed website only when the verified
homepage also exposes a careers link. It extracts that strongest careers link and records checked
companies in its own versioned ledger. This has no provider fee and is safe to
run over the full register, but its conservative recall is lower than exact-name
web search.

Behaviour:

- fingerprinting is pure URL/host classification (Workday, Greenhouse, Lever,
  Ashby, SmartRecruiters, Oracle, SuccessFactors, TAL, iCIMS, Avature, Taleo,
  Teamtailor, Personio, Workable, PageUp, Recruitee, Eightfold) with no LLM;
- `--verify` respects robots.txt through the crawler's `RobotsGate` and records
  `typed_api_verified` only when the expected provider response shape is present;
- `--homepage` fetches employer homepages (robots-gated, bounded) for P0/P1
  employers that have real website evidence but no discovery candidate, scores
  careers links deterministically and inserts new `job_source_candidate` rows;
- verified high-confidence typed candidates create complete active
  `app.job_source` rows with the machine endpoint, connector configuration and a
  queued first crawl. Re-running repairs incomplete non-overridden sources and is
  idempotent; archived and manually overridden sources are never replaced;
- unsupported, weakly fingerprinted, blocked or shape-mismatched candidates stay
  inactive in `/admin/source-discovery` for exception review;
- `/admin/source-discovery` shows platform-grouped coverage (employers per
  platform by tier, verified and live counts) and the candidate queue; live
  source operations remain in `/admin/job-sources`.

The activation guard requires both a high-confidence host fingerprint and a
successful typed API response-shape probe, plus the existing URL-identity check.
A spreadsheet row, guessed URL or generic HTTP 200 can never activate a crawler
source.

## Platform adapter prioritisation (Phase C measurement)

The figures below are a historical 2026-08-13 baseline from the researched
dataset, not current full-register coverage. Re-run discovery and use the
current admin coverage view before choosing an adapter:

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
- Default visibility is curated: an employer is listed when it has current
  published roles or `directory_visible` is set. Exact employer search,
  sponsor filtering and member employer selection may additionally return
  sponsor-only identities outside that default browse set. Placeholder
  `employer.invalid` URLs are treated as absent, so nothing public links to
  them.
- Search and filters (industry, size, ownership, sponsor, hiring) are
  URL-backed; hiring-first, most-roles and A–Z sorts are supported; the
  directory is paginated (48 per page) and filtering/sorting happen in SQL.
- SEO: `isEmployerIndexable` now also qualifies credible researched profiles
  (no filler required), and the sitemap includes them; filtered directory
  URLs stay noindex.

### Hot-path public projections

The job search hot path never materialises the full `employer_public_profile`
view (its `current_jobs` aggregate scans the whole catalogue). Two narrow
security-barrier projections serve the hot paths instead:

- `app.employer_public_sponsor` — `(company_id, has_sponsor,
sponsor_snapshot_date)` derived from the administrator-only sponsor entity
  register; used by job search results, sponsor-licence filters and facets.
- `app.employer_public_search` — canonical name/aliases plus latest-snapshot
  employee band and ownership, for employer autocomplete and directory filter
  options.

Both are owned by the migration role, granted to `offerlab_app` (and
`offerlab_crawler` for read parity) and revoked from `public`/`anon`/
`authenticated`. Their facts mirror the corresponding columns of
`employer_public_profile`; the full view remains the single-profile and
directory contract.

### Deterministic performance fixtures

`scripts/jobs/perf-fixtures.ts` generates a deterministic synthetic employer
universe and job catalogue (reserved `.example.com` URLs, `perf-` prefixed
rows, idempotent cleanup on re-run) for web-request latency measurement:

```bash
PERF_COMPANIES=1000 PERF_JOBS=5000 pnpm tsx scripts/jobs/perf-fixtures.ts
```

It is a dev/benchmark tool only and never touches production data or sources.

## Public jobs facets (Phase F)

The `/jobs` catalogue search uses the new dimensions alongside the legacy
sector model:

- **Employer industry** (`c.employer_industry_key`) — what the employer is.
- **Job function** (`j.job_function_key`) — what the role does, never inferred
  from employer industry.
- **Career level** (`j.career_level_key`) — a filter, never a publication gate.
- **Work arrangement** (`j.remote_type`) is a separate facet from **Location**
  (cities only); legacy `locations=remote` URLs still filter.
- **Employer sponsor licence** filters through the public profile view
  (`employer_public_profile.has_sponsor`) and is distinct from **role-level
  sponsorship** (`j.visa_sponsorship_status`).
- Facet semantics stay disjunctive (OR inside a facet, AND across facets,
  counts exclude the counted facet's own selections); all filters are
  URL-addressable and filtered URLs remain noindex.
- Job cards and job detail pages surface the new dimensions plus the
  employer context panel (industry, size, ownership, sponsor status, official
  careers link). Internal crawler and research fields never render.

## Member integration (Phase G)

Canonical employers are linked into member workflows while free-text fallback
is preserved everywhere.

- **Saved employers**: owner-scoped `app.user_saved_employer` with forced RLS
  (policy and grants mirror `user_saved_job`). Save/remove from employer
  profiles; the member home shows a saved-employers strip; `/jobs` renders
  "Saved: <employer>" quick chips for signed-in members. Saves never create
  notifications or alerts without an explicit member preference.
- **Employer autocomplete**: `/api/employers/search` matches canonical names
  and aliases (aliases are exposed through the public profile view, which the
  member roles can read) and returns canonical company UUIDs. The application
  form and career job targets accept a nullable `company_id` alongside the
  required free-text company name.
- **Onboarding**: `onboarding_profile` gains canonical `target_industries`,
  `target_functions` and `preferred_locations`; legacy industry choices map
  deterministically to canonical industries when no explicit preference is
  supplied. The legacy columns and completion rule are unchanged.
- The public employer profile view appends an `aliases` jsonb column
  (employer trading names and sponsor legal entities) for autocomplete and
  search.

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
pnpm jobs:reclassify                       # re-run deterministic admission after rule changes
pnpm jobs:resolve-locations --confirm --limit=500 # resolve remaining Workday exceptions
pnpm jobs:enrich [--limit=N]               # enrich pending jobs
pnpm jobs:enrich --dry-run                 # count pending jobs
pnpm jobs:sources:automate                 # convert verified typed candidates into queued sources
```

All scripts load `.env.local` and require `DATABASE_URL` to reach the
application database in the historical setup. The current production worker
requires `JOB_CRAWLER_DATABASE_URL`; local development may use the local migration
connection and still immediately assumes the restricted `offerlab_crawler` role.

Keep `JOB_CATALOG_ENABLED=false` during deployment and migration, then enable it
after the registry, restricted worker credentials, monitoring and deterministic
UK publication gate have been verified. Enrichment has a separate kill switch.

## Adding an employer source

1. Run `pnpm jobs:sources:automate` first. For a supported ATS, OfferLab derives
   the connector token, probes the official API shape, configures the source,
   activates it and queues its first crawl without manual JSON entry.
2. Create or reuse the `app.company` identity, then create one `app.job_source`
   for each distinct channel (for example early careers and professional roles).
   Connector tokens live in `configuration`:
   - Greenhouse: `{"greenhouseBoardToken": "<board>"}`
   - Lever: `{"leverCompany": "<company>"}`
   - Ashby: `{"ashbyOrg": "<org>"}`
   - SmartRecruiters: `{"smartRecruitersCompany": "<company>"}`
   - Workday CXS: `{"cxsEndpoint": "https://<host>/wday/cxs/<tenant>/<site>"}`
   - Workday RaaS: `{"raasEndpoint": "<tenant raas url>"}`
3. Keep unsupported or incomplete connector records paused; never guess an ATS
   identifier. Manual configuration is the exception path.
4. Verify with `pnpm jobs:crawl --company=<slug> --source=<slug> --dry-run` first.
5. Watch `pnpm jobs:status` for failures; repeated failures pause the source
   automatically. Resume or correct the source from `/admin/job-sources`.

During ingestion, malformed individual vacancies are counted as rejected and
quarantined; they do not fail a source that still returns valid vacancies.
Workday aggregate locations are resolved from bounded detail JSON-LD first, with
the official job path used only as a conservative UK-positive fallback. Run the
location resolver after a large initial import; clear foreign records are
suppressed automatically and only unresolved mixed evidence remains in the admin
exception queue.

Frequency tier guidance: tier 1 (large high-value employers) 720 min,
tier 2 (important) 1440 min, tier 3 (lower priority) 2880 min. The scheduler
adds ±10% jitter to every next-check time so sources do not burst together.

## Curated research and priority cohort

The full licensed-sponsor snapshot is the canonical identity universe. The
researched Top 1,000 (founder decision 2026-08-13) supersedes the historical
500-employer ceiling as the curated research and crawler-priority overlay.
Researched employers, default directory profiles, source candidates, verified
sources and active sources intentionally have different counts.
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
  can request runs, pause/resume sources and correct source URLs. Sources
  show consecutive zero-result crawls and the last time they produced jobs:
  a source that previously had active jobs and suddenly returns an empty
  listing on a successful crawl is recorded as a `partial` run with a
  `listing_empty_anomaly` event — verify the board before trusting the empty
  result. Jobs are never closed by a failed or zero-result crawl.
- Per-job lifecycle events (`app.job_event`: discovered, updated,
  possibly_closed, closed, reopened) are recorded by the ingestion
  transaction with field-level diffs for updates; they are the foundation for
  "new today", "recently updated", "recently closed", job alerts and
  employer update feeds.
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

## Admin scale-up (Phase H)

- **Employer detail console** (`/admin/employers/[id]`, linked from the
  research table): identity and aliases, Home Office sponsor entities with
  routes and snapshot dates, the latest internal research snapshot (tier,
  rank, scores, evidence, notes), discovery candidates and the live source
  list with health/mode. Live source operations remain in
  `/admin/job-sources`.
- **Crawler capability analytics** (`/admin/source-discovery`): employers
  with careers URL, verified and platform-identified candidates, employers
  with live sources and jobs, live source counts split by browser vs HTTP,
  sources grouped by type, and jobs grouped by ATS provider. This is the
  browser-to-HTTP optimisation signal: sources recorded as browser-only can
  be reviewed for stable endpoints and direct-HTTP replay.
