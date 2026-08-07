# Architecture overview

## System shape

OfferLab is one Next.js App Router modular monolith. Public, authentication, member, and administrator routes share one codebase and one web deployment. PostgreSQL is the system of record; Supabase provides managed PostgreSQL and authentication. Database-backed code uses the Node runtime.

```text
Browser
  -> Next.js presentation layer
  -> application use cases
  -> domain modules
  -> owner-scoped repositories
  -> PostgreSQL RLS
  -> Supabase PostgreSQL (London)
```

There is no separate backend deployment. Route handlers and server actions are adapters into application use cases, not places for business rules.

## Module boundaries

- **Identity and access:** Supabase identity linkage, internal user UUIDs, beta entitlement, sessions, roles, and authorization.
- **Member profile:** onboarding answers and completion. No application stages or deadlines belong here.
- **Applications:** private application lifecycle, stage and deadlines. All repository operations require owner ID.
- **Answer Bank:** private reusable stories, curated-question answers and explicit story-to-answer relationships. All member records are owner scoped.
- **Taxonomy:** stable education, opportunity, industry, priority, and recruitment-stage keys.
- **Preparation resources:** canonical safe-Markdown library content, publication/access lifecycle, search, taxonomy associations, and owner-private save/completion state.
- **Learning paths:** ordered collections of canonical preparation resources and owner-private progress derived from resource completion.
- **Recruitment intelligence:** cycle-dated candidate reports, controlled context, human moderation, publication confidence and privacy-safe contribution status.
- **Practice services:** curated pilot availability and privacy-minimal member requests. It does not perform payments, matching, messaging or marketplace discovery.
- **Answer Coach:** a provider-neutral review contract, strict structured output, recoverable review snapshots and anchored comment state. The initial member prototype uses a deterministic local rubric; a model provider remains behind the AI privacy and evaluation gate.
- **Recommendations:** pure deterministic matching, ordering, deduplication, limits, and explanations.
- **Dashboard:** composes applications, deadlines, and recommendations without owning their rules.
- **Administration:** explicit administrative use cases; no general private-note access.
- **Audit:** append-only material administrative and security events.
- **Analytics:** typed, provider-neutral, allow-listed product events.
- **Observability:** structured redacted logs, health, and request correlation.

Modules may depend on shared primitives and declared public module APIs. They must not import another module's internal persistence implementation.

## Data isolation

Member-owned records use two independent controls:

1. Application repositories require internal owner IDs and include ownership in every query.
2. PostgreSQL RLS restricts the application database role using a transaction-scoped internal user ID.

Tests must use two users and attempt direct-object access. Migration credentials exist only in controlled deployment and command environments. The web runtime uses a least-privileged login that may assume `offerlab_app`. A separate identity-sync login may execute only reviewed authentication gateway functions; it has no direct table or DDL privileges. Neither runtime login owns tables or bypasses RLS.

## Portability

Core logic is pure TypeScript. PostgreSQL migrations are explicit SQL. The web application uses the Node runtime and must remain buildable as a standard Node deployment. Vercel and Supabase reduce operating work but must not become domain dependencies.

## Environments and delivery

Local and CI use the Supabase CLI with real PostgreSQL. Staging and production are isolated projects in London. CI validates migrations from zero before deployment. Production migration execution is a controlled release step and uses expand-and-contract compatibility.
