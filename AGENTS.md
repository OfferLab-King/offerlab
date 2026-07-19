# OfferLab Agent Guide

## Product context

OfferLab is a responsive web platform that helps UK graduate applicants track applications and receive structured preparation guidance. The first delivery scope is Vertical Slice 01. The technical foundation must remain a modular monolith and the main journey must not depend on generative AI.

## Sources of truth

Read these before changing behavior:

1. `docs/architecture/founder-decisions.md` — approved clarifications; highest product authority for implementation.
2. `docs/product/vertical-slice-01.md` — binding first implementation scope.
3. `docs/product/mvp-brief.md` — broader product direction.
4. `docs/product/critical-user-journey.md` and `docs/product/screen-map.md` — journey and screen context.
5. `docs/architecture/decisions/` — accepted technical decisions.

If sources conflict, do not guess. Apply the precedence above, document the conflict, and ask the founder when it materially affects behavior, privacy, security, schema, or scope.

## Architecture

- One Next.js App Router application using React and strict TypeScript.
- Node runtime for database-backed work; no edge-only assumptions.
- Modular monolith with domain/application/infrastructure/presentation boundaries.
- Supabase PostgreSQL and Auth; internal OfferLab UUIDs link to Supabase identities.
- Drizzle provides typed database access. Versioned SQL migrations are the schema source of truth.
- Member-owned records require both owner-scoped server queries and PostgreSQL RLS.
- Public, authentication, member, and administrator routes share one deployment.
- Production web compute and database services run in London.

Module contracts are described in `docs/architecture/overview.md`. Route handlers and React components must not contain domain rules or issue ad hoc database queries.

The declared modules are identity and access, member profile, applications, taxonomy, preparation resources, recommendations, dashboard, administration, audit, analytics, and observability. Modules may use shared primitives and declared public module APIs, but must not import another module's internal persistence implementation.

## Toolchain

- Use Node.js 24.x, as pinned in `.nvmrc` and `package.json`.
- Use pnpm 11.9.0, as pinned by the `packageManager` and `engines` fields in `package.json`.
- Use Docker Desktop or another Docker-compatible runtime for local Supabase.
- Install dependencies with `pnpm install --frozen-lockfile`.

## Routine commands

```bash
pnpm install --frozen-lockfile
pnpm db:start
pnpm db:reset
pnpm dev
pnpm format
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm test:e2e
pnpm build
pnpm validate
pnpm security:audit
```

`pnpm validate` starts Supabase and resets its local database before migration and integration tests. Never point local or test commands at staging or production.

## Migrations and seeds

- Create a migration with `pnpm db:new-migration -- <description>`.
- Write and review explicit SQL in `supabase/migrations/`.
- Never use schema push as a production migration mechanism.
- Run `pnpm db:reset` to replay all migrations and `supabase/seed.sql` from zero.
- Seeds must be deterministic, synthetic, and contain no copied production data.
- Use expand-and-contract changes. Prefer a corrective forward migration to rollback.
- Every member-owned table must enable and force RLS and include policy tests.

## Test users

The seed creates two deterministic, non-login identities for database isolation tests. They use the reserved `.invalid` domain and have no passwords. Until authentication UI is implemented, create a login-capable local identity through Supabase Studio at `http://127.0.0.1:55323`; never reuse real credentials. Internal user linking must be performed by the application flow added in Vertical Slice 01, not by manually copying production data.

## Environment variables

- `.env.example` contains names only and must never contain values.
- Store local values in `.env.local`, which is ignored.
- Production and staging values belong in provider secret stores.
- Never expose service-role or database credentials with a `NEXT_PUBLIC_` prefix.
- Configuration is validated at runtime; add new keys to the schema and `.env.example` together.
- Never commit tokens, passwords, private keys, connection strings, or copied user data.

## Privacy and security invariants

- Every application repository operation must accept the authenticated internal owner ID.
- Never query a member-owned entity by object ID without owner scope.
- RLS is defence in depth, not a replacement for server authorization.
- Include two-user horizontal-access tests for every member-owned module.
- Normal administrator screens must not expose private application notes.
- Do not log application notes, tokens, passwords, email addresses, or sensitive onboarding answers.
- Analytics properties are deny-by-default and explicitly allow-listed.
- Never send company names, role names, notes, emails, or raw application IDs to analytics.
- Audit events and product analytics are separate stores and concepts.
- Do not derive authorization from user-editable metadata.

## Scope discipline

- Do not perform unrelated refactoring.
- Do not introduce microservices, Kubernetes, queues, caches, a separate API deployment, AI infrastructure, or speculative abstractions.
- Do not implement features outside the approved vertical slice.
- Update tests whenever behavior changes.
- Record significant architectural changes as an ADR before relying on them.
- Preserve stable internal keys; display labels are not identifiers.

## Definition of done

A change is complete only when:

1. It satisfies the approved acceptance criteria without adding excluded scope.
2. Formatting, lint, strict type checking, unit tests, integration tests, build, and migration validation pass.
3. Relevant browser and security tests pass.
4. Privacy, RLS, logging, analytics, and migration implications have been reviewed.
5. Documentation, migrations, seeds, and ADRs are updated where applicable.
6. No secret or high-severity dependency finding is ignored without a documented decision.

Never bypass failing tests, weaken assertions, disable strictness, reduce security checks, or add broad exclusions merely to make validation pass.
