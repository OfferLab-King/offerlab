# ADR 0013: Node deployment portability

- Status: Accepted
- Date: 2026-07-19

## Decision

Deploy Next.js to Vercel using London Node compute while avoiding edge-only APIs and proprietary data stores in core behavior. Keep configuration, SQL, and domain logic portable to a standard Node container.

## Consequences

Vercel provides fast operations without becoming an irreversible runtime dependency. Edge optimization can be considered only for demonstrably stateless public behavior.
