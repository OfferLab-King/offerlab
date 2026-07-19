# ADR 0012: Real PostgreSQL test strategy

- Status: Accepted
- Date: 2026-07-19

## Decision

Use Vitest for unit and integration tests, the local Supabase PostgreSQL stack for database/policy tests, and Playwright for the critical browser journey. Migration validation recreates the database from zero.

## Consequences

Database behavior and RLS are not mocked. Tests are slower and require Docker, so pure domain tests remain separate and fast. Playwright may run through its documented separate command.
