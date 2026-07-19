# ADR 0015: Invite-only beta entitlement before Stripe

- Status: Accepted
- Date: 2026-07-19

## Decision

Vertical Slice 01 access requires an explicit invitation or allow-list entry and verified email. Public registration alone never grants beta entitlement. Payment and subscription enforcement remain excluded.

## Consequences

Identity, verification, and beta entitlement are distinct states. The entitlement model must later accept paid membership without rewriting authentication.
