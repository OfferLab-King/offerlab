# Deferred Improvement: CMS Mutation Transport Hardening

## Status

**Deferred**

This is not an Increment 5 release blocker.

OfferLab will retain Next.js Server Actions for Knowledge Library and Content CMS mutations during the current development and beta phases.

No immediate architecture change is required.

## Current architecture

Administrator CMS forms submit through Next.js Server Actions.

The current mutation path is:

```text
CMS form
→ Next.js Server Action transport
→ administrator authentication and authorization
→ application-level input extraction and validation
→ application service
→ transactional repository mutation and audit insertion
→ PostgreSQL with forced RLS
```

Each administrator Server Action must verify the authenticated user and administrator role before application-level code:

- reads submitted form fields;
- validates submitted content;
- loads mutable records;
- starts a database transaction;
- calls a mutation repository;
- inserts an audit event;
- emits analytics.

Server Actions must be treated as publicly reachable mutation endpoints. Their identifiers or rendered availability are not authorization controls.

## Accepted framework boundary

Next.js may receive and decode the Server Action transport payload before the OfferLab action function begins.

OfferLab can guarantee authorization before **application-level field extraction and mutation**, but it does not claim to authorize before Next.js performs framework-level request decoding.

Strict control over authentication before application-controlled body parsing would require a different transport, such as a dedicated Route Handler.

This stricter transport boundary is not required for Increment 5.

## Potential risks

Retaining Server Actions creates a limited set of transport-level considerations:

1. An unauthorized request may consume some framework processing, memory, bandwidth, or function capacity before OfferLab rejects it.
2. Malformed or oversized requests may be rejected by Next.js before OfferLab’s normal application error handling runs.
3. Framework-rejected requests may not appear in OfferLab’s application logging or audit pipeline.
4. Framework upgrades may change low-level Server Action transport or error behavior.
5. Server Actions do not replace production rate limiting, monitoring, or platform-level abuse controls.
6. Incorrect origin or proxy configuration could break legitimate actions or unnecessarily broaden accepted origins.

These are primarily availability, observability, cost, and transport-control concerns. They do not permit unauthorized CMS mutations when action-level authorization, service authorization, database privileges, and RLS are implemented correctly.

## Current controls

The current implementation relies on layered controls:

- administrator authorization inside every Server Action;
- no application-level form-field reading before authorization;
- bounded content and field validation;
- framework-level Server Action request-size limits;
- same-origin and framework origin protections;
- generic unauthorized and conflict behavior;
- transactional mutations and audit insertion;
- optimistic concurrency;
- forced PostgreSQL RLS;
- narrowly privileged runtime database roles;
- no browser or identity-sync access to CMS tables;
- safe Markdown rendering;
- controlled link and video validation;
- no file upload support;
- no arbitrary HTML or iframe submission;
- no content, identifiers, or request bodies in operational logs;
- production platform monitoring and rate limiting to be addressed during production readiness.

## Current decision

Retain Server Actions for the current CMS.

Do not redesign the CMS mutation transport solely to obtain application control before framework-level request decoding.

A transport redesign would add:

- additional browser/API mutation code;
- duplicated request handling;
- more cache and error-state coordination;
- possible divergence between browser and API behavior;
- substantial regression-testing requirements;
- new security implementation risk.

The current architecture is appropriate for a small, administrator-only CMS when the documented controls remain enforced.

## Future improvement option

A future hardening increment may move administrator mutations to thin Route Handlers while preserving the existing domain and persistence layers.

A possible future flow is:

```text
CMS client
→ dedicated Route Handler
→ authenticate from session
→ authorize administrator
→ validate content type and declared size
→ read bounded request body
→ shared validation
→ existing application service
→ existing transactional repository and audit
→ PostgreSQL with forced RLS
```

Only the transport layer should change. The following should remain reusable:

- domain validation;
- application services;
- repository methods;
- audit behavior;
- optimistic concurrency;
- RLS;
- database privileges;
- content lifecycle;
- taxonomy management;
- recommendation integration.

## Revisit triggers

Reconsider the transport architecture when one or more of the following become true:

- OfferLab exposes CMS functionality to many administrators or external contributors.
- CMS endpoints experience meaningful abuse or excessive request-processing costs.
- OfferLab requires administrator-specific rate limits.
- Exact control of `401`, `403`, `413`, validation, and conflict responses becomes necessary.
- A non-browser client needs to publish or manage content.
- OfferLab integrates with an external CMS or content-import service.
- Machine-to-machine publishing is introduced.
- File uploads or substantially larger content payloads are introduced.
- Independent public API versioning is required.
- Detailed API-level monitoring or penetration testing requires conventional endpoints.
- A legal, regulatory, contractual, or internal-security requirement mandates authentication before application-controlled body decoding.
- Framework behavior creates an observed security, reliability, or operational problem.

Do not redesign based only on a theoretical possibility without evidence or a concrete requirement.

## Potential future hardening tasks

When a revisit trigger occurs, assess:

1. Dedicated administrator Route Handlers.
2. Authentication before `request.json()` or `request.formData()`.
3. Explicit content-type enforcement.
4. Explicit body-size checks before decoding where technically reliable.
5. Per-administrator and per-IP rate limiting.
6. Request identifiers and structured security monitoring.
7. Consistent API error contracts.
8. CSRF and origin-policy review.
9. Proxy and trusted-origin configuration.
10. Abuse and denial-of-service testing.
11. Route Handler and Server Action migration compatibility.
12. Preservation of transactional audit guarantees.
13. Full browser, authorization, RLS, concurrency, and rollback regression testing.

## Increment 5 treatment

For Increment 5:

- retain Server Actions;
- document the framework boundary;
- keep administrator authorization first within application-controlled execution;
- verify unauthorized users cannot reach validation, repositories, transactions, audit, or analytics;
- verify conflict responses remain generic;
- verify CMS payloads do not enter logs;
- complete the remaining acceptance tests;
- do not treat the deferred transport redesign as a merge blocker.

## Ownership and review

Review this decision during:

- production beta readiness;
- any CMS expansion;
- any introduction of external content contributors;
- any file-upload implementation;
- any observed CMS abuse or operational incident.

Until a revisit trigger occurs, this item remains deferred.
