# Employer industry / job function taxonomy redesign plan

**Status:** Partially implemented (2026-08-13) — schema, reference tables and
backfill live; public UX, search/facets and onboarding still use the legacy
dimensions.
**Applies to:** Phase D of the Top 1,000 employer-universe directive
**Contracts:** `src/modules/taxonomy/employer-industry.ts`,
`src/modules/taxonomy/job-function.ts`, `src/modules/taxonomy/career-level.ts`,
`src/modules/taxonomy/taxonomy-mapping.ts`

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
   junior, experienced, manager, senior_leadership, unknown. Keys in
   `career-level.ts`.
4. **Opportunity/programme type** — graduate_scheme, internship, placement,
   apprenticeship, training_contract, experienced_hire, etc. (legacy
   `opportunity_type` retained).

## Migration steps (non-destructive)

1. ✅ Introduce typed employer-industry and job-function keys (contracts +
   `app.employer_industry`, `app.employer_subindustry`, `app.job_function`,
   `app.job_subfunction`, `app.job_career_level` reference tables).
2. ✅ Preserve legacy `sector_key`/`subsector_key`/`opportunity_type` columns.
3. ✅ Add nullable `employer_industry_key`/`employer_subindustry_key` to
   `app.company` and `job_function_key`/`job_subfunction_key`/`career_level_key`
   to `app.job`.
4. ✅ Backfill via deterministic mappings: employer industry from the Top 1,000
   research snapshot sectors (or legacy directory sector), job function from
   the job's own legacy subsector (never from employer industry), career level
   from opportunity type/seniority. Command: `pnpm jobs:taxonomy:backfill`.
5. ✅ Dual-write: the deterministic classification pipeline now writes
   `job_function_key` and `career_level_key` for every discovered or changed
   job (review-gated like the legacy dimensions).
6. ⏳ Migrate public search/facets to the new dimensions (Phase F).
7. ⏳ Migrate onboarding preferences to the unified dimensions (Phase G).
8. ⏳ Migrate SEO metadata (job/employer indexability) (Phases E/F).
9. ⏳ Remove legacy taxonomy only after parity tests pass.

## Constraints

- Do not break existing job URLs, publication state or saved jobs.
- Job function must never be inferred from employer industry alone.
- General and experienced roles remain valid catalogue records; career level
  is a filter, not an admission gate.
- The Top 1,000 workbook sector values are validated against the industry
  keys during import (research snapshot `sector` column).
- Public pages never expose internal employer priority or crawler scores.
