# Local Administrator Bypass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe `pnpm dev:bypass --admin` mode that satisfies both server authorization and administrator RLS during loopback-only local testing.

**Architecture:** Extend the existing local-development configuration with validated bypass role and selected-user variables plus a small CLI argument parser. Member mode always uses the deterministic user. Admin mode reuses an existing local administrator without mutation, or temporarily promotes the deterministic user only when no administrator exists; the launcher passes the selected role and user ID to Next.js and restores member state only after its own temporary promotion.

**Tech Stack:** TypeScript, Next.js 16, Zod environment validation, Postgres.js, Vitest, local Supabase.

## Global Constraints

- Preserve `pnpm dev:bypass` as member mode and add `pnpm dev:bypass --admin` as administrator mode.
- Permit bypass roles only under the existing explicit loopback local-development gate.
- Do not create a permanent seeded administrator, promote, demote, or otherwise change an existing real administrator.
- Do not reset, destroy, or recreate any database automatically.
- Reuse the existing local-development and authorization tests; add no parallel test suite.
- Leave the unrelated generated `next-env.d.ts` worktree change untouched.

---

### Task 1: Validate and authorize the selected local bypass role

**Files:**

- Modify: `src/infrastructure/config/local-development.ts`
- Modify: `src/infrastructure/config/local-development.test.ts`
- Modify: `src/infrastructure/config/environment.ts`
- Modify: `src/infrastructure/config/environment.test.ts`
- Modify: `src/modules/identity-access/application/authorization.ts`
- Modify: `src/modules/identity-access/application/authorization.test.ts`
- Modify: `.env.example`

**Interfaces:**

- Produces: `type LocalAuthBypassRole = "member" | "administrator"`
- Produces: `parseLocalAuthBypassArguments(arguments_: readonly string[]): LocalAuthBypassRole`
- Produces: `localAuthBypassRole(environment?: NodeJS.ProcessEnv): LocalAuthBypassRole`
- Produces: `localAuthBypassUserId(environment?: NodeJS.ProcessEnv): string`
- Consumes: existing `isLocalAuthBypassEnabled` and loopback request-host gate

- [ ] **Step 1: Extend the nearest configuration and authorization tests first**

Add assertions that `[]` selects `member`, `["--admin"]` selects `administrator`, unknown arguments throw a usage error, and `LOCAL_AUTH_BYPASS_ROLE=administrator` changes the deterministic authorization role only for a valid loopback bypass request. Add a UUID-selected bypass-user assertion, verify authorization returns that selected user, and reject malformed or out-of-boundary `LOCAL_AUTH_BYPASS_USER_ID` values.

- [ ] **Step 2: Run the focused tests and witness the intended failure**

```bash
pnpm exec vitest run --config vitest.unit.config.ts \
  src/infrastructure/config/local-development.test.ts \
  src/infrastructure/config/environment.test.ts \
  src/modules/identity-access/application/authorization.test.ts
```

Expected: failures because the role parser, environment key, and administrator authorization behavior do not exist.

- [ ] **Step 3: Implement the minimal configuration and authorization behavior**

Add `LOCAL_AUTH_BYPASS_ROLE` and UUID-validated `LOCAL_AUTH_BYPASS_USER_ID` to the environment allowlist/schema and require both to remain inside the same local-development bypass boundary. Parse only zero arguments or exactly `--admin`; default the role and user ID to the deterministic member. Return both selected values from `localDevelopmentAuthorization` after the existing loopback request-host check. Document the optional variables in `.env.example`.

- [ ] **Step 4: Re-run the focused tests**

Run the command from Step 2. Expected: all selected tests pass.

- [ ] **Step 5: Commit the authorization batch**

```bash
git add .env.example src/infrastructure/config/local-development.ts \
  src/infrastructure/config/local-development.test.ts src/infrastructure/config/environment.ts \
  src/infrastructure/config/environment.test.ts \
  src/modules/identity-access/application/authorization.ts \
  src/modules/identity-access/application/authorization.test.ts
git commit -m "feat: select local bypass administrator role"
```

### Task 2: Align the local database role and improve launcher diagnostics

**Files:**

- Modify: `scripts/run-local-bypass.ts`
- Modify: `README.md`

**Interfaces:**

- Consumes: `parseLocalAuthBypassArguments(process.argv.slice(2))`
- Consumes: `localAuthBypassMember.userId`
- Sets: `LOCAL_AUTH_BYPASS_ROLE` and `LOCAL_AUTH_BYPASS_USER_ID` for the Next.js child process

- [ ] **Step 1: Update the launcher around the tested role parser**

Parse the CLI mode before starting services. After reading local Supabase status, distinguish missing `API_URL` from a non-loopback URL and report a safe `pnpm db:stop && pnpm db:start` recovery without invoking reset. Verify the deterministic user exists. Member mode sets it to `member`; admin mode reuses an existing administrator's ID without mutation or temporarily promotes the deterministic user only when none exists. Pass the selected user ID to Next.js and print the selected `/member` or `/admin` URL.

- [ ] **Step 2: Restore safe member state**

Wrap the child server launch so normal or signal-driven exit restores the deterministic user's persisted role to `member` only when that launch promoted it. Always set member mode to `member` before launch so it recovers after an interrupted admin process. Never mutate an existing administrator.

- [ ] **Step 3: Document both commands and recovery behavior**

Document `pnpm dev:bypass` and `pnpm dev:bypass --admin`, existing-administrator reuse, conditional temporary deterministic-role change, loopback restrictions, clean-exit restoration, and the stopped-service recovery command. Explicitly say the launcher never resets the database.

- [ ] **Step 4: Run focused static and unit validation**

```bash
pnpm exec prettier --check scripts/run-local-bypass.ts README.md \
  src/infrastructure/config/local-development.ts \
  src/infrastructure/config/local-development.test.ts \
  src/infrastructure/config/environment.ts \
  src/infrastructure/config/environment.test.ts \
  src/modules/identity-access/application/authorization.ts \
  src/modules/identity-access/application/authorization.test.ts
pnpm exec eslint scripts/run-local-bypass.ts src/infrastructure/config \
  src/modules/identity-access/application/authorization.ts \
  src/modules/identity-access/application/authorization.test.ts --max-warnings=0
pnpm exec vitest run --config vitest.unit.config.ts \
  src/infrastructure/config/local-development.test.ts \
  src/infrastructure/config/environment.test.ts \
  src/modules/identity-access/application/authorization.test.ts
```

Expected: all commands pass.

- [ ] **Step 5: Commit the launcher batch**

```bash
git add scripts/run-local-bypass.ts README.md
git commit -m "feat: add local administrator bypass launcher"
```

### Task 3: Verify the complete change and update PR #28

**Files:**

- No planned source changes.

**Interfaces:**

- Verifies: member and administrator modes against the existing local stack without database reset

- [ ] **Step 1: Restore stopped local Supabase services without resetting data**

Use `pnpm db:stop && pnpm db:start` only if `supabase status` still omits `API_URL`. Confirm the status reports loopback DB and API URLs before launching either mode.

- [ ] **Step 2: Exercise both local modes**

Start member mode on a non-default test port, request `/member`, and confirm the deterministic user's persisted role is `member`. Stop it cleanly. Start admin mode, request `/admin`, confirm an HTTP success and persisted `administrator` role, then stop it cleanly and confirm the role returns to `member`.

- [ ] **Step 3: Run final validation once**

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm build
pnpm security:audit
```

Expected: all commands pass. No migration replay or full integration suite is required because the schema and persistence repositories are unchanged; the live local role check covers the RLS-dependent launcher behavior.

- [ ] **Step 4: Audit and publish the branch**

Confirm `git diff --check`, a clean intended worktree apart from the pre-existing generated `next-env.d.ts` change, push the new commits to `origin/codex/employer-universe-hardening`, and verify draft PR #28 points at the new head.
