# ADR 0014: Closed-beta backup objective

- Status: Accepted
- Date: 2026-07-19

## Decision

Accept a 24-hour recovery-point objective for closed beta and rely on Supabase Pro managed daily backups initially. Document and rehearse restoration without provisioning additional backup infrastructure in this foundation.

## Consequences

Up to one day of writes may be lost. Enable PITR before this loss becomes commercially, operationally, contractually, or legally unacceptable.
