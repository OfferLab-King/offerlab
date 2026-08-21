# OfferLab Target Employer Research Dataset

**Status:** Active curated research overlay

**Owner:** Founder / Product

**Dataset version:** 2026-08-12 enhanced v2

**Primary workbook:** `offerlab_target_employers_top_1000_enhanced.xlsx`

**Purpose:** Prioritise and enrich employers for OfferLab discovery; this is not the complete sponsor identity universe.

---

## 1. What this dataset is

This workbook is a **curated research and prioritisation overlay** for OfferLab's employer/job-source pipeline. The complete canonical sponsor identity universe comes from each dated Home Office register import; this Top 1,000 does not cap employer search, sponsor coverage or official-site discovery.

It is not the production runtime database, not a live source of job data, and not a substitute for source-specific verification.

The workbook was created from the UK Home Office register of licensed sponsors dated 12 August 2026 and enriched with external research signals including:

- sponsorship routes and sponsor identity;
- employer/group identity;
- early-career and graduate-employer signals;
- employee scale where credible evidence was available;
- public/listed/private ownership evidence;
- sector and subsector;
- finance asset class where relevant;
- UK relevance;
- brand/market prominence;
- careers/ATS research for selected priority employers;
- crawler readiness and crawler priority;
- research gaps and evidence URLs.

The main purpose is to answer:

> Which employers should OfferLab onboard first, and in what order should crawler/source discovery work be performed?

---

## 2. Important architectural rule

**Do not make the application or production crawler read this Excel workbook directly at runtime.**

Use the workbook as a versioned research input.

The intended architecture is:

```text
Home Office sponsor register + external research
                    ↓
      versioned research workbook in repo
                    ↓
       deterministic import/validation script
                    ↓
        OfferLab employer/source database
                    ↓
     source verification / ATS discovery
                    ↓
      typed API verification or exception review
                    ↓
      verified active source and queued first crawl
                    ↓
      scheduled job collection / ingestion
                    ↓
             normalized job records
                    ↓
              OfferLab catalogue
```

The database is the runtime source of truth.

The workbook is the provenance-rich research source from which candidate employer/source records can be created or updated.

---

## 3. Recommended repository location

Store the workbook and this file together:

```text
data/
  research/
    employer-targets/
      README.md
      offerlab_target_employers_top_1000_enhanced.xlsx
```

If the repository later contains multiple revisions, retain them as immutable dated snapshots:

```text
data/
  research/
    employer-targets/
      README.md
      archive/
        2026-08-12/
          offerlab_target_employers_top_1000_enhanced.xlsx
      current/
        offerlab_target_employers_top_1000_enhanced.xlsx
```

Do not silently overwrite historical research snapshots.

---

## 4. Workbook sheets

### `Top 1000 v2`

This is the main ranked employer universe.

Important fields include:

- `Rank`
- `Priority Tier`
- `Crawler Wave`
- `Canonical Employer`
- `Primary Sponsor Legal Entity`
- `Identity Confidence`
- `Employer Value Score`
- `Crawler Readiness Score`
- `Crawler Priority Score`
- `Sponsorship Score`
- `Early-Career Score`
- `Scale Score`
- `Brand/Market Score`
- `Sector`
- `Subsector`
- `Finance Asset Class`
- `Employee Count`
- `Employee Band`
- `Employee Scope`
- `Employee Source`
- `Employee Confidence`
- `Ownership / Listing`
- `Ticker`
- `Exchange`
- `Career Search URL`
- `ATS / Platform`
- `ATS Verification Status`
- `Current Jobs Observed`
- `Recommended Discovery Strategy`
- `Research Status`
- `Evidence URLs`

### `Crawler Queue v2`

This is the operational source-discovery queue.

Use it to sequence crawler/ATS research.

It deliberately separates:

- employer strategic value;
- crawler readiness;
- crawler execution priority.

A difficult-to-crawl company can remain strategically important.

### `Verified Research`

Contains employers for which more direct evidence has already been gathered, including employee-scale evidence and/or careers/ATS verification.

Prefer this evidence over assumptions.

### `Research Gaps`

Lists missing or weak evidence.

This sheet should be used to plan subsequent research rather than treating blanks as facts.

### `Methodology v2`

Explains the ranking model and confidence policy.

Future agents must read this before changing scores or interpreting the dataset.

### `Changes v2`

Documents material corrections from the first research pass, including employer/legal-entity mapping corrections.

### `Sources v2`

Documents major source families used during enrichment.

Row-level evidence URLs remain important and should be preserved during import.

---

## 5. Interpretation rules

### Employer value is not crawler readiness

Do not collapse these concepts.

Examples:

- a globally important employer may have a difficult careers site;
- a smaller employer may expose a clean public ATS endpoint;
- the first can remain a P0 employer while the second may be crawled earlier.

Use:

- `Employer Value Score` for strategic importance;
- `Crawler Readiness Score` for current technical/source readiness;
- `Crawler Priority Score` for execution sequencing.

### Sponsor legal entity is not necessarily the employer brand

Preserve both:

```text
canonical_employer
sponsor_legal_entity
```

Do not overwrite a recognised employer/group identity with an arbitrary licensed subsidiary.

One canonical employer may map to multiple sponsor legal entities.

### Graduate Trainee sponsorship is not proof of graduate recruitment

The Home Office `Graduate Trainee` route is a Global Business Mobility route.

Treat it as evidence of multinational mobility only.

Do not infer:

- graduate programme size;
- graduate vacancy volume;
- willingness to sponsor external graduates.

Use independent early-career evidence for those questions.

### Employee counts require scope

Employee counts may represent:

- UK employees;
- global/group employees;
- a legal subsidiary;
- an externally reported band.

Always retain:

```text
employee_count
employee_band
employee_scope
employee_source
employee_confidence
```

Never present a global employee count as a UK employee count.

### Rankings are prioritisation signals, not factual guarantees

A high rank does not guarantee:

- current vacancies;
- sponsorship for a particular role;
- permission to crawl a site;
- a stable API;
- a particular ATS;
- a graduate programme.

Every source still requires verification.

---

## 6. Recommended database model

Do not import every spreadsheet column into a single production table.

Separate stable employer identity, research signals and crawler source configuration.

A sensible conceptual model is:

```text
employers
employer_sponsor_entities
employer_research_snapshots
employer_source_candidates
job_sources
job_source_verifications
```

### `employers`

Stable canonical employer identity.

Suggested fields:

```text
id
slug
canonical_name
display_name
sector
subsector
finance_asset_class
ownership_type
parent_company
ticker
exchange
created_at
updated_at
```

### `employer_sponsor_entities`

Maps Home Office sponsor records to the canonical employer.

Suggested fields:

```text
id
employer_id
legal_name
town_city
sponsor_rating
routes
source_snapshot_date
source_name
identity_confidence
identity_notes
```

Do not assume a one-to-one relationship between employer and sponsor entity.

### `employer_research_snapshots`

Stores dated research evidence used for prioritisation.

Suggested fields:

```text
id
employer_id
research_date
employer_value_score
crawler_readiness_score
crawler_priority_score
early_career_score
scale_score
brand_market_score
uk_relevance_score
employee_count
employee_band
employee_scope
employee_source
employee_confidence
evidence_urls
methodology_version
```

Research scores are snapshots and may change over time.

### `employer_source_candidates`

Stores proposed career/source endpoints before approval.

Suggested fields:

```text
id
employer_id
career_search_url
platform_hint
discovery_strategy
research_status
evidence
first_observed_at
last_verified_at
```

A source candidate must not automatically become a production crawler source.

### `job_sources`

Use the existing OfferLab job-source model where possible rather than creating a parallel crawler system.

Only verified/approved candidates should become active job sources.

Preserve fields for:

- source type;
- ATS/platform;
- endpoint/configuration;
- permission/compliance state;
- health state;
- crawl schedule;
- last successful run;
- verification timestamp.

---

## 7. Import strategy

Create a deterministic importer, for example:

```bash
pnpm jobs:import-target-employers \
  --file=data/research/employer-targets/offerlab_target_employers_top_1000_enhanced.xlsx \
  --dry-run
```

After reviewing the dry-run:

```bash
pnpm jobs:import-target-employers \
  --file=data/research/employer-targets/offerlab_target_employers_top_1000_enhanced.xlsx \
  --confirm
```

The exact command name may be changed to fit existing repository conventions.

### Importer requirements

The importer should:

1. read only explicitly supported sheets/columns;
2. validate all required fields with a typed schema;
3. normalize whitespace and URLs;
4. reject duplicate canonical employer identities unless explicitly mapped;
5. preserve sponsor legal entities separately;
6. preserve confidence and provenance;
7. use upsert semantics based on stable identifiers;
8. never delete production employers merely because they disappear from a newer workbook;
9. produce a dry-run diff;
10. produce counts for:

- new employers;
- updated employers;
- unchanged employers;
- ambiguous identities;
- rejected rows;
- proposed source candidates;

11. fail safely on malformed data;
12. be idempotent;
13. have unit and integration tests.

Do not manually copy/paste 1,000 rows into migrations.

Do not use the spreadsheet as a database migration.

---

## 8. Source-discovery workflow

Once the employer universe is imported, source onboarding should proceed by crawler priority.

Recommended sequence:

```text
P0 employers
    ↓
ATS/platform fingerprinting
    ↓
public structured endpoint discovery
    ↓
verification
    ↓
adapter reuse analysis
    ↓
activate verified sources
    ↓
P1 employers
    ↓
P2 / P3 expansion
```

Prefer:

1. official public employer/ATS feeds or structured endpoints;
2. public JSON/XHR endpoints used by the career site;
3. server-rendered public HTML;
4. browser-assisted endpoint discovery;
5. manual/unsupported state where access cannot be safely automated.

Do not build a unique crawler for every company if multiple employers share the same ATS.

Optimise for:

> verified employers unlocked per engineering hour

and:

> jobs collected per HTTP/browser/AI cost.

---

## 9. P0 first, not 1,000 at once

Do not tell an agent:

> "Crawl all 1,000 companies."

The first implementation wave should focus on the P0 cohort.

For each P0 employer:

1. verify canonical employer identity;
2. verify relevant sponsor entities;
3. locate official careers/search URL;
4. identify ATS/platform;
5. determine whether a public structured endpoint exists;
6. record source permission/compliance state;
7. perform a dry-run import;
8. validate normalized jobs;
9. record the reusable adapter;
10. activate only after verification.

Then identify how many P1/P2 employers can reuse the same adapters.

---

## 10. ATS/platform evidence

`ATS / Platform` and `Career Search URL` are research fields, not eternal truths.

They must carry:

```text
verification_status
verified_at
evidence
```

Re-verify stale entries before production activation.

Do not assume an employer still uses a previously observed ATS merely because it appeared in an earlier research note.

---

## 11. AI usage

Do not use AI for tasks that deterministic code can perform reliably.

Use deterministic parsing for:

- sponsor names;
- URLs;
- job IDs;
- titles;
- locations;
- dates;
- structured ATS fields;
- workbook import.

AI may help with:

- ambiguous employer identity resolution;
- sector/subsector classification;
- finance asset-class classification;
- semantic job classification;
- research assistance;
- ambiguous source discovery.

AI output must remain reviewable and should not silently overwrite high-confidence structured evidence.

---

## 12. Updating the employer universe

The Home Office register changes regularly.

Do not manually rebuild the entire employer universe every time a new sponsor register appears.

Future workflow should become:

```text
new Home Office register
        ↓
diff against previous snapshot
        ↓
new / removed / changed sponsors
        ↓
identity resolution
        ↓
update research records
        ↓
re-score affected employers
        ↓
review ranking changes
```

Recommended future command:

```bash
pnpm jobs:refresh-sponsor-universe --file=<new-register.csv> --dry-run
```

The importer should preserve historical sponsor snapshots so OfferLab can distinguish:

- newly licensed;
- still licensed;
- changed routes/rating;
- no longer present in the latest snapshot.

Absence from a later spreadsheet must not cause destructive deletion without review.

---

## 13. Repository/source-control policy

The workbook contains public-source research, not secrets.

Nevertheless:

- never place API keys, cookies, tokens or credentials in the workbook;
- never store authenticated browser session data in the repo;
- never store private member information in this dataset;
- preserve evidence URLs and dates;
- avoid editing the binary workbook casually in multiple branches because XLSX merges poorly.

Prefer controlled refreshes with a generated change report.

When replacing the current workbook, record:

```text
dataset_version
source_snapshot_date
methodology_version
generated_at
change_summary
```

Consider storing a SHA-256 checksum in this README or an adjacent manifest.

---

## 14. Machine-readable derivative

The XLSX workbook is good for founder review and manual research.

For automated ingestion, generate a deterministic machine-readable derivative from the workbook, preferably:

```text
data/generated/employer-targets/top-1000.json
```

or:

```text
data/generated/employer-targets/top-1000.csv
```

Recommended approach:

```text
XLSX research artifact
        ↓
validation/export script
        ↓
canonical generated JSON/CSV
        ↓
database importer
```

Do not hand-maintain both XLSX and JSON separately.

The machine-readable file should be generated from the workbook so they cannot drift.

---

## 15. Definition of done for dataset integration

The workbook is properly integrated into OfferLab when:

- [ ] the workbook is stored as a versioned research artifact;
- [ ] this README sits beside it;
- [ ] a typed deterministic importer exists;
- [ ] importer supports `--dry-run`;
- [ ] employer and sponsor-entity identities are separated;
- [ ] provenance/confidence survives import;
- [ ] research snapshots are dated/versioned;
- [ ] source candidates do not automatically become active production sources;
- [ ] P0 employers can be queried from the database;
- [ ] crawler queue can be generated from database state;
- [ ] ATS/source verification has explicit status and timestamps;
- [ ] import is idempotent and tested;
- [ ] existing OfferLab job-catalogue tests still pass;
- [ ] no production runtime dependency on the XLSX file exists.

---

## 16. Instructions for Codex / OpenCode

When using this dataset:

1. Read this file first.
2. Read OfferLab's current product/architecture contracts and job-catalogue operational documentation.
3. Inspect the existing `src/modules/job-catalog`, database schema, migrations and job scripts before creating new structures.
4. Reuse existing employer/source/job-domain models where they already cover the requirement.
5. Do not create a second parallel job-catalogue architecture.
6. Do not treat spreadsheet scores as immutable product truth.
7. Do not infer facts from blank cells.
8. Preserve source provenance and confidence.
9. Do not activate crawling solely because a company appears in the top 1,000.
10. Perform source-specific verification before production activation.
11. Prefer reusable ATS/platform adapters over employer-specific crawler code.
12. Treat P0/P1/P2/P3 as prioritisation, not access permission.
13. Never bypass authentication, CAPTCHA, paywalls, bot protection or other technical access controls.
14. Run the repository's normal validation/test suite after integration.

---

## 17. Recommended next engineering task

The next task should **not** be crawling all 1,000 employers.

Implement the dataset ingestion layer first.

Suggested task:

> Build a typed, idempotent `jobs:import-target-employers` pipeline that imports the enhanced workbook (or its generated JSON derivative) into OfferLab's existing employer/source model, preserves sponsor/legal-entity and provenance data, supports dry-run diffs, and creates inactive source-discovery candidates without activating crawlers.

After that:

> Run structured source discovery for the P0 employer cohort and maximise reusable ATS adapter coverage before expanding to P1.

---

## 18. Founder intent

This dataset exists to give OfferLab a high-quality, sponsor-aware UK employer universe and to prevent crawler engineering from becoming an unprioritised collection of one-off company integrations.

The desired long-term state is:

```text
large researched employer universe
        +
structured sponsor provenance
        +
reusable ATS/source adapters
        +
cheap deterministic scheduled ingestion
        +
high-quality normalized jobs
        +
strong public employer/job/sector discovery
```

The spreadsheet is the starting research asset.

The database and verified source configuration are the operational system.
