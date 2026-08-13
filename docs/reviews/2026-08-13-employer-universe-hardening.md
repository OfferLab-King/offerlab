# Employer Universe Hardening Review

**Base:** `origin/main` at `8b90631` (merged PR #27)  
**Branch:** `codex/employer-universe-hardening`  
**Worktree:** `/Users/teaching/Desktop/offerlab-worktrees/employer-universe-hardening`

## Fixed findings

| Area                | Finding                                                                                                                                                | Regression coverage                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Canonical identity  | Application requests dropped selected employer IDs; existing links were also lost on unrelated edits. Server writes accepted mismatched IDs and names. | Existing request unit tests and member-employer integration coverage                                                 |
| Canonical identity  | Career job-target upserts left stale employer IDs and accepted mismatched IDs and names.                                                               | Existing member-employer integration coverage                                                                        |
| Identity matching   | Duplicate normalized names, slugs, aliases, or website hosts were resolved by row order instead of rejected as ambiguous.                              | Parameterised existing identity-match tests                                                                          |
| Analytics           | Historical research snapshots inflated employer platform coverage.                                                                                     | Existing source-discovery integration coverage                                                                       |
| Analytics           | Paused and archived job sources were counted as live across discovery, capability, research, and public-profile reads.                                 | Existing source-discovery, admin-detail, and public-profile integration coverage; forward migration `20260813180000` |
| Source lifecycle    | Re-verifying a promoted candidate downgraded it to `verified`.                                                                                         | Existing source-promotion idempotency coverage                                                                       |
| Dependency security | A newly published high-severity Nano ID advisory affected the shared PostCSS dependency after the clean baseline.                                      | Frozen install, resolved dependency inspection, and clean high-severity audit                                        |

## Reviewed without a confirmed defect

- Employer research/import preservation, source promotion collision handling, outbound URL and robots controls, public-profile fields and indexability, admin detail reads, and employer RLS/grants.
- Existing public directory and autocomplete reads remain explicitly bounded. Saved-employer hydration filters the bounded public directory in memory; no representative failure or material latency was established, so no speculative query rewrite or benchmark was added.
- No taxonomy expansion, crawler connector, or architectural change was required. Dependency drift was limited to the patched transitive Nano ID release.

## Validation

Baseline on unmodified `origin/main` was green: format, lint, typecheck, 951 unit tests, disposable migration replay, 252 integration/security tests, production build, and dependency audit. Final branch validation is recorded in the task handoff after one clean disposable migration replay and full validation pass.
