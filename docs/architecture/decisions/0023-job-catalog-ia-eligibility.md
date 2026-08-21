# ADR 0023: Job catalogue information architecture, eligibility and publication pipeline

- Status: Accepted
- Date: 2026-08-10
- Amended: 2026-08-12, 2026-08-13 (Top 1,000 research universe)

## Context

ADR 0022 built the dormant job-catalog ingestion foundation. The founder's
10 August 2026 decision (recorded in `docs/architecture/founder-decisions.md`)
makes OfferLab's own catalogue the primary job-discovery experience, temporarily
disables JSearch, and requires an original information architecture plus a
deterministic eligibility and publication pipeline. On 11 August the founder
broadened the catalogue to include valid general and experienced-hire roles as
well as early-career opportunities. Bright Network is a structure reference
only, never a data source.

## Decision

1. **Taxonomy tables.** New `app.job_sector` and `app.job_subsector` tables with
   stable machine keys (`sector_key` / `subsector_key`), display labels, short
   original descriptions and explicit parent mapping (a subsector belongs to one
   sector; the `other` subsector is unassigned). Opportunity types are a
   constrained list on `app.job`. Display labels are never identifiers.
2. **Eligibility and publication pipeline (deterministic).** Each job stores
   `eligibility_status` (`eligible` / `ineligible` / `needs_review`),
   `eligibility_reasons` (stable keys), `eligibility_evidence` (exact source
   phrases), `publication_status` (`draft` / `published` / `suppressed` /
   `expired`), `classification_source` (`source` / `deterministic` /
   `administrator` / `ai_assisted`) and `classification_version`. The crawler
   pipeline classifies deterministically on insert and on content change;
   `eligible` + deterministic → `published`; `needs_review` → `draft` (admin
   queue); `ineligible` → `suppressed`. Rows whose `classification_source =
'administrator'` are never reclassified or republished automatically.
   Career level is retained as classification evidence but is not a publication
   gate. A current job listing from a verified official source may be eligible whether it
   is graduate, general or experienced-hire work. Ambiguous source records still
   require review. Only `eligible`, `published`, `active` jobs are publicly
   queryable.
3. **Independent official sources.** `app.company` records public employer
   identity while `app.job_source` records independently scheduled official
   early-career, professional, apprenticeship or general sources. Active,
   unauthenticated public employer sources require no separate permission gate.
   High-confidence typed ATS sources may activate automatically after live API
   shape verification, complete connector derivation and audit provenance.
4. **Multiple locations.** New `app.job_location` table (city, region, country,
   source text, remote/hybrid/on-site flags, position) so one requisition can
   appear in several locations without duplicate job records.
5. **Crawler hardening.** Advisory locks (per company and for the enrichment
   worker), response-size limits, bounded manual redirects, SSRF/private-network
   rejection for every fetched URL, no database fallback in production,
   nonzero CLI exit on failed runs, stale-run recovery, and duplicate-source
   coalescing via a `careers_url` uniqueness rule. Supported deterministic
   follow-up resolution (currently Workday detail JSON-LD locations) runs before
   ambiguous jobs enter administrator review. Workday's official external path
   may supply an additive UK-place hint when detail resolution is unavailable;
   it cannot alone suppress an aggregate multi-location vacancy.
6. **Feature gate.** `JOB_CATALOG_ENABLED=false` default: public catalogue
   routes, catalogue APIs and member catalogue integration return 404;
   catalogue URLs are absent from the sitemap; crawling and enrichment do not
   run. JSearch is separately disabled (`JSEARCH_ENABLED=false`), and the
   retired `/member/jobs` screen redirects to the catalogue. Private manual job
   target records remain available to document-tailoring workflows.
7. **AI boundaries.** AI enrichment remains gated (`JOB_LLM_ENABLED=false` by
   default), never writes eligibility or publication fields, and requires
   administrator confirmation for low-confidence classifications before any
   future activation.
8. **Combined employer/sector directory.** `/employers` owns public sector,
   subsector and company browsing. The former `/jobs/sectors/**` pages are
   permanent compatibility redirects, not a second presentation of the same
   taxonomy. Job-list sector filters remain URL-backed on `/jobs`.
9. **Directory metadata is not source state.** `app.company` stores an
   editorial `directory_sector_key`, optional internal
   `directory_priority_rank` and `directory_visible`. These fields let
   a reviewed priority employer appear honestly with zero current roles. They
   never changes source status, eligibility or publication. Public directory
   queries union visible zero-role employers with employers that have current
   eligible published jobs.

## Consequences

- Verified whole-company feeds may populate the catalogue across career levels;
  source active state, UK admission and publication status remain mandatory.
- Deterministic classification is auditable and reproducible; every public job
  has machine-readable eligibility reasons and evidence.
- Administrator overrides are explicit, owner-attributed, versioned and
  audited.
- Incomplete sources stay inactive; the verified cohort manifest bootstraps the
  catalogue and the full sponsor-register employer identity universe with its
  curated Top 1,000 research overlay (founder decision
  2026-08-13) scales the registry beyond the historical 500-employer ceiling.
- The combined directory may be broader than the current job catalogue, but it
  labels zero-role employers and never manufactures vacancy counts.
- The pipeline is an expansion of ADR 0022; that ADR remains valid for the
  ingestion mechanics it describes.

## Notes for operators

See `docs/operations/job-catalog-operations.md`. Production activation requires
`JOB_CATALOG_ENABLED=true`; the AI gates remain required before enrichment runs.
