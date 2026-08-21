# Enterprise readiness plan

**Status:** Founder-approved delivery plan

**Approved:** 2026-08-21

**Target:** A controlled public launch and reliable operation for more than
1,000 registered members, with paid membership, official-source job discovery
and administrator operations.

**Authority:** This plan sequences already approved product capabilities and
production safeguards. It does not approve new marketplace, coach-payment,
commercial-aggregator or hosted-AI scope. Founder Decisions and the current
product contract retain precedence.

## Outcome

OfferLab does not need microservices, Kubernetes or a separate API deployment
to serve this target. Keep the modular monolith, PostgreSQL system of record,
dedicated crawler worker and London deployment. Enterprise readiness means
proving reliability, recovery, security, privacy, payments and support around
that architecture.

The launch order is:

1. Stripe membership;
2. observability and alerting;
3. staging and controlled releases;
4. restore evidence and PITR;
5. administrator hardening;
6. representative load testing;
7. privacy and account lifecycle;
8. crawler operational hardening;
9. Library usability and production content;
10. controlled cohort expansion.

Later work must not bypass an incomplete earlier launch gate.

## Existing strengths to preserve

- strict TypeScript, pinned toolchain and reproducible installs;
- modular-monolith domain boundaries;
- owner-scoped repository operations plus forced PostgreSQL RLS;
- separate runtime, identity-sync, migration and crawler database roles;
- versioned SQL migrations and real-PostgreSQL integration tests;
- unit, integration, browser, build, secret-scan and dependency-audit CI;
- official-source crawler isolation, advisory locks, backoff and source pause;
- redacted logs and deny-by-default analytics properties;
- public catalogue query optimisation tested with production-sized fixtures;
- free-product fallback when payments, hosted AI or crawler enrichment is
  unavailable.

## Release gates

### Gate A — production foundation

Required before an unrestricted production registration launch:

- London staging and production environments exist and are isolated;
- required CI checks protect the production branch;
- production secrets are stored only in provider secret stores;
- runtime roles and hosted RLS grants match the reviewed migrations;
- custom SMTP, SPF, DKIM and DMARC are configured;
- authentication proxy/header behaviour and callback-token log canaries pass;
- production monitoring, alert routing and an incident owner exist;
- an isolated backup restore has succeeded and its recovery time is recorded;
- privacy, terms, contact and account-lifecycle information is published;
- founder/editor-approved content replaces development-only fixtures.

### Gate B — paid membership

Required before a production member can purchase:

- Stripe Checkout, verified webhooks and Customer Portal implement ADR 0025;
- webhook processing is idempotent under duplicates and out-of-order delivery;
- browser redirects never grant entitlements;
- monthly cancellation, payment recovery and season-pass expiry are tested;
- refund reconciliation, operator support and privileged repair are documented;
- live tax-inclusive GBP prices and Stripe Tax are configured;
- a checkout kill switch leaves the free workspace usable;
- one controlled live purchase, cancellation and refund has been completed;
- cancellation, refund, privacy, contact and statutory-rights copy is published.

### Gate C — 1,000-member expansion

Required before expanding beyond the controlled beta:

- representative load tests meet the service objectives below;
- database connection usage remains within the hosted pool budget;
- no unresolved high-severity security finding exists;
- administrator MFA and least-privilege operational roles are active;
- PITR is active and a second recovery exercise has confirmed the runbook;
- two stable production weeks have passed at the prior cohort;
- payment, authentication, crawler and support alerts have named responders;
- account export and deletion requests can be fulfilled and audited.

## ER-01 — Stripe membership completion

**Priority:** P0

Implement the accepted two-offer boundary in ADR 0025:

- server-side allow-listed monthly and six-month Stripe Price identifiers;
- authenticated Checkout Session creation with controlled return routes;
- a durable owner/customer/session mapping that does not trust browser metadata;
- signature-verified webhook ingress with event-id idempotency;
- minimum reconciliation state for subscriptions, season passes and refunds;
- confirmation-pending, active, cancelling, recovery and expired UI states;
- Customer Portal creation for recurring members;
- an audited operator reconciliation command;
- request concurrency protection against duplicate live Checkout Sessions;
- a server-side checkout kill switch.

Acceptance evidence:

- unit tests cover offer mapping and state transitions;
- integration tests cover owner isolation, duplicate and out-of-order events;
- browser tests cover checkout start, abandonment and confirmation-pending;
- Stripe test-mode tests cover payment, renewal failure/recovery, cancellation,
  expiry and refund;
- production activation evidence records the live test purchase and refund.

## ER-02 — Observability, SLOs and incident response

**Priority:** P0

Add privacy-safe production telemetry:

- structured logs with request, crawl-run and payment-event correlation IDs;
- error monitoring with URL, query, cookie, token, email and member-content
  redaction;
- OpenTelemetry-compatible web, PostgreSQL, Stripe and crawler traces;
- dashboards for request latency/error rate, database connections and slow
  queries, authentication failures, webhook convergence and crawler health;
- synthetic checks for registration, sign-in, Jobs, Employers, Plans and
  administrator health;
- alert routing, acknowledgement ownership and escalation;
- incident, communication and post-incident review templates.

Initial objectives:

| Measure                        | Initial target    |
| ------------------------------ | ----------------- |
| Monthly availability           | 99.9%             |
| Public route p95               | below 500 ms      |
| Member mutation p95            | below 750 ms      |
| Server error rate              | below 1%          |
| Stripe entitlement convergence | within 2 minutes  |
| Critical alert acknowledgement | within 15 minutes |

No application notes, answers, documents, prompts, outputs, employer/role
names, email addresses, payment details or token-bearing URLs may enter
telemetry.

## ER-03 — Staging and controlled delivery

**Priority:** P0

- create isolated London staging with synthetic data and production-equivalent
  role boundaries;
- protect the production branch with validation, E2E and security checks;
- deploy automatically to staging after CI;
- run post-deployment health, authentication and catalogue smoke tests;
- require explicit production promotion;
- add migration preflight and compatibility checks across the previous and new
  application versions;
- document application and forward-migration rollback procedures;
- retain deployment identifiers with incident and audit records;
- add focused automated accessibility and shared-layout visual regression.

Do not run destructive validation against persistent staging or production
databases.

## ER-04 — Recovery and continuity

**Priority:** P0

The closed-beta 24-hour RPO is not the target for paid-member operation.

- enable point-in-time recovery before Gate C;
- target an RPO of one hour or less and an RTO below four hours;
- run restore tests only into isolated, access-restricted projects;
- verify migrations, constraints, RLS, representative owner isolation and
  critical queries after restore;
- ensure restored environments cannot send production email, analytics,
  webhooks or crawler requests;
- retain signed evidence of the recovered timestamp, actual recovery time and
  discrepancies;
- repeat the exercise quarterly and before high-risk migrations.

## ER-05 — Administrator and operational security

**Priority:** P0

- require MFA for every administrator;
- record a role-design decision before replacing the initial single-admin
  bootstrap constraint;
- separate platform administration, content, moderation, crawler operations and
  customer support by least privilege;
- require step-up authentication for role, entitlement and destructive changes;
- add per-administrator and per-IP limits to administrator mutations;
- enforce trusted origin/host controls on privileged requests;
- provide administrator session revocation and quarterly access reviews;
- alert on privilege changes, unusual bulk operations and repeated denied
  actions;
- complete the deferred CMS transport-hardening acceptance tests;
- commission an independent penetration test after payments and roles land.

Support and content roles must not gain private member-record access merely for
convenience.

## ER-06 — Capacity and performance proof

**Priority:** P1

Treat 1,000 registered users as a capacity-validation target, not an
architecture-rewrite trigger.

Create a repeatable load suite with production-sized synthetic data and a
realistic mix of:

- public Jobs and Employers search;
- registration, sign-in and session refresh;
- application, Answer Bank and saved-employer mutations;
- document version reads and bounded reviews;
- Plans and membership-status reads;
- concurrent crawler work on the dedicated worker.

Test approximately 100–300 concurrent sessions before Gate C. Record p50, p95,
p99, throughput, errors, database CPU, locks and connection usage. Use the
hosted pooled database endpoint, calculate the connection budget across all web
instances and workers, and alert before exhaustion. Optimise measured hot paths
before adding caches or infrastructure.

## ER-07 — Privacy, legal and customer operations

**Priority:** P1

- publish privacy, terms, cancellation, refund and contact information;
- implement authenticated account export and deletion request workflows;
- define retention for identities, applications, answers, documents, reviews,
  audit events, crawler payloads, analytics and payment reconciliation;
- document deletion propagation, legal holds and backup expiry;
- maintain a subprocessor register and required data-processing agreements;
- complete a DPIA before production AI or sensitive document processing expands;
- define security/privacy contacts and breach-response responsibilities;
- create support procedures for account recovery, payment reconciliation,
  refunds, moderation and source corrections;
- publish a status surface appropriate to the launch size.

## ER-08 — Crawler production operations

**Priority:** P1

Keep the crawler inside the modular monolith but run it separately from web
compute under process supervision.

- operate one active scheduler with PostgreSQL advisory-lock protection;
- monitor crawl latency, freshness, result volume, rejection rate, status codes,
  browser usage and automatic pauses;
- alert on stale successful crawls, repeated source failure, unexpected empty
  listings and a growing exception queue;
- provide bounded replay for one source/run without weakening activation gates;
- schedule periodic typed source re-verification;
- preserve source configuration and verification evidence through normal
  database backup and restore;
- document worker restart, pause-all, credential rotation and source-incident
  procedures;
- keep unsupported and ambiguous candidates in the administrator exception
  workflow.

Do not introduce a separate crawler service, message broker or distributed
platform until measured throughput or availability demonstrates that the
database-backed worker cannot meet the objectives.

## ER-09 — Library usability and production content

**Priority:** P1

Implement `../product/library-experience-implementation-plan.md` before
unrestricted cohort expansion:

- simplify Library navigation and remove duplicate Answer Bank positioning;
- replace form-first Story, Answer and Intelligence creation with quick capture,
  progressive disclosure, autosave and known-context prefilling;
- connect applications, saved jobs and employers to deterministic preparation
  bundles;
- make existing practice cases usable in a solo mode;
- make every published content item lead to one useful workspace action;
- publish the founder-reviewed editorial minimum or stop promoting unavailable
  destinations;
- keep hosted assistance behind its independent AI production gates.

This workstream is a usability and content-depth gate, not an invitation to add a
course, generic chatbot, generated filler or a mandatory preparation journey.

## ER-10 — Controlled launch and product operations

**Priority:** P1

Recommended cohort sequence:

1. staging with synthetic data;
2. 25-member production pilot;
3. 100-member closed beta with paid membership;
4. 300 members after the first restore test and incident exercise;
5. 1,000+ members after Gate C and two stable weeks.

Review weekly:

- registration and onboarding completion;
- first useful member-owned artefact;
- application and Answer Bank return behaviour;
- document-review usefulness and cost;
- job-source freshness and catalogue exceptions;
- payment failure, support and refund rates;
- moderation and privacy incidents;
- p95 latency, server errors and database connections.

Do not use page views, catalogue size or daily activity alone as evidence of
product value.

## Definition of done

Enterprise readiness is complete only when:

1. Gates A, B and C have recorded evidence and named owners;
2. all repository validation and relevant browser/security tests pass;
3. staging and production configuration have been independently checked;
4. restore, incident, payment and crawler runbooks have been exercised;
5. no high-severity security or dependency finding is waived silently;
6. privacy, retention, support and payment terms are published;
7. service objectives have held through the controlled beta;
8. the free workspace remains usable when payment, hosted AI or crawler
   enrichment is unavailable.

## Handoff rules for implementation tools

- Work in the ER-01 through ER-10 order unless a dependency permits safe
  parallel work.
- Preserve the modular monolith and current privacy/RLS invariants.
- Do not treat this plan as approval for hosted AI, coach access, marketplace
  payments or commercial aggregators.
- Add an ADR before changing role models, recovery objectives, payment
  authority, deployment topology or database connection strategy.
- Update tests and operational evidence with every workstream.
- Do not mark a gate complete from code alone; deployed configuration and
  exercised runbooks are required where specified.
