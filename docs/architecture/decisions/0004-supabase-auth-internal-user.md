# ADR 0004: Supabase Auth with internal OfferLab identity

- Status: Accepted
- Date: 2026-07-19

## Decision

Supabase Auth owns credentials, verification, password recovery, password updates, and sessions. OfferLab must not issue a secondary reset ticket or use service-role authority for ordinary password changes. OfferLab owns an internal UUID linked one-to-one to the Supabase identity. Domain tables reference the internal UUID.

## Consequences

Auth operations are managed while domain identity stays portable. Linking must be idempotent and recoverable. Authorization never trusts user-editable metadata.
