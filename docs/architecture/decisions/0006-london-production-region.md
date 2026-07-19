# ADR 0006: London production region

- Status: Accepted
- Date: 2026-07-19

## Decision

Place production Vercel Node compute and Supabase database/auth services in London. Staging should mirror that placement.

## Consequences

UK user latency and primary-data placement are predictable. A region change requires data migration planning and a new ADR. Third-party subprocessors still require privacy review.
