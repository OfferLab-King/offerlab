# Employer Universe Hardening Design

## Goal

Correct confirmed post-PR #27 defects without expanding the employer-universe feature set or rebuilding architecture already covered by PRs #23–#27.

## Confirmed fixes

### Canonical employer linkage

- Submit the selected `companyId` from the application form API payload.
- Initialise the autocomplete field with an existing application's canonical company ID so an unrelated edit preserves the link.
- Clear the ID only when the member changes the free-text employer value.
- Validate canonical linkage at the server/database boundary so an arbitrary UUID cannot create a false employer/name association.
- Preserve the existing free-text fallback when no canonical employer is selected.

### Identity and analytics correctness

- Treat duplicate normalized canonical names, aliases, slugs, or website-host matches as ambiguous instead of choosing one company by insertion order.
- Compute platform coverage from only the latest research snapshot per resolved company so historical snapshots do not inflate employer, tier, verified, or live totals.

## Continued review boundary

After these fixes, inspect the touched employer research, source discovery, crawler, public/member/admin, SEO, RLS, and representative query paths for additional evidence-backed defects. Consolidate findings with a shared root cause and do not add speculative features, broad refactors, or benchmarks without a credible risk.

## Test and validation strategy

- Search existing coverage before every test change.
- Extend the nearest application/member-employer, identity-match, and source-discovery tests; create no parallel test files for these invariants.
- During implementation, run only the smallest affected unit or integration subset.
- Use the established disposable Supabase project and unique ports for database checks; never reset the persistent `offerlab` project.
- After each bounded batch, run only affected groups and critical shared regressions.
- At completion, run format, lint, strict typecheck, the full unit suite, one disposable migration replay, the full integration/security suite, and production build once.

## Non-goals

- New crawler connectors, employer features, dashboards, taxonomy expansion, or public content.
- Dependency upgrades or database redesign unrelated to a confirmed defect.
- Weakening owner scoping, forced RLS, source verification, publication, privacy, or SEO honesty rules.
