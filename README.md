# OfferLab development foundation

This repository contains the OfferLab modular monolith and its implemented preparation workspace. Current capabilities include authentication and onboarding, applications, the Answer and Story Bank, preparation resources and paths, annotated coaching cases, moderated Recruitment Intelligence, manually operated practice/feedback pilots, and a bounded Answer Coach review mode.

Read `docs/product/current-product-contract.md` for the current goal, approved capability boundary and explicit restrictions. Vertical Slice 01 is retained as an implemented historical foundation rather than the current scope limit.

## Prerequisites

- Apple Silicon or another supported development machine.
- Node.js 24.
- pnpm 11.9.0.
- Docker Desktop or another Docker-compatible runtime.

Dependencies and package-manager versions are intentionally pinned. Do not perform casual upgrades inside feature work.

## First local start

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm db:start
pnpm db:reset
pnpm dev
```

Fill `.env.local` with the local values printed by `pnpm db:start`. The web application runs at `http://127.0.0.1:3000`, health is available at `/api/health`, Supabase Studio at `http://127.0.0.1:55323`, and captured local email at `http://127.0.0.1:55324`. OfferLab uses the 5532x port range to avoid collisions with other local Supabase projects. Supabase's local services use development credentials and may bind on all interfaces; use a host firewall and do not run them on an untrusted network.

After `pnpm db:reset`, set `DATABASE_URL` to the local `offerlab_runtime_login` URL and `IDENTITY_SYNC_DATABASE_URL` to the local `offerlab_identity_sync_login` URL; both local-only passwords are `postgres`. Set a synthetic `AUTH_RATE_LIMIT_SECRET`. `DATABASE_MIGRATION_URL` is used only by migrations and explicit CLI commands, never by the running application. Production role provisioning is documented in `docs/operations/authentication.md`.

Exact start command after dependencies and `.env.local` are present:

```bash
pnpm db:start && pnpm db:reset && pnpm dev
```

Local Supabase is not hardened and must not be exposed publicly.

## Validation

Run the complete non-browser validation chain with:

```bash
pnpm validate
```

This runs environment-template validation, formatting, linting, strict type checking, unit tests, starts Supabase, destroys and rebuilds the **local** database from migrations and seeds, runs real-PostgreSQL integration/security tests, and builds the application.

Run Playwright separately:

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

Run the dependency security policy separately with `pnpm security:audit`. CI also scans the Git history for secrets.

## Database workflow

Create a migration:

```bash
pnpm db:new-migration add_example
```

Write explicit, reviewed SQL in the resulting file. Then replay the database:

```bash
pnpm db:reset
pnpm test:integration
```

`supabase/migrations/` is the schema source of truth. `src/infrastructure/database/schema.ts` provides Drizzle's typed application representation and must remain consistent with migrations. Do not use `drizzle-kit push` or dashboard-only schema changes.

Seed data lives in `supabase/seed.sql`. It must be deterministic, synthetic, non-sensitive, and safe to destroy. Never seed production.

## Administrator bootstrap

After a registered user has a linked internal OfferLab record and has verified their Supabase email, promote the first administrator with:

```bash
pnpm admin:promote -- founder@example.com --confirm
```

`DATABASE_MIGRATION_URL` must be available in `.env.local` or the shell. The command refuses missing or unverified users, refuses an already-promoted user, refuses to create a second administrator, and writes a durable audit event in the same transaction.

## Member registration

Members register directly at `/register`. When Supabase email confirmation is enabled, they verify their email before signing in. Verified identities are linked idempotently to an internal OfferLab member and then complete onboarding.

Legacy invitation schema is retained but inactive; registration does not read or consume it. See `docs/operations/authentication.md` for the flow and deployment controls.

## Environments

- **Local:** local Supabase stack and captured email.
- **Test:** migrations replayed against real local PostgreSQL; deterministic identities only.
- **Staging:** separate Vercel and Supabase projects in London; synthetic data only.
- **Production:** Vercel Node compute and Supabase Pro in London; no staging or local credentials.

See `docs/architecture/founder-decisions.md`, `docs/product/current-product-contract.md`, `docs/product/product-strategy-and-roadmap.md`, `docs/product/experience-principles.md`, `docs/product/ai-product-strategy.md`, `docs/architecture/overview.md`, and `docs/operations/` before implementing product behavior.
