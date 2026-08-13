# Local Administrator Bypass Design

## Goal

Provide fast administrator UI access for local testing through `pnpm dev:bypass --admin` while preserving the existing member bypass and all production authentication and authorization controls.

## Interface

- `pnpm dev:bypass` starts the existing deterministic local member session.
- `pnpm dev:bypass --admin` starts the same loopback-only development server with administrator authorization.
- Unsupported arguments fail with a concise usage message.

## Authorization and database behavior

The launcher selects a bypass role of `member` or `administrator`. Before starting Next.js, it updates the deterministic local bypass user's database role to match. This is required because administrator UI guards inspect application authorization while administrator RLS policies inspect the persisted `app."user"` role.

The launcher passes the selected role through a server-only environment variable. Local authorization returns that role only when every existing bypass condition is satisfied: explicit bypass enablement, `APP_ENV=local`, `NODE_ENV=development`, a loopback application URL, and a loopback request host.

On normal server exit, admin mode restores the deterministic user to `member`. Member mode also sets the user to `member` before launch, recovering safely after an interrupted prior admin session. No real account is promoted, no password is created, and no production path accepts the bypass role.

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
