# ADR 0022: Job Catalog with deterministic employer-source ingestion

- Status: Accepted (ingestion mechanics; information architecture and
  eligibility pipeline extended by ADR 0023)
- Date: 2026-08-10

## Context

OfferLab needs a UK graduate job catalogue sourced directly from employer career
sites and supported ATS job-board APIs, with structured enrichment, deduplicated
storage in Supabase, honest freshness metadata, and a public, SEO-friendly
discovery experience. Aggregator scraping (LinkedIn, Indeed, Glassdoor, Reed) is
explicitly out of scope. Sources must record their own crawl permission, and the
crawler must never process sources that are not explicitly marked as allowed.

> Historical note: between 2026-08-10 and the founder decision of 10 August 2026
> this ADR was marked "Proposed (implementation is dormant pending founder
> approval)". The founder decision records that approval together with the
> catalogue information architecture, eligibility pipeline and JSearch
> temporary disablement; ADR 0023 implements those product requirements.

## Decision

Build a `job-catalog` module inside the modular monolith with these properties:

1. **Database-backed source registry** (`app.company`). Every source records
   `crawl_allowed` (`allowed | unknown | blocked`), `crawl_status`
   (`healthy | warning | failing | paused`), crawl frequency, connector-specific
   configuration, and failure counters. The crawler only processes sources with
   `crawl_allowed = 'allowed'`; `unknown` and `blocked` sources are never crawled
   automatically.
2. **Reusable ATS connectors before bespoke scrapers.** Greenhouse, Lever, Ashby
   and SmartRecruiters connectors use the official public job-board APIs over
   plain HTTP. Workday is a documented scaffold (per-tenant RaaS endpoint). A
   generic HTML connector exists for `direct_html`/`custom` sources and checks
   robots.txt first. No browser automation by default; no stealth scraping,
   CAPTCHA solving or proxy rotation.
3. **Change detection before LLM.** A canonical content hash (sha256 over
   meaningful fields) decides insert/update/touch per crawl. Unchanged jobs are
   only touched (`last_seen_at`) and never resubmitted to the LLM. Jobs missing
   from a successful, non-empty listing are deactivated only after a configurable
   consecutive-miss threshold (default 2); failed or empty crawls never
   deactivate anything.
4. **Strict LLM enrichment.** DeepSeek receives only job data (never member
   content), with a versioned prompt (`JOB_ENRICHMENT_PROMPT_VERSION`), a strict
   zod output schema, honesty rules (visa sponsorship defaults to `unknown`
   without explicit posting evidence), bounded retry, and per-job enrichment
   telemetry (`enrichment_status`, `enrichment_model`, `enrichment_version`).
5. **Crawler runs as a CLI worker, not inside the web process.** `tsx` scripts
   under `scripts/jobs/` run due sources with concurrency limits and jittered
   schedules, writing through a least-privilege `offerlab_crawler` role. Web
   reads go through `offerlab_app` and RLS. Scheduling is a systemd timer on the
   deployment host, so Lightsail remains replaceable.
6. **Public UX with provenance.** `/jobs` and `/jobs/[slug]` expose source facts
   and clearly labelled AI interpretation, official application links only,
   freshness ("Verified from employer careers site today" only after a
   successful crawl), JobPosting JSON-LD with only known fields, and a sitemap
   of active roles. Inactive roles are removed from the sitemap and flagged on
   their detail page.

## Consequences

- `JOB_CATALOG_ENABLED` defaults to false. Public routes, sitemap publication,
  crawling and enrichment remain unavailable unless explicitly enabled after the
  founder decision below. This gate makes the branch safe to deploy dormant; it
  does not itself approve the capability.

- Ingestion cost scales with actual job churn, not catalogue size.
- A broken source degrades into a recorded failed run and automatic pause after
  repeated failures; it cannot crash the scheduler or deactivate healthy jobs.
- No source is crawled until a human records permission, which keeps the system
  honest while the initial cohort is verified.
- Member saves (`app.user_saved_job`) are owner-scoped with forced RLS; the
  crawler role cannot touch them.
- This capability extends the current product contract's job-discovery boundary
  (which currently gates provider search behind JSearch). A founder decision
  entry recording this extension and the responsible-use rules is required
  before production crawling starts.
- The current ingestion path does not yet define an approved deterministic rule
  for limiting a whole-company ATS feed to UK graduate-relevant roles. That
  inclusion decision is also required before public launch.

## Notes for operators

See `docs/operations/job-catalog-operations.md` for seeding, verification,
scheduling and Lightsail deployment. Production role provisioning must grant
`offerlab_crawler` to the runtime login
(`supabase/snippets/provision-runtime-roles.sql`).
