# ADR 0002: Next.js App Router and strict TypeScript

- Status: Accepted
- Date: 2026-07-19

## Decision

Use Next.js App Router, React, and strict TypeScript. Runtime schemas validate external input. Presentation adapters remain thin and domain logic does not live in components, route handlers, or server actions.

## Consequences

The project gains end-to-end language consistency and strong automated feedback. Framework conventions must not be allowed to erase module boundaries.
