# Local Administrator Bypass Design

## Goal

Provide fast administrator UI access for local testing through `pnpm dev:bypass --admin` while preserving the existing member bypass and all production authentication and authorization controls.

## Interface

- `pnpm dev:bypass` starts the existing deterministic local member session and prints its one-time tokenized bootstrap URL.
- `pnpm dev:bypass --admin` starts the same loopback-only development server with administrator authorization and prints its one-time tokenized bootstrap URL.
- Unsupported arguments fail with a concise usage message.

## Authorization and database behavior

The launcher acquires a session-level PostgreSQL advisory lock before selecting an identity or changing a role. Before Next.js starts, a detached child supervisor acquires a companion session lock and keeps it until Next.js has definitively closed. A second launcher checks both locks and fails before identity mutation or child startup. If the launcher crashes or is killed, loss of its IPC channel makes the supervisor stop Next.js while retaining the companion lock; only after Next.js closes does the supervisor release it. Member mode always uses the deterministic local bypass user and sets its persisted role to `member` before starting Next.js. Administrator mode first reads `app."user"` for an existing administrator other than the deterministic bypass user. When one exists, it uses that user's ID for bypass authorization and RLS without changing that user or its role, even if the deterministic seed is absent. When none exists, it requires the deterministic user and temporarily promotes it instead. This also treats a deterministic user left as administrator after a hard kill as the temporary fallback identity, so a normal subsequent exit restores it to `member`.

The launcher passes the selected role, selected user ID, and an unguessable per-launch token through server-only environment variables. Its HTTP boundary overwrites an internal client-address header from the actual socket. The tokenized bootstrap URL sets an HttpOnly, SameSite cookie and redirects to the clean member or administrator path. The user ID is UUID-validated and, like the role, is accepted only when every existing bypass condition is satisfied: explicit bypass enablement, `APP_ENV=local`, `NODE_ENV=development`, a loopback application URL, a strict loopback request host, a loopback socket client address, and the per-launch cookie. Loopback host parsing rejects userinfo and paths and accepts only exact `localhost`/`::1` or numeric `127.0.0.0/8` addresses. Local authorization defaults to the deterministic member ID when no selected ID is supplied.

On normal or signal-driven server exit, the launcher restores the deterministic user to `member` only when that launch temporarily promoted it. Existing administrators are never promoted, demoted, or otherwise changed. Closing the reserved launcher and child-supervisor connections releases their advisory locks even when cleanup reports an error. No password is created, and no production path accepts the bypass role.

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
