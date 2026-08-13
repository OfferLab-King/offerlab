# OfferLab Employer Universe + Discovery Platform Directive

## Post-PR #23 revision — crawler-capability-aware implementation plan

**Status:** Founder-directed implementation guidance  
**Repository:** `OfferLab-King/offerlab`  
**Applies after:** PR #23 — `Targeted UK company crawler with CMS operations`  
**Dataset:** `offerlab_target_employers_top_1000_enhanced.xlsx`  
**Companion file:** employer-target dataset `README.md`  
**Purpose:** Use the Top 1,000 sponsor-aware employer dataset to expand OfferLab's public jobs/employers experience, member experience, employer intelligence, crawler coverage and administrator tooling.

---

# 1. Read this first

The current repository has moved materially beyond the crawler architecture assumed by earlier planning.

**Do not rebuild the crawler architecture from scratch.**

PR #23 already introduced:

- `app.job_source` as a first-class source model;
- one canonical employer → multiple independent job sources;
- source channels:
  - `early_careers`
  - `professional`
  - `apprenticeships`
  - `general`
  - `other`;
- source-scoped job ownership and deduplication;
- source-scoped ingestion runs and events;
- active / paused / archived source states;
- independently scheduled sources;
- durable administrator `Run now` requests;
- landing-page and endpoint health tracking;
- automatic failure/backoff behaviour;
- Workday CXS support;
- Workday RaaS support;
- Greenhouse;
- Lever;
- Ashby;
- SmartRecruiters;
- generic HTML extraction;
- Playwright/Chromium browser-rendered crawling;
- SPA JSON/network-response capture;
- browser-backed public career-site crawling;
- UK-only publication admission;
- non-UK suppression;
- ambiguous-location review;
- bounded browser concurrency;
- 429 `Retry-After` handling;
- CMS source pause/resume and URL correction;
- local `pnpm dev:jobs` worker orchestration;
- least-privilege crawler runtime.

These are **existing foundations**.

Build on them.

---

# 2. Founder policy after PR #23

Do not restore crawler rules that the founder has deliberately removed.

For **official, public, unauthenticated employer career sources**:

- a separate manual crawl-permission gate is no longer required;
- a separate terms-review form is no longer required before crawling;
- browser-rendered crawling is approved;
- SPA/network-response capture is approved;
- Playwright/Chromium may be used where public careers sites require browser execution;
- public career sites behind JavaScript challenges or bot walls may use the approved browser path;
- source status, health, verification and emergency pause/archive controls remain important operational controls.

Commercial job aggregators remain a separate category.

Do not silently expand this directive to commercial aggregators such as:

- LinkedIn;
- Indeed;
- Glassdoor;
- Reed;
- Bright Network;

unless a separate founder decision covers that source.

The employer dataset in this initiative should primarily drive **official employer / official ATS source discovery**.

---

# 3. Product intent

The Top 1,000 employer dataset is not simply a crawler manifest.

It should become an OfferLab **employer intelligence and discovery foundation**.

Use it to improve:

- the public employer directory;
- employer profiles;
- public job search;
- filters;
- sponsorship discovery;
- employer metadata;
- taxonomy;
- member onboarding/preferences;
- saved employers;
- applications;
- career-document targeting;
- Recruitment Intelligence linking;
- SEO;
- crawler source discovery;
- ATS adapter prioritisation;
- administrator research;
- source coverage analytics.

The current UI and taxonomy are not ceilings.

Where a cleaner data model creates a substantially better user experience, refactor.

Do not preserve weak legacy abstractions merely because they already exist.

---

# 4. What PR #23 already solved — remove these from future TODO lists

Earlier planning proposed separating employers from crawler sources.

**That work is already implemented.**

Current direction:

```text
app.company
    = canonical employer / directory identity

app.job_source
    = one independently scheduled recruitment source
```

A source already supports:

```text
company_id
slug
name
channel
careers_url
crawl_endpoint_url
ats_provider
source_type
status
crawl_frequency_minutes
health
run requests
configuration
needs_browser
verification
```

Jobs, ingestion runs and source events are now source-scoped.

Therefore:

### Do not create another `job_source` model.

### Do not recreate employer/source separation.

### Do not create a parallel crawler scheduler.

### Do not recreate "Run now".

### Do not recreate browser capture.

### Do not recreate Workday CXS.

Instead, finish the current expand-and-contract migration and scale the existing model.

---

# 5. Finish the source-model contraction

PR #23 intentionally retains some company-as-source fields for compatibility.

Inspect current migrations, schema and repositories.

Identify remaining legacy source-state fields on `app.company`.

Examples may include compatibility remnants such as:

```text
careers_url
ats_provider
source_type
crawl frequency
configuration
legacy crawl state
legacy review fields
```

Where the runtime has fully moved to `app.job_source`:

1. stop new code from reading source state from `app.company`;
2. backfill/migrate any remaining required values;
3. update tests;
4. remove or formally deprecate compatibility fields;
5. keep true employer-profile fields on `app.company`;
6. do not remove employer website/public-profile data that belongs to the employer identity.

Do this only after proving no current runtime relies on those fields.

---

# 6. Do not put the Top 1,000 into the TypeScript manifest

The current `employerManifest` is useful as a small versioned bootstrap/source manifest.

It is not the correct long-term representation for 1,000 researched employers plus multiple possible source candidates.

Do not expand:

```text
src/modules/job-catalog/application/employer-cohort.ts
```

into a manually maintained 20,000-line source file.

The Top 1,000 dataset should move the product toward a **database-driven employer research and source-discovery system**.

Recommended relationship:

```text
Research workbook
        ↓
typed import
        ↓
employer research records
        ↓
canonical employers
        ↓
source candidates
        ↓
verified job_source rows
```

The existing manifest may remain for:

- bootstrap;
- deterministic fixtures;
- a small core cohort;
- emergency recovery;
- examples.

But it should not be the master representation of the 1,000-employer universe.

---

# 7. Dataset ingestion architecture

Keep the XLSX as the human-reviewed research artifact.

Recommended repository structure:

```text
data/
  research/
    employer-targets/
      README.md
      IMPLEMENTATION_DIRECTIVE.md
      offerlab_target_employers_top_1000_enhanced.xlsx

data/
  generated/
    employer-targets/
      top-1000.json
      manifest.json
```

Recommended pipeline:

```text
XLSX
 ↓
typed XLSX parser / validator
 ↓
canonical generated JSON
 ↓
database dry-run diff
 ↓
research import
```

Suggested commands:

```bash
pnpm jobs:targets:validate
pnpm jobs:targets:export
pnpm jobs:targets:import --dry-run
pnpm jobs:targets:import --confirm
```

Use repo naming conventions if preferable.

Requirements:

- typed;
- deterministic;
- idempotent;
- provenance preserving;
- no runtime Excel dependency;
- no destructive deletion from absence;
- no automatic activation of guessed source configurations;
- import report;
- duplicate/identity checks;
- test coverage.

---

# 8. Add employer research structures, not another crawler registry

`app.job_source` is the live source registry.

The dataset needs a separate research layer.

Suggested structures:

## `app.employer_sponsor_entity`

One canonical employer can map to many licensed legal entities.

Suggested fields:

```text
id
company_id
legal_name
town_city
sponsor_rating
routes[]
source_snapshot_date
active_in_snapshot
identity_confidence
identity_notes
source_reference
created_at
updated_at
```

---

## `app.employer_research_snapshot`

Suggested:

```text
id
company_id
dataset_version
research_date

priority_tier
internal_rank

employer_value_score
crawler_readiness_score
crawler_priority_score

sponsorship_score
early_career_score
scale_score
brand_market_score
uk_relevance_score
listing_ownership_score

employee_count
employee_band
employee_scope
employee_source
employee_confidence

ownership_type
ticker
exchange
ownership_confidence

identity_confidence
research_status
evidence_urls[]
notes

created_at
```

Internal scores are operational research data.

Do not expose them publicly as employer rankings.

---

## `app.employer_alias`

Suggested:

```text
id
company_id
alias
alias_type
source
```

Useful for:

- employer search;
- sponsor/legal-name matching;
- career-site normalization;
- user-entered target-company matching;
- application matching.

---

## `app.job_source_candidate`

This is optional but strongly recommended if source discovery will scale.

Use it for unverified possibilities before promotion to `app.job_source`.

Suggested:

```text
id
company_id
channel
candidate_url
candidate_endpoint
platform_hint
discovery_method
status
confidence
evidence
discovered_at
verified_at
notes
```

Suggested status:

```text
not_researched
researching
candidate_found
platform_identified
endpoint_identified
verified
failed
blocked
unsupported
promoted
```

Do not overload `job_source.status` with research workflow state.

`job_source.status` is already an operational state:

```text
active
paused
archived
```

---

# 9. Source discovery should use the new crawler capabilities aggressively

The crawler now supports much more than the earlier simple connector stack.

Use this hierarchy:

```text
1. Known native ATS adapter
2. Direct public structured endpoint
3. Public SPA JSON/network endpoint
4. Server-rendered HTML
5. Browser-rendered HTML
6. Browser-assisted API capture
7. New reusable platform adapter
8. Custom employer adapter only when necessary
```

The objective is not:

> write 1,000 bespoke scrapers.

The objective is:

> discover a reusable extraction family and unlock as many high-value employers as possible.

---

# 10. Extend the ATS/platform adapter layer

Current dedicated platform support includes:

- Workday;
- Greenhouse;
- Lever;
- Ashby;
- SmartRecruiters.

Browser/API capture handles custom SPA systems such as the Deutsche Bank beesite example.

For the Top 1,000 programme, investigate reusable adapters for high-frequency platforms including:

```text
Oracle Recruiting / Candidate Experience
SAP SuccessFactors public career sites
TAL / tal.net
iCIMS
Avature
Taleo
Teamtailor
Personio
Workable
PageUp
Dayforce
Cornerstone
Eightfold career sites
custom enterprise platforms
```

Do not build all of these in advance.

Use the Top 1,000 research queue to determine which platforms have the best payoff.

### Adapter promotion rule

If browser/network discovery identifies the same stable platform pattern across multiple target employers:

> promote that pattern into a typed reusable connector.

Do not leave a widely reused platform indefinitely represented as a collection of fragile `direct_html` configurations.

---

# 11. Source discovery should be partly automated

Build toward:

```bash
pnpm jobs:discover-source --company=<slug>
```

or an admin equivalent.

A discovery run should be able to:

1. open the official careers URL;
2. identify obvious ATS hosts;
3. test known ATS patterns;
4. observe public network responses when useful;
5. identify job-shaped JSON;
6. inspect rendered HTML;
7. propose:
   - source type;
   - ATS/platform;
   - source channel;
   - careers URL;
   - machine endpoint;
   - config values;
   - browser requirement;
8. test a bounded sample;
9. report UK-job yield;
10. create/update a `job_source_candidate`;
11. optionally promote a verified candidate to `app.job_source`.

Do not require an LLM for deterministic ATS fingerprinting.

Use AI only where semantic interpretation materially helps.

---

# 12. Improve browser/API capture

The existing SPA capture is a strong foundation.

Enhance it rather than replacing it.

Potential improvements:

- pagination discovery;
- load-more/infinite-scroll handling;
- request-body capture for POST APIs;
- GraphQL operation identification;
- pagination token/offset inference;
- stable endpoint extraction;
- response schema fingerprinting;
- direct-HTTP replay after browser discovery;
- source-specific headers where genuinely required by the public page;
- caching anonymous session state where useful;
- bounded page interaction for public job filters;
- capture confidence/evidence.

Ideal lifecycle:

```text
Browser discovery once
      ↓
Stable public endpoint identified
      ↓
Store endpoint/config
      ↓
Future scheduled runs use lightweight HTTP
```

Only keep browser execution in scheduled production crawling where it remains necessary.

This lowers CPU cost and improves reliability.

---

# 13. Workday improvements

PR #23 added CXS and RaaS support.

Build on that.

Next useful capabilities:

- tenant/site discovery;
- multiple Workday sites per employer;
- channel-specific sites:
  - graduate;
  - professional;
  - apprenticeships;
- detail retrieval where listing payload is thin;
- location facets;
- original posting date extraction;
- pagination validation;
- reliable job IDs;
- automatic CXS endpoint construction from discovered career URLs;
- Workday host/site fingerprinting.

The Top 1,000 admin tooling should show:

```text
Workday employers
verified CXS
unknown site identifier
rate-limited
browser-only
live
```

This is much more useful than treating Workday as one generic status.

---

# 14. Source sessions / backoff / health

The current code already handles 429 `Retry-After` and source-level backoff.

Do not duplicate the scheduler.

Enhance where evidence shows it is useful.

Potential additions:

- anonymous cookie/session reuse;
- host-level connection pools;
- source-host concurrency budgets;
- host-level cooldown;
- 403/429 trends;
- endpoint-specific latency history;
- successful-job-yield history;
- source health SLOs;
- automatic switch from direct HTTP to configured browser mode if a source has an approved browser strategy;
- direct endpoint replay where browser capture discovered a stable endpoint.

Keep source failures isolated.

One failing employer must not block the crawl batch.

---

# 15. Use source channels properly

`app.job_source.channel` already supports:

```text
early_careers
professional
apprenticeships
general
other
```

The current manifest often seeds one `general` source.

The Top 1,000 programme should exploit multiple channels where employers expose distinct career surfaces.

Example:

```text
JPMorganChase
  ├── early-careers
  ├── professional
  └── apprenticeships
```

or:

```text
KPMG UK
  ├── graduates
  ├── apprenticeships
  └── experienced
```

Do not force multiple distinct official sources into one artificial "all careers" source when they have different endpoints and schedules.

Channel is operational/source metadata.

A user-facing job should still be classified by job/career-level facts rather than merely inheriting the source channel.

---

# 16. Remove the old 500-employer ceiling

Current historical/current docs still reference a cohort of up to 500 employers.

The founder is now supplying a researched **Top 1,000** universe.

Update governing documents.

New rule:

> The employer directory and research universe may exceed 500 employers. Visibility is determined by data quality and product usefulness, not an arbitrary numerical ceiling.

This does **not** mean:

> activate 1,000 crawler sources immediately.

Separate:

```text
researched employers
public employer profiles
source candidates
verified sources
active sources
```

All can have different counts.

---

# 17. Current taxonomy remains the biggest public UX weakness

The current job taxonomy mixes:

- employer industry;
- career sector;
- job function;
- business line.

That limits discovery.

Do not merely append more values to the old structure.

Create distinct dimensions.

---

# 18. Canonical employer industry taxonomy

Recommended top-level employer industries:

```text
financial_services
professional_services_consulting
technology_software
engineering_manufacturing
energy_utilities_infrastructure
consumer_retail_fmcg
healthcare_pharma_life_sciences
media_telecom_entertainment
transport_logistics_travel
real_estate_construction
legal_services
public_sector_government
education_research
charity_nonprofit
hospitality_leisure
other
```

Create useful subindustries.

Example:

```text
financial_services
  banking
  investment_banking
  asset_management
  wealth_management
  insurance
  fintech
  payments
  private_markets
  market_infrastructure
  lending_credit
```

The Top 1,000 workbook should be used to validate coverage.

---

# 19. Canonical job-function taxonomy

Create a separate function/profession dimension.

Recommended:

```text
finance_accounting
investment_banking_corporate_finance
markets_trading_research
asset_wealth_investment_management
consulting_strategy
software_engineering
data_analytics_ai
product_management
cybersecurity_it
engineering
science_research
operations_supply_chain
project_programme_management
sales_business_development
marketing_communications
human_resources_recruitment
legal
risk_compliance_controls
customer_service
design_ux
healthcare_clinical
public_policy_government
administration
other
```

Add a subfunction layer where useful.

A bank's software engineer should be:

```text
employer industry = Financial Services
job function = Software Engineering
```

not "Investment Banking" simply because of the employer.

---

# 20. Career level is another separate dimension

Recommended:

```text
school_leaver
student
intern
graduate
entry_level
junior
experienced
manager
senior_leadership
unknown
```

The catalogue now explicitly supports general and experienced roles.

Do not suppress experienced roles merely because they are not graduate roles.

Use career level as a filter.

OfferLab can still emphasize graduate/early-career roles in its primary audience experience.

---

# 21. Opportunity/programme type

Suggested:

```text
graduate_scheme
graduate_job
summer_internship
off_cycle_internship
internship
industrial_placement
insight_spring_week
work_experience
apprenticeship
degree_apprenticeship
training_contract
vacation_scheme
knowledge_transfer_partnership
experienced_hire
general_job
other
unknown
```

Do not create more precision than source evidence supports.

---

# 22. Sponsorship UX should become a major OfferLab advantage

Separate employer-level and role-level evidence.

## Employer level

From the Home Office dataset:

```text
UK licensed sponsor
```

User explanation:

> This employer appears on the UK Home Office sponsor register. Sponsorship availability varies by role and candidate.

Useful fields:

```text
licensed_sponsor
snapshot_date
sponsor_routes
```

Do not claim a specific vacancy sponsors a visa from employer-level data.

---

## Role level

Keep:

```text
visa_sponsorship_status
visa_sponsorship_evidence
```

Possible labels:

```text
Confirmed for this role
Indicated / likely
Not offered
Not specified
```

Filters should be able to distinguish:

```text
Employer is a licensed sponsor
Role itself mentions sponsorship
```

This is far more useful to international applicants.

---

# 23. Public `/jobs` redesign

Keep the strong existing elements:

- URL-state filters;
- faceted counts;
- keyword search;
- location search;
- job cards;
- saved jobs;
- public/member shared route;
- responsive filter drawer;
- canonical/noindex handling.

Improve the dimensions.

Recommended filter order:

```text
Career level / opportunity type
Job function
Employer industry
Employer
Location
Work arrangement
Visa sponsorship
Salary
Employment type
Posted date
Application deadline
```

Optional "More filters":

```text
Employer size
Company type
Early-career employer
Experience requirement
Qualification requirement
```

---

# 24. Separate location from work arrangement

Current filter data combines:

```text
London
Manchester
Remote
Hybrid
On-site
```

Split user-facing controls:

```text
Location
Work arrangement
```

Backend implementation can migrate incrementally.

---

# 25. Public job cards

Keep cards compact.

Recommended visible data:

```text
Employer
Role title
Location

Career level / programme
Job function
Work arrangement

Salary
Deadline
Posted
Role sponsorship
```

Optional useful employer signal:

```text
UK licensed sponsor
```

Do not clutter cards with:

- employee count;
- ticker;
- crawler source;
- ATS;
- internal priority;
- crawler health.

---

# 26. Job detail pages

Add useful employer context:

```text
Industry
Company size
Ownership
UK licensed sponsor
Current OfferLab roles
Official careers link
```

Job facts should clearly expose:

```text
Job function
Subfunction
Career level
Programme/opportunity type
Employment type
Work arrangement
Role-level sponsorship
```

Keep:

- official apply CTA;
- source freshness;
- related roles;
- same-employer roles;
- valid structured-data policy.

---

# 27. Employer directory redesign

The Top 1,000 makes a sector-grouped small directory insufficient.

Recommended top controls:

```text
Search employers
Industry
Hiring now
UK licensed sponsor
Employer size
Early-career opportunities
```

More filters:

```text
Subindustry
Ownership type
Finance/business focus
```

Sort options:

```text
Hiring now
Most current roles
A–Z
```

Internal employer rank should never be shown as a public league table.

---

# 28. Employer rows/cards

Useful compact presentation:

```text
JPMorganChase
Financial Services · Banking
42 current roles
UK licensed sponsor · 100k+ employees globally · Public
```

For zero roles:

```text
No current OfferLab roles
Official careers page →
```

The dataset should allow good employers to remain discoverable even between hiring cycles.

---

# 29. Employer profile redesign

Recommended structure:

## Header

```text
Employer
Industry / subindustry
Current roles
```

## Quick facts

Only sufficiently confident:

```text
Company size
Employee scope
Ownership
Ticker / exchange
UK sponsor status
Sponsor verification date
```

## Opportunities

Where evidence exists:

```text
Graduate programmes
Internships
Placements
Apprenticeships
Professional roles
```

## Jobs at this employer

Filter/group by:

```text
Job function
Career level
Location
Source channel when useful internally, not necessarily exposed
```

## Recruitment Intelligence

Where available:

```text
Recruitment Intelligence
Current cycle / employer reports
```

## Signed-in actions

```text
Save employer
View saved jobs
Add application
Prepare for this employer
```

---

# 30. Employer SEO

Keep existing employer SEO foundation.

Enhance `employer-indexability` so useful verified structured facts can qualify a page without requiring filler prose.

Potential qualifying evidence:

- official website/careers URL;
- verified industry/subindustry;
- credible size/ownership;
- Home Office sponsor evidence;
- active/historical tracked jobs;
- original OfferLab intelligence;
- useful factual structured profile.

Do not index:

```text
Employer name only
```

Do not generate AI filler solely for SEO.

---

# 31. Member onboarding

Current industry choices are too broad and disconnected from job/employer taxonomy.

Unify them.

Onboarding should ask broad, manageable preferences:

```text
Target industries
Target job functions
Opportunity types
Preferred locations
```

Optional profile fields later:

```text
Work arrangement
Sponsorship need
Target employers
```

Do not make onboarding huge.

---

# 32. Target employers should become canonical IDs

Current target-company entry is free text.

Move toward autocomplete from canonical employers.

Store:

```text
target_company_id
```

or a relation table.

Keep free-text fallback for employers not yet in OfferLab.

Do not lose member input.

Employer aliases should support matching.

---

# 33. Applications integration

Allow employer autocomplete when adding an application.

Store:

```text
company_id nullable
company_name text
```

Benefits:

```text
application
  → employer profile
  → current roles
  → sponsor context
  → recruitment intelligence
  → preparation resources
```

Free-text fallback remains allowed.

---

# 34. Saved employers

Add owner-scoped:

```text
app.user_saved_employer
```

with forced RLS.

Use cases:

- return to employer;
- show current roles;
- prioritise employer filter;
- future opt-in alerts;
- target-company workflow.

Do not automatically create notifications without user preference.

---

# 35. Member job discovery

Keep `/jobs` as the shared discovery route.

When signed in, add lightweight personalization:

```text
Target employers
Saved employers
Your industries
Your job functions
Your locations
```

Use explainable reasons.

Do not create:

```text
87% job match
82% chance of interview
```

---

# 36. Member home

Use employer/job data only where it gives immediate decision value.

Potential compact modules:

```text
New roles at target employers
Saved jobs closing soon
New roles in selected functions
```

Do not convert member home into a job-board dashboard.

Applications and preparation remain core.

---

# 37. Admin architecture after PR #23

The current `/admin/job-sources` source controls are useful.

Preserve:

- source health;
- pause/resume;
- Run now;
- queued/running state;
- latest run;
- URL correction;
- independent source schedule.

Do not rebuild them.

But the page will not be enough for 1,000 researched employers.

Add separate scale-oriented admin surfaces.

Recommended:

```text
/admin/employers
/admin/employers/[id]

/admin/source-discovery

/admin/job-sources
/admin/job-sources/[id]

/admin/job-review
/admin/job-runs
```

Exact routing can follow current patterns.

---

# 38. Admin employer universe

Dense table, server-side filtering.

Columns:

```text
Employer
Tier
Employer value
Industry
Size
Ownership
Sponsor
Early-career evidence
Identity confidence
Source coverage
ATS/platform
Live sources
Current jobs
Last research date
```

Internal-only:

```text
crawler priority
crawler readiness
research gaps
```

Filters:

```text
P0/P1/P2/P3
industry
size
ownership
sponsor
early-career evidence
identity confidence
ATS/platform
has source candidate
has verified source
has live source
has jobs
research gap
```

Search:

- canonical employer;
- alias;
- sponsor legal entity.

---

# 39. Admin source-discovery queue

This should be the operational bridge from Top 1,000 research → live crawler.

Group and sort by:

```text
crawler priority
ATS/platform
source channel
```

High-value view:

```text
Platform                 P0   P1   P2   Verified   Live
Workday                   18   32   45      11       8
Oracle                    12   20   28       2       1
SuccessFactors            10   24   31       4       2
Unknown                   25   60   80       -       -
```

This lets engineering choose the next adapter by coverage payoff.

---

# 40. Admin employer detail

Bring together:

## Identity

```text
canonical employer
aliases
website
industry
subindustry
ownership
employee evidence
```

## Sponsorship

```text
legal sponsor entities
routes
snapshot date
identity confidence
```

## Research

```text
tier
scores
evidence
research notes
gaps
```

## Source discovery

```text
candidate sources
ATS/platform
channels
verification evidence
```

## Live source operation

Use existing `app.job_source` state:

```text
active/paused/archived
health
run now
last run
schedule
URL
browser requirement
```

---

# 41. Add ATS/platform coverage analytics

Admin should answer:

```text
How many target employers use Workday?
How many are verified?
How many are live?
Which unknown employers are P0?
Which adapter unlocks the most P0/P1 employers?
```

Metrics:

```text
Top 1,000 imported
P0 coverage
P1 coverage
employers with official careers URL
employers with platform identified
employers with verified source
employers live

targets by ATS
live sources by ATS
jobs by ATS
browser vs HTTP source count
source success rate
429 rate
403 rate
jobs per crawl
cost per 1,000 jobs
```

---

# 42. Use crawler capability metadata in admin

`needs_browser` is already stored.

Expose useful admin facets:

```text
HTTP source
Browser source
SPA capture
Workday CXS
Workday RaaS
Generic HTML
Native ATS
Custom
```

Do not show these technical details to ordinary users.

---

# 43. Browser-to-HTTP optimization should become an admin workflow

When browser capture reveals a stable endpoint:

```text
Browser discovery
      ↓
API endpoint identified
      ↓
verify direct replay
      ↓
store crawl_endpoint_url
      ↓
switch scheduled crawling to HTTP when possible
```

Admin can display:

```text
Browser required
Browser used for discovery only
Direct API verified
```

This reduces operating cost at scale.

---

# 44. Improve source types

Current `source_type` remains:

```text
direct_html
workday
greenhouse
lever
smartrecruiters
ashby
custom
unknown
```

As the Top 1,000 research discovers repeated platform families, expand the enum deliberately.

Potential future additions:

```text
oracle
successfactors
tal
icims
avature
taleo
teamtailor
personio
workable
```

Do not add a source type until there is an actual typed adapter or stable platform-specific implementation.

---

# 45. Source configuration versioning

A thousand employers means connector configs will evolve.

Add or strengthen:

```text
connector_version
config_version
last_verified_at
verification_method
```

to source metadata if not already adequately represented.

When connector behaviour changes, admin should be able to identify sources requiring re-verification.

---

# 46. Employer/source freshness

Separate:

```text
employer research freshness
source technical freshness
job freshness
```

Examples:

- sponsor register last checked;
- employee size last checked;
- ownership last checked;
- source endpoint last verified;
- last successful crawl;
- job last seen.

Do not let one date stand in for all data freshness.

---

# 47. Public data confidence

The workbook contains varying evidence quality.

Admin should see:

```text
Verified
Medium confidence
Proxy
Needs verification
Conflicting
```

Public pages should display only facts that meet the required confidence threshold.

Examples:

If exact employee count is global:

> 120,000 employees globally

If only a band is reliable:

> Company size: 10,000–49,999

Never fabricate precision.

---

# 48. Employer sponsor data refresh

The Home Office register changes frequently.

Build a diff workflow:

```bash
pnpm jobs:sponsors:refresh --file=<register.csv> --dry-run
```

Output:

```text
new sponsor entities
removed entities
changed routes
changed ratings
identity matches
unresolved legal names
```

Do not delete employer records automatically when a sponsor legal entity disappears.

Preserve historical snapshots.

---

# 49. Taxonomy migration

Do not rewrite taxonomy in a single destructive migration.

Recommended:

1. introduce employer industry keys;
2. introduce job function/subfunction keys;
3. preserve legacy sector/subsector;
4. build deterministic mapping;
5. backfill;
6. dual-read/dual-write temporarily where needed;
7. migrate search/facets;
8. migrate onboarding;
9. migrate SEO;
10. remove legacy taxonomy only after parity tests.

---

# 50. Public filter performance

The richer filter model will add joins.

Ensure:

- indexed employer industry;
- indexed job function;
- indexed career level;
- indexed sponsor status;
- indexed ownership/size fields where used;
- efficient disjunctive facet counts;
- no browser delivery of 1,000 employer records at once;
- server-side employer search;
- measured query performance.

Preserve URL-addressable filters.

---

# 51. Public information hierarchy

OfferLab should feel information-rich but not cluttered.

Principle:

> high information value, low visual noise.

Use:

- compact facts;
- meaningful badges;
- expandable secondary detail;
- contextual filters;
- strong search;
- dense admin tables;
- simple member actions.

Do not turn job cards into company fact sheets.

Do not turn employer profiles into crawler dashboards.

---

# 52. Current safety/operational controls to preserve

Removing old crawler restrictions does **not** mean removing useful engineering protections.

Preserve:

- least-privilege crawler DB role;
- source-level isolation;
- source pause/archive;
- emergency kill switch;
- bounded concurrency;
- timeouts;
- retries;
- backoff;
- `Retry-After`;
- UK publication admission;
- successful-crawl-only deactivation;
- change detection;
- audit events;
- member RLS;
- secrets management;
- log redaction;
- source health;
- feature gate during deployment/migration;
- independent AI kill switch.

These are engineering reliability controls, not product conservatism.

---

# 53. Documentation cleanup required

Update documents that still contain obsolete assumptions.

At minimum inspect:

```text
AGENTS.md
docs/architecture/founder-decisions.md
docs/architecture/decisions/0022-job-catalog.md
docs/architecture/decisions/0023-job-catalog-ia-eligibility.md
docs/product/current-product-contract.md
docs/product/product-strategy-and-roadmap.md
docs/product/experience-principles.md
docs/operations/job-catalog-operations.md
```

Ensure they consistently reflect:

1. official public employer sources no longer require the old manual permission gate;
2. browser-rendered public employer crawling is approved;
3. `app.job_source` is the source-of-truth for crawler sources;
4. one employer may own multiple sources;
5. Top 1,000 employer research supersedes the arbitrary 500-employer ceiling;
6. employer industry and job function are separate product dimensions;
7. source discovery/admin should scale to the Top 1,000 universe.

---

# 54. Revised implementation phases

## Phase A — Top 1,000 research import

Implement:

- XLSX validation;
- generated JSON;
- canonical employer matching;
- aliases;
- sponsor legal entities;
- research snapshots;
- dry-run diff;
- idempotent import;
- admin research list foundation.

Do not modify the crawler core unnecessarily.

---

## Phase B — research → source discovery

Implement:

- source candidate model;
- ATS/platform fingerprinting;
- admin discovery queue;
- grouped ATS coverage;
- automated source discovery command;
- promotion into existing `app.job_source`.

Use current browser/API capture.

---

## Phase C — expand platform adapters

Based on actual Top 1,000 frequency:

- Oracle;
- SuccessFactors;
- TAL;
- other high-payoff platforms.

Do not prebuild low-value adapters.

---

## Phase D — taxonomy redesign

Implement:

- employer industry/subindustry;
- job function/subfunction;
- career level;
- improved programme type;
- migration compatibility.

---

## Phase E — public employer UX

Implement:

- richer `/employers`;
- employer search/filter;
- sponsor context;
- size/ownership;
- early-career evidence;
- richer employer profiles;
- Recruitment Intelligence linking;
- SEO/indexability updates.

---

## Phase F — public jobs UX

Implement:

- separate industry/function;
- career level;
- separate work mode/location;
- employer sponsor filter;
- role sponsorship filter;
- employer size/company type;
- improved cards/detail.

---

## Phase G — member integration

Implement:

- canonical employer autocomplete;
- target employer IDs;
- saved employers;
- richer preferences;
- applications linkage;
- explainable discovery sections.

---

## Phase H — admin scale-up

Implement:

- employer research console;
- source discovery console;
- preserve current live source controls;
- ATS coverage analytics;
- browser/API optimization workflow;
- crawl economics.

---

# 55. New first implementation task

Because PR #23 already completed employer/source separation, the previous "Phase C: create `app.job_source`" task is obsolete.

The next assignment should be:

> Read the enhanced Top 1,000 workbook, its README and this directive. Audit the current post-PR #23 employer/source schema and crawler. Implement the Top 1,000 research-ingestion foundation without rebuilding `app.job_source`: add canonical employer aliases, sponsor legal entities and versioned research snapshots; produce typed XLSX → generated JSON → dry-run database import; map the 1,000 rows to canonical `app.company` identities where confidence is sufficient; preserve ambiguous identities for admin review; do not create guessed active sources. Add an initial `/admin/employers` research-universe view with search, tier, industry, sponsor, identity-confidence and source-coverage filters. Preserve all current crawler, browser-capture, Workday and CMS source operations.

Definition of done:

- workbook validates;
- generated machine-readable derivative exists;
- 1,000 target rows import idempotently;
- sponsor legal entities remain one-to-many;
- canonical aliases supported;
- confidence/provenance retained;
- existing live sources remain unchanged;
- no duplicate crawler registry created;
- no accidental source activation;
- current test baseline remains healthy or test count increases;
- migration replay passes;
- production build passes;
- import report produced.

---

# 56. Second implementation task

> Build source-discovery workflow on top of existing `app.job_source`, browser capture and native adapters. Add `job_source_candidate` (or an equivalent research-stage model), ATS fingerprinting and a source-discovery command/admin queue. Group the Top 1,000 by platform and prioritise P0/P1 coverage. Browser-assisted discovery should attempt to identify stable public JSON endpoints and prefer lightweight HTTP for recurring crawls when a stable replay is verified.

---

# 57. Third implementation task

> Use the research universe to identify the highest-value missing platform adapters. Implement the first reusable adapter that unlocks the largest number of P0/P1 employers—likely Oracle Candidate Experience, SuccessFactors or TAL depending on measured coverage. Prove reuse on multiple employers before moving to the next platform.

---

# 58. Fourth implementation task

> Introduce the new employer-industry and job-function taxonomies with a backward-compatible migration from the current mixed sector/subsector model. Do not break existing job URLs, publication state or saved jobs. Add career level as a first-class dimension and ensure general/experienced roles remain valid catalogue records.

---

# 59. Fifth implementation task

> Redesign `/employers` and employer profiles using the imported data. Add industry, sponsor, size, ownership, hiring-now and early-career discovery while keeping internal research/crawler fields private. Connect employer profiles to current jobs and Recruitment Intelligence. Replace the historical 500-company ceiling with quality-based directory visibility.

---

# 60. Sixth implementation task

> Redesign `/jobs` faceting using separate employer industry, job function, career level, work arrangement, employer sponsor licence and role-level sponsorship. Preserve disjunctive facet semantics, URL serialization, accessibility, mobile filter UX, SEO noindex behaviour and performance.

---

# 61. Seventh implementation task

> Connect canonical employers to member onboarding, target employers, applications and saved employers. Preserve free-text fallback. Add transparent preference-based job/employer discovery without match probabilities or hiring predictions.

---

# 62. Eighth implementation task

> Scale admin beyond the current source-operations page: Employer Research, Source Discovery, Live Sources and Job Review should be distinguishable workflows. Preserve current source Run now, health, pause/resume and URL controls. Add ATS-grouped coverage analytics so engineering can optimise verified P0/P1 employer coverage per adapter.

---

# 63. Success criteria

This programme succeeds when:

## User experience

A user can distinguish:

```text
Employer industry
Job function
Career level
Programme type
Employer sponsor licence
Role sponsorship
```

and use them naturally.

Users can discover employers even when no role is currently open.

Employer pages contain useful verified context.

International applicants gain truthful sponsorship context.

Jobs connect naturally to applications and preparation.

---

## Crawler

The Top 1,000 becomes a measurable source-onboarding universe.

Crawler supports hundreds of official employer sources without one-off architecture.

Repeated ATS platforms use reusable adapters.

Browser capture is used intelligently.

Stable captured endpoints are replayed through HTTP where possible.

Failures remain source-isolated.

---

## Admin

Admin can answer:

```text
Which P0 employers lack a source?
Which platform unlocks the most P0/P1 employers?
Which browser sources could become HTTP sources?
Which sources are unhealthy?
Which employers lack identity/size/sponsor verification?
What percentage of the Top 1,000 is live?
```

without reading spreadsheets manually.

---

# 64. Final architecture target

```text
Home Office register
        +
external employer research
        ↓
Top 1,000 research dataset
        ↓
typed import / provenance
        ↓
canonical employers
   ↙        ↓         ↘
public      member     source discovery
profiles    context          ↓
                          candidates
                              ↓
                    verified app.job_source
                              ↓
              HTTP / ATS / browser crawler
                              ↓
                       normalized jobs
                              ↓
                        public /jobs
                              ↓
               applications + preparation
```

The merged PR #23 crawler is the foundation.

The Top 1,000 dataset should now be used to turn that crawler into a **large-scale employer discovery system and a stronger OfferLab product**, not to replace what has just been built.
