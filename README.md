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

### Local test access without sign-in

For rapid local UI testing, including browser work driven by Codex, start the loopback-only bypass
server as a member or administrator:

```bash
pnpm dev:bypass
pnpm dev:bypass --admin
```

Open `http://127.0.0.1:3000/member` for `pnpm dev:bypass` or
`http://127.0.0.1:3000/admin` for `pnpm dev:bypass --admin`. The launcher uses the deterministic,
non-login seed member and a synthetic completed profile; it does not create or store a password.

When a local administrator already exists, the administrator command uses that user's existing ID for
bypass authorization and database policies without changing that user or its role. Otherwise, it
temporarily changes the deterministic user's role to `administrator` and restores it to `member` when
the server exits cleanly. Starting member mode always sets the deterministic user's role to `member`
before launch, recovering from an interrupted administrator process. The launcher binds Next.js to
`127.0.0.1` and requires both Supabase database and API URLs to be loopback. Normal `pnpm dev`, tests,
staging and production continue to require Supabase authentication.

The launcher never resets the database. If the local Supabase status omits `API_URL` after startup, run
`pnpm db:stop && pnpm db:start` and then re-run the launcher.

Only one local bypass launcher may run at a time. A second launch fails before Next.js starts, preserving
the selected authorization identity and database role for the active launcher.

## Validation

Run the complete non-browser validation chain with:

```bash
pnpm validate
```

This validates the configured server environment and its template, then runs formatting, linting, strict type checking, unit tests, starts Supabase, destroys and rebuilds the **local** database from migrations and seeds, runs real-PostgreSQL integration/security tests, and builds the application. Next.js also repeats server-environment validation when each Node server instance starts, before it accepts requests.

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

## Job catalogue

The catalogue implementation is dormant by default (`JOB_CATALOG_ENABLED=false`).
The current founder decision approves gated JSearch/manual targets, so direct
employer crawling and public catalogue launch require a further recorded decision.

The job catalogue (`src/modules/job-catalog`) collects UK graduate roles directly from employer career sites and supported ATS job-board APIs, deduplicates them, enriches them with a strict-schema DeepSeek step, and presents them at `/jobs` and `/jobs/[slug]`. Sources are only crawled after `crawl_allowed='allowed'` is recorded. Worker commands run as CLI scripts:

```bash
pnpm jobs:seed-companies --confirm-local   # seed the deterministic example cohort
pnpm jobs:status                           # sources, runs and events snapshot
pnpm jobs:crawl --company=<slug> [--dry-run]
pnpm jobs:crawl:due [--limit=N] [--dry-run]
pnpm jobs:enrich [--limit=N] [--dry-run]
```

See `docs/operations/job-catalog-operations.md` for verification, scheduling (systemd timer) and Lightsail deployment, and ADR 0022 for the architecture decision.

## Environments

- **Local:** local Supabase stack and captured email.
- **Test:** migrations replayed against real local PostgreSQL; deterministic identities only.
- **Staging:** separate Vercel and Supabase projects in London; synthetic data only.
- **Production:** Vercel Node compute and Supabase Pro in London; no staging or local credentials.

See `docs/architecture/founder-decisions.md`, `docs/product/current-product-contract.md`, `docs/product/product-strategy-and-roadmap.md`, `docs/product/experience-principles.md`, `docs/product/ai-product-strategy.md`, `docs/architecture/overview.md`, and `docs/operations/` before implementing product behavior.
