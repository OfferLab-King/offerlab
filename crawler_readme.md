# OfferLab crawler operator guide

**Status:** Active operational guide

**Last reviewed:** 2026-08-21

This is the shortest supported path from employer identities to live official-source jobs. The crawler is designed for exception-first operation: supported ATS sources can be verified, configured, activated and queued automatically; administrators review only ambiguous, unsupported, blocked or unhealthy cases.

The complete operational contract is in `docs/operations/job-catalog-operations.md`. Architecture and lifecycle invariants are in `docs/crawler/architecture.md`.

## Safety boundary

- Run import and discovery commands only against the intended local database unless a production run has been explicitly authorised and configured with the restricted crawler login.
- Do not reset a local database that contains persistent accounts, sources or crawl history.
- Crawl official, public, unauthenticated employer or ATS sources only. Commercial aggregators remain out of scope.
- Respect robots decisions, rate limits, timeouts and source pause/archive controls. Never evade access controls.
- `JOB_CATALOG_ENABLED` is a release and emergency kill switch, not a missing product decision.

## 1. Check the environment

```bash
pnpm db:start
pnpm jobs:status
```

For the local web app and queue poller together:

```bash
pnpm dev:jobs
```

`pnpm dev` serves the UI but does not process queued crawler work.

## 2. Import employer identities

The dated Home Office licensed-sponsor register is the canonical sponsor identity universe. Import the whole snapshot with exact case-insensitive legal-name identity; do not fuzzy-collapse distinct legal organisations.

```bash
pnpm jobs:sponsors:import --file=/absolute/register.csv --snapshot=YYYY-MM-DD
pnpm jobs:sponsors:import --file=/absolute/register.csv --snapshot=YYYY-MM-DD --confirm-local
```

The first command is a dry run. The confirmed local import is idempotent and preserves dated sponsor history. Internal placeholder domains may exist until an official site is found, but they are never exposed as public links.

The researched Top 1,000 is a curated evidence and crawler-priority overlay, not the complete employer universe:

```bash
pnpm jobs:targets:validate
pnpm jobs:targets:export
pnpm jobs:targets:import --dry-run
pnpm jobs:targets:import --confirm
```

Its import creates research records and inactive candidates only. It never activates a source.

## 3. Discover official career surfaces

Start with the free, deterministic pass. It uses generated domain candidates, DNS, bounded HTTPS, employer-identity checks and official homepage links.

```bash
pnpm jobs:careers:discover-free --dns-prefilter --concurrency=500
pnpm jobs:careers:discover-free
```

The DNS prefilter cheaply removes nonexistent domains. The full free pass records resumable discovery attempts and inserts only identity-supported candidates. It may discover general, early-career, professional and apprenticeship channels independently.

For employers still unresolved, the Brave-backed pass is optional. Planning is free; execution requires an API key and explicit authorisation. Every batch is capped and prints its maximum provider cost before the first query.

```bash
pnpm jobs:careers:discover --max-queries=1000
pnpm jobs:careers:discover --max-queries=1000 --execute
```

Discovery rejects aggregators and social profiles, retains multiple official career channels, and resumes from its attempt ledger. A discovered page remains an inactive candidate until the typed verification gate succeeds.

## 4. Verify and automate supported sources

Run the automation pass in pages when the candidate set is large:

```bash
pnpm jobs:sources:automate --limit=500 --offset=0
pnpm jobs:sources:automate --limit=500 --offset=500
```

Automation activates a candidate only when all of these are true:

1. the official host has a high-confidence ATS fingerprint;
2. the ATS has a registered typed connector;
3. a bounded live probe reaches the derived public machine endpoint; and
4. the response matches the connector's expected shape and employer identity.

On success, OfferLab writes a complete `app.job_source`, including its machine endpoint and connector configuration, activates it and queues its first crawl. Re-running is idempotent and can repair incomplete, non-manually-overridden sources. It never replaces archived or manually overridden sources.

A spreadsheet value, AI verdict, hostname guess or generic HTTP 200 is not verification and cannot activate a source.

Useful focused commands:

```bash
pnpm jobs:discover-source --company=<slug>
pnpm jobs:discover-source --tier=P0 --limit=50
pnpm jobs:discover-source --verify --limit=500 --offset=0
pnpm jobs:discover-source --promote --confirm --limit=500
pnpm jobs:discover-source --homepage --tier=P0 --limit=50
```

`--verify` persists typed verification evidence without `--confirm`. Standalone fingerprint changes, homepage discovery and promotion require `--confirm`. Prefer `jobs:sources:automate` for normal operation.

## 5. Review exceptions

Use `/admin/source-discovery` for candidates that automation did not activate. Typical reasons are:

- unsupported or ambiguous ATS platform;
- weak employer identity evidence;
- robots denial, timeout or access failure;
- derived API response does not match the typed connector;
- distinct career channels need clarification.

Use `/admin/job-sources` for live-source operations: health, schedules, run requests, corrections, pause/resume and archive. Manual connector JSON is an exception path; never guess a board token or endpoint. Add a reusable connector only after repeated measured platform demand justifies it.

## 6. Crawl and monitor

```bash
pnpm jobs:crawl --company=<slug> --source=<source-slug> --dry-run
pnpm jobs:crawl:due --limit=25 --dry-run
pnpm jobs:crawl:due --limit=25
pnpm jobs:status
```

The production timer polls for due or manually requested sources; crawling never runs inside a web request.

Lifecycle invariants:

- failed crawls never close jobs;
- successful zero-result crawls never close jobs and can become admin anomalies;
- disappearance requires repeated successful, non-empty listings;
- malformed individual vacancies are quarantined without discarding valid vacancies;
- Workday aggregate locations use bounded detail-page JSON-LD resolution before publication;
- repeated source failures automatically pause that source without affecting others.

After a large Workday import, resolve remaining location exceptions with:

```bash
pnpm jobs:resolve-locations --confirm --limit=500
```

## Troubleshooting

| Symptom                      | Action                                                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Candidate remains inactive   | Read its evidence in `/admin/source-discovery`; unsupported, ambiguous and shape-mismatched candidates require an exception decision.       |
| `not_configured`             | Re-run `jobs:sources:automate`; if the platform is supported, inspect the fingerprint and typed probe evidence before manual configuration. |
| `http_403` or challenge page | Use the approved bounded browser path only for an official public source; do not evade authentication, robots or access controls.           |
| `robots_blocked`             | Leave blocked and record the exception; never bypass it.                                                                                    |
| Zero jobs                    | Check whether the source is a landing page or legitimately empty. Existing jobs are preserved on zero-result runs.                          |
| Repeated failures            | Inspect recent ingestion runs, correct or pause the source; automatic pause prevents repeated damage.                                       |
| Duplicate employer identity  | Resolve through aliases and exact sponsor legal entities; do not fuzzy-merge distinct register organisations.                               |

## Reference

- `docs/crawler/architecture.md` — data flow and lifecycle invariants
- `docs/operations/job-catalog-operations.md` — environment, deployment and detailed commands
- `docs/architecture/founder-decisions.md` — approved source automation and sponsor-universe policy
- `data/research/employer-targets/README.md` — Top 1,000 research overlay
