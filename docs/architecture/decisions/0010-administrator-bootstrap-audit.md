# ADR 0010: Administrator bootstrap and audit

- Status: Accepted
- Date: 2026-07-19

## Decision

Promote the first administrator through a confirmed one-time command using an existing verified OfferLab email. The transaction updates the internal role and appends an audit event. It fails for missing, unverified, already-admin users or when another administrator exists.

## Consequences

No user-editable metadata or silent multi-admin path exists. General multi-admin management is deferred and requires an approved design.
