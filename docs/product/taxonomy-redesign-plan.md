# Employer industry / job function taxonomy redesign plan

**Status:** Preparation contract (not yet a migration)
**Applies to:** Phase D of the Top 1,000 employer-universe directive
**Contracts:** `src/modules/taxonomy/employer-industry.ts`, `src/modules/taxonomy/job-function.ts`

## Problem

The current taxonomy mixes employer industry, career sector, job function and
business line in one dimension. A bank's software engineer is classified by
the employer's industry, which makes job-function discovery impossible.

## Target model

Four distinct dimensions:

1. **Employer industry / subindustry** — what the employer is (e.g.
   Financial Services · Banking). Keys in `employer-industry.ts`.
2. **Job function / subfunction** — what the role does (e.g. Software
   Engineering · Backend). Keys in `job-function.ts`.
3. **Career level** — school_leaver, student, intern, graduate, entry_level,
   junior, experienced, manager, senior_leadership, unknown.
4. **Opportunity/programme type** — graduate_scheme, internship, placement,
   apprenticeship, training_contract, experienced_hire, etc.

## Migration steps (non-destructive)

1. Introduce typed employer-industry and job-function keys (this contract).
2. Preserve legacy `sector_key`/`subsector_key`/`opportunity_type` columns.
3. Add nullable `employer_industry_key`, `job_function_key` columns to
   `app.company` and `app.job`.
4. Backfill via a deterministic mapping from existing values and the Top 1,000
   research snapshot sectors (`employerIndustryFromResearchSector`).
5. Dual-read/dual-write where needed; migrate search/facets, onboarding,
   SEO and admin views behind feature flags.
6. Remove legacy taxonomy only after parity tests pass.

## Constraints

- Do not break existing job URLs, publication state or saved jobs.
- Job function must never be inferred from employer industry alone.
- General and experienced roles remain valid catalogue records; career level
  is a filter, not an admission gate.
- The Top 1,000 workbook sector values are validated against the industry
  keys during import (research snapshot `sector` column).
- Public pages never expose internal employer priority or crawler scores.
