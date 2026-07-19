# ADR 0003: Supabase PostgreSQL as system of record

- Status: Accepted
- Date: 2026-07-19

## Decision

Use managed Supabase PostgreSQL as the authoritative store. Relational constraints, stable keys, transactions, and RLS protect core data. Do not introduce an alternate application datastore.

## Consequences

PostgreSQL keeps core data portable while Supabase reduces operations. Provider-specific APIs must not enter domain logic. Production uses the London region.
