# OfferLab crawler — operator's guide

Everything needed to take the ChatGPT-validated employer URLs from spreadsheet
to live crawled jobs. Run commands from the repo root
(`/Users/teaching/Desktop/offerlab-worktrees/web-performance`).

---

## Stage 0 — Prerequisites

```bash
pnpm db:start          # local Supabase (if not already running)
pnpm dev               # web app on http://127.0.0.1:3000
```

Quick state check:

```bash
pnpm jobs:status
```

---

## Stage 1 — ChatGPT URL validation (one-off per dataset)

```bash
# 1. Export the CSV to give ChatGPT (1000 rows, 7 columns, no internal fields)
pnpm jobs:targets:export-validation-csv
# → data/generated/employer-targets/url-validation.csv

# 2. Paste batches (~200-250 rows) into ChatGPT with the validation prompt,
#    asking for JSON-only verdicts:
#    [{"rank":1,"verdict":"ok|suspect|better_url|needs_review",
#      "suggestedUrl":"...","earlyCareerUrls":["..."],"reason":"...","confidence":"high|low"}]
#    Combine all batches into one JSON array and save it, e.g.
#    data/generated/chatgpt-verdicts.json

# 3. Merge the verdicts into a review sheet + import them as unverified candidates
pnpm jobs:targets:merge-validation-reviews --input=data/generated/chatgpt-verdicts.json
pnpm jobs:targets:merge-validation-reviews --input=data/generated/chatgpt-verdicts.json --import-candidates
```

The script unwraps markdown-wrapped URLs (`[https://a](https://a)`) automatically.
Candidates are imported as `candidate_found` — nothing is trusted yet.
Ranks without a researched company are reported and skipped.

### Viewing candidates

- Admin: `/admin/source-discovery` → filter Status = Verified
- Database (DBeaver: host `127.0.0.1`, port `55322`, db/user/password `postgres`):

```sql
select c.name, jc.channel, jc.candidate_url, jc.status, jc.verified_at
from app.job_source_candidate jc
join app.company c on c.id = jc.company_id
where jc.discovery_method = 'external_url_review'
order by c.name;
```

---

## Stage 2 — Verify candidates (real HTTP checks)

Each candidate is fetched with a robots.txt-gated, bounded HTTP request.
2xx → `verified`. 403/404/timeouts stay unverified for manual review.

```bash
# Paged runs (limit caps at 500; verified count is what matters)
pnpm jobs:discover-source --verify --limit=500 --offset=0
pnpm jobs:discover-source --verify --limit=500 --offset=500
pnpm jobs:discover-source --verify --limit=500 --offset=1000
```

`--verify` persists on its own (non-destructive); `--confirm` is NOT needed for
verification. Failures print `[verify failed]` lines with HTTP codes — those
candidates remain `candidate_found` for review.

---

## Stage 3 — Promote verified candidates to paused sources

Creates `app.job_source` rows in **paused** state. Never activates anything;
never overwrites an existing source for the same URL.

```bash
pnpm jobs:discover-source --promote --confirm --limit=500 --offset=0
pnpm jobs:discover-source --promote --confirm --limit=500 --offset=500
pnpm jobs:discover-source --promote --confirm --limit=500 --offset=1000
```

Check how many paused sources were created:

```sql
select status, count(*) from app.job_source group by status;
```

---

## Stage 4 — Review the paused sources (DO NOT SKIP)

"Verified" means the URL returned HTTP 2xx — NOT that it can crawl yet.

### Why review

1. **Connector configuration.** Each ATS needs its own config in the source's
   `configuration` JSONB:
   - **Workday**: needs a `raasEndpoint` (public Recruiting API for Search).
     Without it the crawl fails with `not_configured`. Configure via
     `/admin/job-sources` → "Edit official source URLs" area, or SQL.
   - **Greenhouse / Lever / Ashby / SmartRecruiters**: official public
     job-board APIs; board token/company slug is usually derivable from the
     URL — confirm it.
   - **direct_html / browser**: no token needed, but the page must be a real
     job board, not a marketing landing page.
2. **Channel sanity.** Early-careers URLs can be landing pages with no
   machine-readable board — they would "crawl" but find nothing (zero-result
   or parser failures). A zero-result source is NOT broken, but a landing
   page is the wrong source.
3. **Schedule & mode.** Set `crawl_frequency_minutes` sensibly and tick
   `needs_browser` for JS-heavy pages (browser crawling is approved but
   bounded).

### How to review

Open **/admin/job-sources** — each paused card shows channel, URL, ATS type,
health and config. Check per row:

- [ ] Is `careers_url` / `crawl_endpoint_url` a real job board?
- [ ] Does the connector config exist (Workday `raasEndpoint`, board token)?
- [ ] Is the channel right (`general` vs `early_careers`)?
- [ ] Frequency sensible for this employer?

Fix config problems from the admin page — the "Edit official source URLs"
form now also accepts **Connector configuration (JSON)** — or via SQL:

```bash
# Auto-derive + live-verify Workday CXS endpoints for every unconfigured source
pnpm jobs:workday-endpoints                # dry run report
pnpm jobs:workday-endpoints --confirm      # write the verified endpoints
```

---

## Stage 5 — Activate and crawl

Activation is deliberate: paused/archived sources never crawl.

1. **Activate**: `/admin/job-sources` → "Resume source" on each reviewed
   source (or SQL: `update app.job_source set status='active' where id=...`).
2. **Run the crawler**:

```bash
pnpm dev:jobs                # web app + local poller (picks up runs ~every 5s)
# or worker only:
pnpm jobs:crawl:due --limit=5
```

3. **Watch results**: `/admin/job-sources` → Recent ingestion runs;
   `pnpm jobs:status` for a snapshot.

---

## Stage 6 — Monitor

- **Zero-result anomaly**: a source that had active jobs and suddenly returns
  empty on a successful crawl is recorded as a `partial` run with a
  `listing_empty_anomaly` event — jobs are NEVER closed by failed or
  zero-result crawls. Check `consecutive_zero_results` /
  `last_non_zero_result_at` on `/admin/job-sources`.
- **Job lifecycle events** (`app.job_event`): discovered / updated /
  possibly_closed / closed / reopened — the foundation for "new today",
  "recently updated", "recently closed", alerts.
- **Failures**: repeated failures auto-pause a source after
  `JOB_CRAWLER_FAILURE_PAUSE_THRESHOLD` (default 5); `not_configured`,
  `http_403`, `http_404`, `parser_changed` etc. are recorded per run.

---

## Troubleshooting

| Symptom                        | Cause / fix                                                                                                      |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Crawl fails `not_configured`   | Workday source missing `raasEndpoint` (Stage 4)                                                                  |
| `http_403`                     | Site blocks bots; keep unverified/blocked, don't bypass                                                          |
| Zero jobs after crawl          | Could be a landing page (Stage 4) or legitimately empty board — check the run's `partial`/`listing_empty` events |
| `robots_blocked`               | Site disallows crawling; record as blocked, never evade                                                          |
| Candidates not promoted        | Company has no researched snapshot, or source already exists for the URL (guarded, not duplicated)               |
| Integration tests fail locally | The single-administrator constraint — local DB has a real admin; CI's fresh DB passes                            |

## Reference

- Architecture & data model: `docs/crawler/architecture.md`
- Operations (sources, env vars, scheduling): `docs/operations/job-catalog-operations.md`
- Job/source lifecycle invariants: "never close on failed crawl",
  "two-stage disappearance", "zero results ≠ invalid"
