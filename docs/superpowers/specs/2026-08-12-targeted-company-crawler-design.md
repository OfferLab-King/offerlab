# Targeted UK Company Crawler Design

**Date:** 12 August 2026  
**Status:** Founder-approved design  
**Worktree:** `targeted-company-crawler`  
**Branch:** `codex/targeted-company-crawler`

## Purpose

Replace the current one-company/one-source crawler model with a reusable,
source-isolated system that discovers UK vacancies from major employers'
official public career sites every day. Administrators must be able to maintain
employers and multiple career sources, request an immediate run, inspect source
health, correct changed URLs, and review ambiguous jobs without executing crawler
network traffic in the web process.

The first release onboards a carefully verified priority cohort of approximately
100 employers and supports expansion to 500 without another schema redesign.
The catalogue covers graduate, internship, placement, apprenticeship, entry-level,
and experienced professional roles.

## Founder decisions recorded by this design

1. Global employers are eligible when they have material UK operations, but only
   UK-located vacancies may be published in OfferLab.
2. Employer and crawl-source identities are separate. One employer may own many
   independently scheduled sources.
3. Official, unauthenticated public employer career pages do not require a
   separate manual crawl-permission or terms-review gate. The existing
   `crawl_allowed` workflow and documentation will be removed. Operational
   enable/pause/archive controls remain.
4. The initial production cohort is approximately 100 carefully verified priority
   employers, not 500 unverified records. The same workflow must scale to 500.
5. DeepSeek V4 Flash through OpenCode Go is the preferred optional job-review and
   structuring provider. Deterministic ingestion remains complete and usable when
   AI is disabled or unavailable.

These decisions amend the earlier source-permission and graduate-only wording in
`docs/architecture/founder-decisions.md`,
`docs/product/current-product-contract.md`, ADRs 0022/0023, and
`docs/operations/job-catalog-operations.md`. Implementation must update those
authoritative documents rather than leaving contradictory restrictions in place.

## Goals

- Crawl each active source on a jittered 24-hour schedule without manual action.
- Let administrators request an immediate crawl through CMS and see its progress.
- Represent early-career, professional, apprenticeship, and general sources
  independently for the same employer.
- Preserve both the curated public landing-page URL and the machine-readable crawl
  endpoint, and report when either changes or becomes invalid.
- Prevent a run from one source deactivating jobs belonging to another source.
- Admit only UK-located jobs into public publication and SEO surfaces.
- Keep the existing modular-monolith, least-privilege crawler role, official ATS
  connectors, change detection, and safe publication pipeline.
- Use AI only for grounded structuring of new or materially changed jobs.
- Provide a version-controlled, idempotent employer/source onboarding manifest
  whose imports never overwrite administrator corrections silently.

## Non-goals

- Aggregator scraping, authenticated sources, CAPTCHA solving, proxy rotation, or
  bot-protection bypass.
- A microservice, message queue, cache, Kubernetes workload, or separate API.
- Publishing non-UK vacancies.
- Using AI as the sole UK classifier, publication authority, or source of facts.
- Creating a public employer ranking from the internal priority cohort.
- Automatically replacing curated URLs after a redirect.

## Architecture

The job catalogue remains a module inside the single Next.js application. Its
network crawler runs only in the existing CLI worker using the dedicated
`offerlab_crawler` database role. The web process may maintain registry data and
request work, but cannot assume the crawler role or make crawler requests.

```text
app.company (public employer identity)
  -> app.job_source (one independently governed career source)
       -> app.job (source-owned normalized vacancy)
       -> app.job_ingestion_run (source-owned execution history)
       -> app.job_source_event (source-owned health/audit events)
```

The source, rather than the employer, is the unit of scheduling, locking, failure
tracking, change detection, URL health, and manual execution.

## Data model

### `app.company`

Retain employer identity and directory/SEO concerns:

- stable ID, name, slug, aliases, website, description, and sector metadata;
- directory visibility, internal priority band/rank, and selection evidence;
- public employer-page fields and timestamps.

Crawler configuration, scheduling, review, and health fields move out of this
table. Compatibility columns remain during the expand-and-contract migration and
are removed only in a later migration after the source model is proven.

### `app.job_source`

Add a child record containing:

- `id`, `company_id`, stable `slug`, display `name`;
- `channel`: `early_careers`, `professional`, `apprenticeships`, `general`, or
  `other`;
- `source_type` and validated connector `configuration`;
- `careers_url` for the human-facing official page;
- optional `crawl_endpoint_url` for the official feed/API endpoint;
- lifecycle `status`: `active`, `paused`, or `archived`;
- `crawl_frequency_minutes` (1440 by default), `next_check_at`, and
  `run_requested_at`;
- last check/success timestamps, consecutive failures, and automatic-pause reason;
- separate landing-page and endpoint health state: last status code, final URL,
  checked time, error code, and `invalid_since`;
- verification provenance, manifest version, manual-override marker, notes, and
  audit timestamps.

Active verified sources are eligible for scheduling without a separate
`crawl_allowed` or terms-review decision.

### Source ownership

Add a required `source_id` foreign key to `app.job`,
`app.job_ingestion_run`, and `app.job_source_event` after backfill. Keep
`company_id` on jobs as a deliberate denormalized public-query key, protected by
constraints or application checks so it matches the source employer.

External job uniqueness becomes source-scoped. Change detection lists existing
jobs by `source_id`; missing-job counters and deactivation operate only inside that
source. Runs and events display both employer and source names.

### Migration strategy

1. Create `app.job_source`, indexes, constraints, RLS policies, and grants.
2. Create one source for every existing company crawler configuration.
3. Add nullable `source_id` columns and backfill jobs, runs, and events.
4. Add source-scoped uniqueness/indexes and make source ownership required.
5. Deploy source-aware repositories, worker, admin application services, and UI.
6. Stop writing employer-level crawler fields while retaining compatibility reads
   during rollout.
7. Remove obsolete employer crawler fields only through a later forward migration.

Migration replay, crawler-role access, application-role access, and public/member
RLS isolation require integration tests.

## Scheduling and manual runs

A committed systemd oneshot service and timer invoke the due-source worker every
five minutes. The worker queries only active sources whose `next_check_at` is due
or whose `run_requested_at` is set. Normal success schedules the next run at 24
hours with jitter. Manual requests are prioritised and consumed atomically.

Global and per-source PostgreSQL advisory locks prevent overlapping workers and
duplicate runs. A stale-running-run recovery pass remains. Default concurrency is
small and configurable.

The CMS **Run now** action records the administrator, request time, and source ID;
it does not fetch the source in the web request. The worker acknowledges the
request when the run starts. If the source is paused, CMS must make the conflict
explicit instead of silently resuming it.

Repeated failures automatically pause only the failing source. Failed and empty
runs never deactivate jobs. Other sources belonging to the employer continue.

## URL health and correction

The public careers landing page and machine endpoint are checked and reported
independently. Health captures HTTP status, final URL, check time, bounded failure
code, and invalid-since time. Redirects create a suggestion/event; they never
silently overwrite a manually curated URL.

The CMS permits accepting a detected redirect or entering a correction manually.
Manual changes set the override marker so later manifest imports do not replace
them. `401`, `403`, `404`, repeated `429`, timeouts, malformed feeds, and parser
changes are visible source events. The crawler uses bounded requests, an
identified user agent, low concurrency, daily source frequency, jitter, response
size limits, and `Retry-After` handling.

## UK-location admission

Location admission is deterministic and runs before automatic publication:

- **UK confirmed:** at least one normalized location is in England, Scotland,
  Wales, or Northern Ireland, or the source explicitly says UK-wide/remote within
  the UK.
- **Non-UK:** structured locations exist and none is in the UK. The job is not
  published or indexed.
- **Ambiguous:** location is absent, countryless remote, or cannot be resolved
  confidently. The job is held unpublished in the administrator review queue.

Multi-location jobs qualify when at least one location is in the UK. Public
structured locations focus on the UK locations. No visa or relocation assumption
is made from employer identity. Tests cover UK countries, Crown Dependencies,
Ireland versus Northern Ireland, abbreviations, remote wording, and multi-country
roles.

The catalogue accepts all experience levels. Graduate wording is not required for
eligibility. Opportunity type and seniority remain classification dimensions, not
catalogue admission gates.

## Ingestion and publication

Connectors normalize official source data into source-owned candidates. Stable
external identifiers and canonical content hashes drive insert/update/touch
decisions. Only new or materially changed content becomes pending for optional AI
review. Unchanged jobs update freshness without consuming model tokens.

Every accepted record keeps source/employer identity, official source and
application URLs, factual title, plain-text description, normalized UK locations,
known employment/workplace types, known dates, source payload, content hash, and
first/last-seen timestamps.

The deterministic publication predicate requires a current active source-owned
job, UK-confirmed location, sufficient factual content, and published status.
Ambiguous, invalid, expired, or suppressed jobs remain outside public results and
the sitemap.

## OpenCode Go / DeepSeek review stage

The existing enrichment boundary becomes provider-neutral. Supported
configuration includes direct DeepSeek and OpenCode Go's OpenAI-compatible API.
The preferred production model is `deepseek-v4-flash` through OpenCode Go.
Credentials remain server-only in local/provider secret stores.

The model receives only bounded job posting fields and returns strict JSON for:

- normalized title;
- seniority and opportunity type suggestion;
- sector/subsector suggestion;
- responsibilities, essential/preferred requirements, and skills;
- degree/experience requirements;
- workplace/employment type suggestions;
- grounded sponsorship status/evidence;
- concise factual summary.

Source text is untrusted prompt data. Zod validation, enumerated values, maximum
lengths, exact evidence checks, bounded retry, timeout, token accounting, prompt
version, provider/model metadata, and kill switches remain mandatory. Model output
cannot establish UK admission, invent facts, overwrite administrator decisions, or
directly publish a low-confidence record. Provider failure leaves deterministic
job data intact and retryable.

## CMS experience

The administrator job-source workspace provides:

- searchable/filterable employer and source registry;
- employer create/edit operations;
- multiple source create/edit operations with channel, URLs, connector, schedule,
  status, and validated configuration;
- run-now, pause, resume, and archive actions;
- source health, overdue state, detected redirects, recent runs, and events;
- invalid-URL and ambiguous-UK-location queues;
- manual URL correction and redirect acceptance;
- existing eligibility, classification, and publication review controls;
- visible audit attribution for administrator actions.

Forms use server actions as adapters into application use cases. Components and
actions do not issue ad hoc SQL or contain crawler rules.

## Priority employer cohort

The first manifest contains approximately 100 employers with material UK presence
and broad sector coverage. It explicitly covers the Big Four, MBB and other major
consultancies; retail, investment, and buy-side finance; technology and telecoms;
engineering, energy, transport, aerospace and defence; consumer, retail and life
sciences; law; and major public employers.

The manifest stores stable identity, priority band, UK-relevance evidence and
date, sector, official website, and proposed official source records. It is an
internal onboarding order, never a public ranking. Source URLs and connector
identifiers are independently verified with bounded official requests. Incomplete
sources may exist in CMS as inactive records but cannot be scheduled until they
have the minimum connector configuration.

Imports are idempotent and update only manifest-managed fields whose row has not
been manually overridden. Expansion from 100 to 500 uses the same format and
command. No aggregator descriptions, jobs, logos, rankings, or private identifiers
are copied.

## SEO contract

- Stable server-rendered canonical job URL and slug.
- Index only active, published, UK-confirmed jobs with adequate factual content.
- Emit `JobPosting` JSON-LD only from known source facts.
- Remove expired/inactive jobs from the sitemap and render an honest expired state.
- Link employer pages to current roles across all their sources.
- Maintain sector/employer/job pages as the public internal-linking backbone.
- Display official source attribution, last-verified freshness, and the official
  application link.
- Never require AI output for indexability or core navigation.

## Security, privacy, and resilience

- The web runtime cannot assume `offerlab_crawler`.
- The crawler cannot access member-owned saves or private application data.
- Only public, unauthenticated official employer sources are supported.
- No CAPTCHA solving, stealth, proxy rotation, authenticated scraping, or
  bot-protection bypass.
- SSRF protection, redirect validation, DNS/IP checks, response caps, timeouts,
  concurrency limits, and sanitized logs remain.
- Raw model prompts/outputs and source descriptions are not logged.
- URL/config changes, run requests, pause/resume, and review overrides are audited.
- A master catalogue gate, LLM gate, provider failure fallback, and global crawler
  kill switch remain.

## Observability

Each run reports source, trigger (`scheduled` or `manual`), duration, discovered,
new, updated, unchanged, rejected-non-UK, held-ambiguous, and deactivated counts,
plus bounded error summary. Source events cover health transitions, URL changes,
automatic pauses, manual requests, and job lifecycle changes.

Operational status reports overdue sources, stalled workers, active manual
requests, invalid URLs, repeated failures, and recent runs. Logs use stable event
names and do not expose descriptions, credentials, or private data.

## Verification

Unit tests cover source eligibility, scheduling/jitter, UK location admission,
connector normalization, content hashing, AI schema/evidence validation, URL
health transitions, and manifest override rules.

PostgreSQL integration tests cover migration/backfill, source-scoped uniqueness,
cross-source deactivation isolation, manual-run atomicity, advisory locks,
role grants, RLS, administrator audit, source CRUD, and public visibility.

Browser tests cover source creation/editing, run-now state, pause/resume, URL
correction, health display, ambiguous-job review, and public SEO/indexability.

The final branch must pass formatting, lint, strict type checking, unit tests,
integration tests, migration replay, browser tests, production build, and security
audit. A bounded live OpenCode Go smoke test uses a synthetic job and runs only
when explicitly requested; it is not part of deterministic CI.

## Rollout

1. Deploy the expand migration and source-aware code with the catalogue gate off.
2. Backfill existing records and verify source isolation in staging.
3. Import and verify the first-100 manifest without overwriting CMS corrections.
4. Install/enable the committed worker timer and confirm heartbeat/status.
5. Run selected sources in dry-run, then persist while public publication remains
   disabled.
6. Review UK filtering, source health, and job structuring samples.
7. Enable public catalogue publication deliberately.
8. Enable OpenCode Go enrichment separately after its synthetic smoke test.
9. Monitor failures, overdue sources, token use, and indexability before expanding
   toward 500 employers.
