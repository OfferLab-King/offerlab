# Authentication operations

## Local test-access bypass

`pnpm dev:bypass` is an explicit developer convenience for local UI testing. It starts the Next.js
development server on `127.0.0.1`, supplies a dedicated deterministic seed member as the current
member, and supplies a synthetic completed onboarding profile when that member has no stored profile.
It does not mint a Supabase session, add a login-capable seed identity, or store a default password.

The bypass fails closed unless all of these conditions hold:

- `LOCAL_AUTH_BYPASS_ENABLED=true`;
- `APP_ENV=local`;
- `NODE_ENV=development`;
- `NEXT_PUBLIC_APP_URL` is loopback; and
- the request `Host` is loopback.

The environment schema rejects the flag in test, staging and production. Standard `pnpm dev` does
not enable it. The bypass identity is separate from integration-test identities so test cleanup
cannot remove local workspace records. Run `pnpm db:reset` before first use so the deterministic
member exists. Never expose
the local Supabase stack or bypass development server to an untrusted network.

## Credential and role boundaries

`DATABASE_MIGRATION_URL` is deploy/CLI-only. The running Next.js application never imports or reads it. `DATABASE_URL` authenticates as a non-owner, non-superuser, non-`BYPASSRLS` login which may assume only `offerlab_app`. `IDENTITY_SYNC_DATABASE_URL` authenticates as a separate non-owner login which may assume only `offerlab_identity_sync`; that group has EXECUTE on the reviewed authentication gateway functions and no direct table or DDL privileges.

Local and CI logins are created by `supabase/roles.sql`. After hosted migrations, provision production logins with `supabase/snippets/provision-runtime-roles.sql`, supplying both passwords from the provider secret store without echoing them. Verify `rolsuper`, `rolcreatedb`, `rolcreaterole`, and `rolbypassrls` are false before launch.

The migrations create `offerlab_auth_function_owner` as `NOLOGIN`, `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOINHERIT`, `NOREPLICATION`, and `NOBYPASSRLS`. It owns only the reviewed authentication gateway and cleanup functions. It has schema usage, read access to the security-barrier `app.auth_user_identity` projection (`id`, `email`, and `email_confirmed_at` only), and operation-specific grants on `app.invitation`, `app.user`, `app.beta_entitlement`, `app.audit_event`, and `app.auth_rate_limit`; it owns no schema or table. Neither runtime login is a member.

Supabase's local migration principal cannot `SET ROLE supabase_auth_admin` and cannot grant a new role direct privileges on provider-owned `auth.users`. The migration therefore uses the narrow projection, owned by the migration role, instead of retaining `postgres` ownership on the authentication functions. Hosted migration acceptance must verify that the same projection, role attributes, ownership, grants, and function ACLs are present. If the hosted project rejects role creation or ownership transfer, stop the release and record the provider error; do not fall back to `postgres` function ownership.

Supabase owns passwords, email verification, recovery, password updates, access tokens, refresh tokens, and sessions. OfferLab issues no reset credential and does not use a service-role client for password changes.

## Registration and identity lifecycle

Registration uses Supabase email/password authentication directly. OfferLab does not require, accept, bind, or consume an invitation in the active registration flow.

The cross-system state machine is:

1. Supabase creates the external Auth identity and applies its configured email-confirmation behavior.
2. When confirmation is required, the callback passes the verified external ID to the narrow linkage function. When confirmation is disabled and Supabase returns a session, registration invokes the same function immediately.
3. One PostgreSQL transaction advisory-locks the external ID, reads trusted verified identity data, creates an internal user explicitly as `member`, activates member entitlement, and appends content-free audit events.
4. Completed linkage is idempotent. Concurrent retries return the same internal authorization state.

Supabase identity creation and PostgreSQL linkage are not one ACID transaction. Temporary callback failure is recovered by a later protected request, which retries the same idempotent verified-identity linkage. Legacy invitation tables and functions remain for non-destructive history but no active registration or authorization path reads or writes them.

## Supabase SSR sessions

`src/proxy.ts` uses the supported `@supabase/ssr` request pattern. It calls `getClaims()` early, passes refreshed cookies to the request, returns rotated cookies to the browser, and propagates the library's private/no-store cache headers. Server Components independently validate claims and enforce route authorization; the proxy is session maintenance, not the authorization boundary.

Authenticated and auth-flow routes are dynamic/private and receive `Cache-Control: private, no-store`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, and a restrictive auth-surface CSP. Application logging redacts URLs, query objects, cookies, authorization headers, and token fields.

## Access decisions

- No authenticated Supabase user: redirect to sign in.
- Authenticated but unverified: verification guidance.
- Verified without active entitlement: beta access denied.
- Verified active member: member routes allowed.
- Administrator role is checked separately and never replaces beta entitlement.
- Revoked members and administrators are denied on the next server request because authorization is read from PostgreSQL each time.

## Enforced rate limits

OfferLab uses a PostgreSQL fixed-window limiter through the narrow identity-sync principal. Keys are HMAC-SHA-256 fingerprints using `AUTH_RATE_LIMIT_SECRET`; raw emails, IP/token combinations, and tokens are never stored or logged.

- Registration: 5 attempts per 15 minutes for each IP and account fingerprint.
- Identity linkage: 10 attempts per 15 minutes for each IP and authenticated identity fingerprint.
- Recovery request: 5 attempts per 15 minutes for each IP and account fingerprint.
- Verification resend: 3 attempts per 15 minutes for each IP and account fingerprint.

Limited endpoints return generic `429` responses with `Retry-After`. In staging and production the application trusts only `x-vercel-forwarded-for`, validates that its first value is an IP address, and maps missing or invalid values to `unknown`. Vercel or the selected deployment adapter must remove any client-supplied value and overwrite that header at the trusted ingress. The application deliberately ignores `x-forwarded-for`, `x-real-ip`, and `cf-connecting-ip` in deployed environments. Local and test environments may use those headers to preserve loopback development behavior. This application control supplements, rather than replaces, Supabase limits for sign-up, sign-in, verification, token refresh, recovery, and email delivery.

Limiter rows have a 24-hour retention period, longer than the 15-minute active window. `app.cleanup_expired_auth_rate_limits()` deletes only rows whose window began more than 24 hours ago, orders through the retention index, locks with `SKIP LOCKED`, and caps every call at 500 rows. Repeated calls make incremental progress without deleting active windows. Only `offerlab_identity_sync` may execute it; the function owner has only the table operations it needs. Schedule `pnpm auth-rate-limits:cleanup` with `IDENTITY_SYNC_DATABASE_URL`; the command repeats capped calls until fewer than 500 rows are deleted and has a 100-batch safety stop. Scheduling is operational acceleration, not required for correctness, and no PostgreSQL scheduler extension is assumed.

Before launch, record hosted Supabase rate-limit values from the dashboard or Management API, confirm custom SMTP limits, verify platform trusted-proxy behavior, and exercise a `429` canary in staging. These hosted settings are operational requirements, not controls implemented by this repository.

## Enumeration, analytics, and recovery

Registration, recovery, resend, and callback failures use generic public responses. Recovery and resend return the same body for known and unknown accounts. Analytics is property-free and emitted only by server code at completed transitions; there is no anonymous auth-event ingestion endpoint.

If a session-bound password update succeeds but provider logout fails, the endpoint clears local Supabase cookies, records only the fixed event name `password_update_logout_failed`, and tells the member that the password changed but global logout is unconfirmed. The member is told to close the browser and sign in again with the new password; the response does not recommend repeating the password change.

## Callback-token logging controls

Supabase verification and recovery may place `token_hash` in the callback query string. Repository code cannot guarantee that infrastructure upstream of OfferLab never records that URL.

Controls implemented in OfferLab are application logger redaction of URLs, query objects, and token fields; `Referrer-Policy: no-referrer`; private/no-store cache headers; an immediate redirect away from the callback URL after token exchange; exclusion of callback credentials from analytics and database audit events; and generic restricted error payloads. These controls apply within the application and are not evidence about upstream logs.

Controls requiring deployment verification include Vercel or other hosting access logs, CDN logs, reverse-proxy logs, WAF logs, APM and error-monitoring request capture, Supabase Auth logs, load-balancer telemetry, and request tracing.

### Production acceptance checklist

Production launch is gated on recorded evidence for every item below, with a named owner and review date:

- Disable, exclude, or redact callback query strings in every hosting, CDN, proxy, WAF, load-balancer, and tracing log under OfferLab's control.
- Restrict access to any unavoidable token-bearing logs and minimize their retention.
- Exclude `token_hash`, `code`, and token-bearing URLs from APM and error payloads.
- Send a staging verification and recovery canary containing a unique synthetic token marker.
- Search all accessible platform, proxy, WAF, APM, error-monitoring, Supabase Auth, tracing, and application logs and record evidence that the marker cannot be found.
- Record the control owner, configuration evidence, exceptions, and approval before production launch.

This checklist is a production acceptance gate, not an implemented runtime control. Until the deployed configuration and canary evidence are recorded, upstream callback-token logging protection remains unverified.
