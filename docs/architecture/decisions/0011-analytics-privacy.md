# ADR 0011: Typed privacy-safe analytics abstraction

- Status: Accepted
- Date: 2026-07-19

## Decision

Product analytics uses a provider-neutral typed interface. Event properties are allow-listed. Slice 01 starts with a safe no-op or first-party capture implementation; PostHog is deferred. Audit events are separate.

## Consequences

Company names, role names, notes, emails, raw application IDs, and sensitive onboarding data are prohibited from analytics. Provider integration can be added without changing domain modules.
