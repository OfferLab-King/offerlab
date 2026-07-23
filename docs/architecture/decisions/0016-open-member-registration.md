# ADR 0016: Open member registration

- Status: Accepted
- Date: 2026-07-24
- Supersedes: ADR 0015 for new registrations

## Decision

Allow normal Supabase email/password registration without an invitation or allow-list. A verified Supabase identity is linked idempotently to exactly one internal OfferLab user with the `member` role and active member entitlement. Administrator promotion remains a separate explicit command.

The existing invitation tables and functions remain as inactive legacy schema to avoid a destructive migration. Active registration does not read, bind, consume, or audit invitations.

## Consequences

Email verification, password policy, rate limiting, safe redirects, onboarding, member route protection, RLS, and explicit administrator separation remain unchanged. ADR 0015 describes historical invite-only behavior and no longer governs new member registration.
