# ADR 0009: Drizzle access and explicit SQL migrations

- Status: Accepted
- Date: 2026-07-19

## Decision

Use Drizzle for typed server-side PostgreSQL access. Keep explicit ordered SQL under `supabase/migrations/` as schema truth. Replay migrations from zero in CI; do not use schema push for shared environments.

## Consequences

SQL, RLS, grants, and operational risk remain reviewable. Drizzle schema definitions must be kept consistent with migrations. Changes use expand-and-contract compatibility.
