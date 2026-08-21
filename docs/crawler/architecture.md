# OfferLab crawler architecture

**Status:** Active implementation reference
**Last reviewed:** 2026-08-21

This document records the current crawler, employer-discovery and job-lifecycle
architecture. It complements `docs/operations/job-catalog-operations.md`.

## Entities and relationships

```mermaid
erDiagram
  COMPANY ||--o{ JOB_SOURCE : "has sources"
  COMPANY ||--o{ JOB : "publishes"
  COMPANY ||--o{ JOB_EVENT : "records"
  COMPANY ||--o{ JOB_INGESTION_RUN : "records"
  COMPANY ||--o{ JOB_SOURCE_EVENT : "records"
  COMPANY ||--o{ JOB_SOURCE_CANDIDATE : "research"
  COMPANY ||--o{ EMPLOYER_RESEARCH_SNAPSHOT : "research"
  COMPANY ||--o{ EMPLOYER_SPONSOR_ENTITY : "licensed identities"
  COMPANY ||--o{ EMPLOYER_ALIAS : "known names"
  COMPANY ||--o{ EMPLOYER_WEB_DISCOVERY_ATTEMPT : "discovery ledger"
  JOB_SOURCE ||--o{ JOB : "discovers"
  JOB_SOURCE ||--o{ JOB_INGESTION_RUN : "drives"
  JOB_SOURCE ||--o{ JOB_SOURCE_EVENT : "audits"
  JOB_SOURCE ||--o{ JOB_EVENT : "context"
  JOB ||--o{ JOB_EVENT : "lifecycle"
  JOB_INGESTION_RUN ||--o{ JOB_EVENT : "produced by"
  JOB ||--o{ JOB_LOCATION : "located in"
  EMPLOYER_RESEARCH_SNAPSHOT ||--o| COMPANY : "maps rank"

  COMPANY {
    uuid id PK
    text slug UK
    text name
    text careers_url
    text website_url
    text source_type "legacy company default"
    text crawl_allowed "legacy compatibility; not a manual gate"
    boolean active
  }
  JOB_SOURCE {
    uuid id PK
    uuid company_id FK
    text slug UK
    text name
    text channel "early_careers|professional|apprenticeships|general|other"
    text careers_url
    text crawl_endpoint_url
    text ats_provider
    text source_type "typed connector|direct_html|browser|custom|unknown"
    text status "active|paused|archived"
    int crawl_frequency_minutes
    int consecutive_failures
    int consecutive_zero_results
    timestamptz last_non_zero_result_at
    jsonb configuration
    boolean needs_browser
  }
  JOB {
    uuid id PK
    uuid company_id FK
    uuid source_id FK
    text slug
    text external_job_id
    text source_url
    text application_url
    text title
    text content_hash
    int missed_crawls
    boolean active
    jsonb source_payload
  }
  JOB_EVENT {
    uuid id PK
    uuid job_id FK
    uuid company_id FK
    uuid source_id FK
    uuid crawl_run_id FK
    text event_type "discovered|updated|possibly_closed|closed|reopened"
    jsonb changed_fields
    jsonb previous_values
    jsonb new_values
  }
  JOB_INGESTION_RUN {
    uuid id PK
    uuid company_id FK
    uuid source_id FK
    text status "running|succeeded|partial|failed|skipped"
    int jobs_discovered
    int jobs_new
    int jobs_updated
    int jobs_unchanged
    int jobs_deactivated
    int error_count
    text error_summary
  }
  JOB_SOURCE_EVENT {
    uuid id PK
    uuid company_id FK
    text kind
    text message
  }
  EMPLOYER_RESEARCH_SNAPSHOT {
    uuid company_id FK
    int internal_rank "stable OfferLab rank"
  }
  JOB_SOURCE_CANDIDATE {
    uuid id PK
    uuid company_id FK
    text channel
    text candidate_url
    text status
    text ats_provider
    text ats_verification_status
    text verified_endpoint_url
  }
  EMPLOYER_SPONSOR_ENTITY {
    uuid company_id FK
    text organisation_name
    date snapshot_date
    text routes
  }
  EMPLOYER_ALIAS {
    uuid company_id FK
    text alias
  }
  EMPLOYER_WEB_DISCOVERY_ATTEMPT {
    uuid company_id FK
    text discovery_version
    text outcome
    text query_or_host
  }
```

## Employer discovery and source activation

The full dated Home Office licensed-sponsor register is the canonical sponsor
identity universe. Exact case-insensitive legal identities remain distinct;
aliases connect verified trading or group names without fuzzy-collapsing legal
organisations. The researched Top 1,000 is a curated evidence and priority
overlay, not a catalogue ceiling.

Source onboarding is an exception-first pipeline:

1. Sponsor and research imports create employer identities, evidence and
   inactive source candidates. Imports never activate sources.
2. Free discovery uses DNS, bounded HTTPS, employer-identity checks and official
   homepage links. An optional, explicitly bounded web-search pass handles
   unresolved employers and records resumable attempts.
3. ATS fingerprinting derives a candidate provider and endpoint configuration.
4. Automatic activation requires a high-confidence fingerprint, a registered
   typed connector and a bounded live probe whose response shape and employer
   identity match that connector.
5. Success creates or repairs a complete `app.job_source`, activates it and
   queues the first crawl. Archived and manually overridden sources are never
   replaced.
6. Unsupported, ambiguous, blocked and shape-mismatched candidates remain
   inactive for administrator exception review.

A spreadsheet value, external-review verdict, hostname pattern or generic HTTP
200 is evidence only. None can activate a crawler source by itself.

## How a crawl works

1. `jobs:crawl:due` (systemd timer every 5 min in production, local poller in
   dev) lists sources where `next_check_at <= now` or a run was requested.
2. Per source: advisory lock, robots.txt gate (`RobotsGate`, 6h cache),
   connector dispatch by `source_type` (native adapters: Workday,
   Greenhouse, Lever, Ashby, SmartRecruiters, Workable and Teamtailor;
   `direct_html`; browser variants; `custom`).
3. Discovered jobs are validated and normalised (`validateDiscoveredJob`),
   then matched to existing rows by deterministic identity
   (`resolveJobIdentity`: external ATS id when available, otherwise a
   canonical detail-URL fingerprint — never employer+title+location alone).
4. `planCrawlChanges` compares content hashes: unchanged rows are touched
   (last_seen only), changed rows update, new rows insert, missing rows
   increment `missed_crawls` (and deactivate after the configurable
   threshold), reappearing rows reactivate.
5. `applyCrawlPlan` applies the plan in one crawler-role transaction and now
   records per-job lifecycle events (`app.job_event`).
6. The run writes `app.job_ingestion_run` + source events; source health
   counters update.

## Lifecycle rules (invariants)

- **A failed crawl never closes jobs.** DNS, 5xx, parser, browser, robots or
  timeout failures update failure counters and the next-check schedule only.
- **A zero-result successful crawl never closes jobs.** Disappearance logic
  runs only on successful, non-empty listings. Zero-result crawls increment
  `consecutive_zero_results`; a source that previously had active jobs and
  suddenly returns empty with HTTP 200 is flagged (`listing_empty_anomaly`,
  run status `partial`) for manual review — the jobs are not touched.
- **Two-stage disappearance.** An active job absent from one successful
  listing becomes `possibly_closed` (event; `missed_crawls` 0 → 1). Absent
  from a second (threshold 2) it becomes `closed` (event; `active=false`,
  `publication_status='expired'`). A reappearing job with the same external
  identity becomes `reopened` (event; `active=true`).
- **Change detection.** The deterministic content hash covers the
  user-relevant fields; unchanged rows only update `last_seen_at` (no
  `updated` event). Changed rows set `last_changed_at` and record an
  `updated` event with field-level diff (`changed_fields`,
  `previous_values`, `new_values`).
- **Source health ≠ job availability.** A programme landing page can be a
  perfectly healthy source with zero current jobs.

## Historical refactor review (2026-08-15)

An external review proposed: employer master data with immutable `rank`;
`career_sources` (1:N per employer); canonical ATS enums; programmes and
intake cycles; an extended job model; adapter architecture; crawl-run
history; strict "never close on failed crawl"; staged disappearance; job
event history; change detection; conditional fetching; zero-result anomaly
detection; source re-verification; UK scoping; CSV migration; backward
compatibility; admin observability; testing; and documentation.

**Already implemented (adapted, not duplicated):**

| Proposal                           | Existing implementation                                                                                                                         |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Employer master + immutable `rank` | `app.company` + `app.employer_research_snapshot.internal_rank` (rank is research-scoped, never renumbered)                                      |
| `career_sources` 1:N               | `app.job_source` (channel `early_careers`/`professional`/`apprenticeships`/`general`/`other`, per-source schedule, health, configuration JSONB) |
| Canonical ATS enums                | `ats_provider` + `source_type` + `ats-fingerprint.ts` + connector registry                                                                      |
| Adapter architecture               | `connectors/` (typed adapters + registry + errors + http-client + robots)                                                                       |
| Job model                          | `app.job` (external id, source URL, apply URL, content hash, raw payload, missed-crawls counter, enrichment state)                              |
| Crawl-run history                  | `app.job_ingestion_run`                                                                                                                         |
| Never close on failed crawl        | Enforced (failure paths never touch job activity)                                                                                               |
| Staged disappearance               | `missed_crawls` + configurable threshold (2); formalised with events                                                                            |
| Change detection                   | Content-hash compare (`change-detection.ts`)                                                                                                    |
| UK scope                           | UK publication gate, location handling, non-UK suppression                                                                                      |
| CSV migration                      | `jobs:targets:import` (idempotent, rank-preserving, candidate-based)                                                                            |
| Admin observability                | `/admin/job-sources` + `/admin/source-discovery` + `jobs:status`                                                                                |
| Testing                            | Domain unit tests + integration lifecycle tests + E2E                                                                                           |

**Implemented on 2026-08-15 (the genuine gaps):**

1. **Zero-result anomaly tracking** — `app.job_source.consecutive_zero_results`
   and `last_non_zero_result_at`; `zeroResultTrackingAfterSuccessfulCrawl`
   (domain); a source with active jobs that suddenly returns empty flags
   `listing_empty_anomaly` and records the run as `partial`. Zero results
   never invalidate a source and never deactivate jobs.
2. **Per-job lifecycle events** — `app.job_event`
   (`discovered`/`updated`/`possibly_closed`/`closed`/`reopened`) written in
   the ingestion transaction, with field-level diffs for updates. The
   foundation for "new today", "recently updated", "recently closed", job
   alerts and employer update feeds.
3. **Admin visibility** — job sources show consecutive zero results and the
   last non-zero time.

**Intentionally not built (with reasons):**

- **Programmes / programme cycles.** The existing channel model on
  `app.job_source` already represents "one employer, many sources per
  programme type", and `job_source_candidate` already captures per-programme
  URLs from research. A programmes table without ingestion integration would
  be dead weight; the _intake-window_ dimension (opening/closing months) is
  genuinely new and should be added with a discovery integration that writes
  it, not before.
- **Conditional fetching (ETag/If-None-Match).** The HTTP client does not
  currently send conditional headers. Useful efficiency work; tracked as a
  future improvement, not required for correctness.
- **Periodic re-verification scheduling.** On-demand typed verification and
  automatic activation are implemented. A separate calendar-based
  re-verification cadence remains future efficiency work; source health,
  automatic pausing and explicit re-runs protect current operation.
- **LLM extraction.** Deterministic extraction is used wherever structured
  data exists, per the founder's AI guardrails; LLM remains an optional
  classification/enrichment fallback behind the documented kill switches.
