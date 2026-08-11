# Job catalog operations

This document describes how to seed, verify, schedule, deploy and debug the
OfferLab job catalogue (module `src/modules/job-catalog`).

## Data model summary

| Table                   | Purpose                                                                            | Roles                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `app.company`           | Source registry: careers URL, ATS type, crawl permission, frequency, failure state | safe-column `offerlab_app` read, `offerlab_crawler` write, admin write |
| `app.job`               | Normalized jobs, deduplication keys, content hash, enrichment state                | `offerlab_app` read, `offerlab_crawler` write                          |
| `app.job_ingestion_run` | Per-source crawl observability                                                     | administrator read, `offerlab_crawler` write                           |
| `app.job_source_event`  | Source-level audit trail (failures, robots decisions, deactivations)               | administrator read, `offerlab_crawler` write                           |
| `app.user_saved_job`    | Owner-scoped member saves (forced RLS)                                             | `offerlab_app` owner policies                                          |

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
| `JOB_CRAWLER_MODEL_DATA_APPROVED`                           | —                              | Required `true` in production when enrichment is on and DeepSeek keys are set |
| `DEEPSEEK_API_KEY` / `DEEPSEEK_BASE_URL` / `DEEPSEEK_MODEL` | —                              | Shared DeepSeek config reused by enrichment                                   |

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

> Production operation is not approved by this runbook. Keep
> `JOB_CATALOG_ENABLED=false` until founder approval extends the current JSearch
> boundary and records the UK graduate-role inclusion policy. DeepSeek enrichment
> additionally requires the AI strategy's evaluated prompt, provider, budget and
> kill-switch release gates.

## Adding a company

1. Verify the employer's careers site and robots policy, and confirm the ATS
   board token (for Greenhouse/Lever/Ashby/SmartRecruiters the official public
   job-board APIs are used).
2. Insert a row in `app.company` (or add it to the cohort in
   `src/modules/job-catalog/application/seed-companies.ts` and re-run the seed).
   Required: `name`, `slug`, `careers_url`, `source_type`, `crawl_frequency_minutes`.
   Connector tokens live in `configuration`:
   - Greenhouse: `{"greenhouseBoardToken": "<board>"}`
   - Lever: `{"leverCompany": "<company>"}`
   - Ashby: `{"ashbyOrg": "<org>"}`
   - SmartRecruiters: `{"smartRecruitersCompany": "<company>"}`
   - Workday: `{"raasEndpoint": "<tenant raas url>"}`
3. Record `crawl_allowed='allowed'` only after verifying the source. Until then
   keep `'unknown'` — the crawler skips non-allowed sources.
4. Verify with `pnpm jobs:crawl --company=<slug> --dry-run` first, then for real.
5. Watch `pnpm jobs:status` for failures; repeated failures pause the source
   automatically (`crawl_status='paused'`). Resume from
   `/admin/job-sources` or with
   `update app.company set crawl_status='healthy', consecutive_failures=0 where slug='<slug>';`

Frequency tier guidance: tier 1 (large high-value employers) 720 min,
tier 2 (important) 1440 min, tier 3 (lower priority) 2880 min. The scheduler
adds ±10% jitter to every next-check time so sources do not burst together.

## Priority UK employer cohort

The first source-onboarding programme is capped at 500 UK-relevant employers.
`directory_priority_rank` is an internal processing order, not a public league
table. `directory_visible` controls directory presence independently from
`crawl_allowed`; neither directory visibility nor priority permits crawling.

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
robots and terms, and record the permission decision. Never copy a commercial
directory's descriptions, rankings, jobs, logos or private identifiers.

The repository's initial visible tranche contains 39 bounded, identifier-
verified official career sources. They remain `crawl_allowed=unknown` until the
normal source review is completed. Expand this tranche toward 500 through the
same reviewed import path; do not bulk-enable it.

## Scheduling on the deployment host

The crawler is a CLI worker; run it with systemd. Two example units:

`/etc/systemd/system/offerlab-jobs.service`:

```ini
[Unit]
Description=OfferLab job catalog crawler and enrichment worker
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
Type=oneshot
User=offerlab
WorkingDirectory=/opt/offerlab
EnvironmentFile=/opt/offerlab/.env.local
ExecStart=/usr/bin/node /opt/offerlab/node_modules/.bin/tsx scripts/jobs/crawl-due.ts
ExecStartPost=/usr/bin/node /opt/offerlab/node_modules/.bin/tsx scripts/jobs/enrich.ts --limit=50
StandardOutput=append:/var/log/offerlab/jobs.log
StandardError=append:/var/log/offerlab/jobs.log
```

`/etc/systemd/system/offerlab-jobs.timer`:

```ini
[Unit]
Description=Run the OfferLab job crawler hourly
[Timer]
OnCalendar=*-*-* *:25:00
RandomizedDelaySec=300
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

The timer uses a randomized start within the hour; per-source jitter spreads
individual fetches further. `RandomizedDelaySec` plus `OnCalendar=*:25:00`
avoids fixed-minute bursts.

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

6. Seed the initial cohort and enable sources deliberately:

   ```bash
   pnpm jobs:seed-companies --confirm-local
   pnpm jobs:status
   ```

   Then record `crawl_allowed='allowed'` per source only after verifying terms
   and board tokens (admin page `/admin/job-sources` or SQL).

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
  can pause/resume sources and change crawl permission.
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

- Never crawl a source with `crawl_allowed` other than `allowed`.
- Never bypass bot protection, CAPTCHAs or authentication walls; no stealth
  scraping, proxy rotation or fingerprint evasion.
- robots.txt is an automated safety signal, not a complete legal permission
  system; verify employer terms before enabling a source.
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
- **Administrator overrides** (admin page): eligibility, classification,
  publication and source permission changes set
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

## Source verification and permission review

The seeded registry covers every top-level sector using identifiers verified
with single bounded, unauthenticated GETs against the official public ATS
job-board APIs (`scripts/jobs/verify-sources.ts` lists the exact requests).
Verification does **not** approve a source. Before enabling a source an
administrator must record a review on `/admin/job-sources` (review date,
robots result, terms result, evidence URL, notes) and set
`crawl_allowed='allowed'`. Unknown and blocked sources never run.

JSearch remains temporarily disabled (`JSEARCH_ENABLED=false`); the member
job-discovery page links into the catalogue and manual job targets continue to
work. Re-enabling JSearch requires a fresh founder decision.
