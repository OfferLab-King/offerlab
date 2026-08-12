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
| `JOB_BROWSER_MAX_CONCURRENCY`                               | `1`                            | Reserved for future browser rendering                                         |
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

The first source-onboarding programme is capped at 500 UK-relevant employers.
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

Expand the versioned cohort toward 500 through the same verified import path;
activate only records with confirmed connector configuration.

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

   (Playwright is NOT installed by default; the generic HTML connector is
   HTTP-only. Only `pnpm exec playwright install chromium` if a future source
   sets `needs_browser`.)

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
- Never bypass bot protection, CAPTCHAs or authentication walls; no stealth
  scraping, proxy rotation or fingerprint evasion.
- Never bypass bot protection, authentication or access controls.
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
