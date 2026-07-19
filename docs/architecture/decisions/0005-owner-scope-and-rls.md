# ADR 0005: Owner-scoped authorization plus PostgreSQL RLS

- Status: Accepted
- Date: 2026-07-19

## Decision

Every repository operation over member-owned data requires authenticated internal owner ID and scopes its query by that owner. Every member-owned table also enables and forces RLS. The application role receives a transaction-scoped internal user context.

## Consequences

Privacy has two barriers. Each module requires two-user horizontal-access tests. Privileged credentials stay outside normal request paths.
