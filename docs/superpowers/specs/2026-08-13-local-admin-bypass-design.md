# Local Administrator Bypass Design

## Goal

Provide fast administrator UI access for local testing through `pnpm dev:bypass --admin` while preserving the existing member bypass and all production authentication and authorization controls.

## Interface

- `pnpm dev:bypass` starts the existing deterministic local member session.
- `pnpm dev:bypass --admin` starts the same loopback-only development server with administrator authorization.
- Unsupported arguments fail with a concise usage message.

## Authorization and database behavior

The launcher selects a bypass role of `member` or `administrator`. Member mode always uses the deterministic local bypass user and sets its persisted role to `member` before starting Next.js. Administrator mode first reads `app."user"` for an existing administrator. When one exists, it uses that user's ID for bypass authorization and RLS without changing that user or its role. When none exists, it temporarily promotes the deterministic user instead. This satisfies administrator UI guards and RLS policies while preserving the single-administrator constraint.

The launcher passes the selected role and selected user ID through server-only environment variables. The user ID is UUID-validated and, like the role, is accepted only when every existing bypass condition is satisfied: explicit bypass enablement, `APP_ENV=local`, `NODE_ENV=development`, a loopback application URL, and a loopback request host. Local authorization defaults to the deterministic member ID when no selected ID is supplied.

On normal or signal-driven server exit, the launcher restores the deterministic user to `member` only when that launch temporarily promoted it. Existing administrators are never promoted, demoted, or otherwise changed. No password is created, and no production path accepts the bypass role.

## Local service diagnostics

The launcher continues to require loopback database and Supabase API URLs. If the local stack reports a database but omits its API URL because services are stopped, the error names the missing service and gives a safe stop/start recovery command. It never resets the database automatically.

## Coverage

Extend existing tests rather than adding parallel suites:

- local-development configuration tests prove the role defaults to member, accepts administrator only inside the existing local loopback gate, and fails closed elsewhere;
- authorization tests prove member and administrator role selection without a Supabase session and preserve the non-loopback denial;
- launcher behavior is kept small and validated through extracted argument/role selection where practical;
- run focused unit tests first, then format, lint, typecheck, the full unit suite, relevant integration security tests, and build once before updating PR #28.

## Non-goals

- A production administrator bootstrap change.
- A permanent seeded administrator.
- Weakening administrator RLS, normal authentication, or the loopback-only bypass boundary.
- Automatically resetting or destroying any local database.
