# ADR 0020: Private career-document versions and gated job discovery

**Status:** Accepted

**Date:** 2026-08-07

## Context

Applicants commonly keep one reusable CV or cover letter and tailor it for each role. Overwriting a
single file loses useful history, while a generic rewrite can invent evidence or hide why a change
was made. OfferLab needs a direct workflow in which the member can upload an existing document,
connect one version to one job description, inspect feedback and decide what to save.

Job discovery can reduce copying between sites, but it is not OfferLab's system of record or core
differentiation. A provider credential, response or commercial permission must not become a browser
dependency. Uploaded documents and job descriptions are private member content and may contain
personal data.

The existing modular monolith, owner-scoped repository, forced-RLS and provider-neutral AI patterns
can support this workflow without object storage, a document service, a queue or a separate search
deployment.

## Decision

### Career-document records

- Add a Career documents module for private `cv` and `cover_letter` lineages, immutable versions,
  saved job targets and immutable reviews. CV and Cover letters are separate member tabs over the
  same typed module.
- Each lineage can have many immutable versions. Saving creates the next positive revision under an
  owner-scoped lock. The one current version is derived as the highest revision; do not add a
  mutable current-content row or overwrite a previous version.
- Snapshot target role, company and job description on each version. A version may reference an
  owner-scoped saved target, but later target changes do not rewrite historical versions.
- Require owner IDs in every repository operation, composite owner foreign keys where records
  relate, forced PostgreSQL RLS and two-user access tests. Versions and reviews are insert/select
  only for the application role.

### Upload processing

- Accept validated PDF and DOCX files through a Node route and extract text synchronously within a
  5 MB upload ceiling, a ten-page PDF ceiling and a 60,000-character text ceiling.
- Validate extension, MIME type and magic bytes together. Reject scans or files without enough
  extractable text rather than silently creating an empty document.
- Discard original upload bytes after extraction. Persist only normalised editable text, safe
  filename, validated MIME type, byte count and SHA-256 digest. Do not provision object storage,
  background conversion or an original-file download path for this pilot.

### Bounded document review

- Review exactly one immutable version against its snapshot role, company and job description
  through the Career documents application's provider-neutral review boundary.
- Keep a deterministic local rubric as the provider-independent path and fallback. An optional
  DeepSeek adapter uses strict JSON, a hard output ceiling, one repair attempt and safe fallback.
- Require explicit acceptance of the current provider notice for every hosted-model request. Remove
  common contact details before the review boundary, send no binary or unrelated member records and
  persist only the immutable structured review plus non-content provider telemetry.
- Atomically reserve each validated review attempt in a separate content-free table. Enforce
  configurable rolling-day and calendar-month member ceilings plus a hosted-model account ceiling;
  local attempts count only toward member ceilings. Commit the reservation before inference so a
  failed attempt remains counted and no database transaction spans the provider call.
- Keep the review diagnostic-only: return prioritised actions and requirement checks, but reject a
  full model-written replacement. Length and numeric checks alone cannot prove non-numeric claims
  came from the member. A later comparison feature requires a source-anchored edit contract and a
  separate evaluated release decision.
- Do not produce ATS scores, job-match probabilities, candidate rankings, suitability decisions or
  interview/hiring probabilities. ADR 0021 permits a transparent document evidence coverage score
  derived from validated represented and missing requirement counts; it is not a model output or
  outcome estimate. Production hosted review remains disabled until the model-data approval flag
  records completion of the AI privacy gate.

### Job discovery

- Add a Job discovery module with a provider-neutral search contract and a JSearch adapter. Browser
  code sends an explicit role, location and bounded filters to an owner-authorised same-origin
  route; only the server sends the provider request and `X-API-Key` header.
- Request one UK English page, use `no-store`, validate and allow-list the standard response fields,
  and accept only safe HTTP(S) apply links. The current `/search-v2` endpoint rejects the earlier
  `fields` request parameter. Do not persist raw search responses.
- Persist a provider listing only after an explicit member save into an owner-scoped
  `career_job_target`. Keep manual targets available independently of JSearch.
- Atomically reserve each outbound provider request in a content-free usage table before calling
  JSearch. Enforce configurable rolling member, monthly member and monthly account ceilings; never
  store search terms or results in the usage record.
- Require a production-specific commercial-use approval flag in addition to the feature flag and
  server-only key. The approval flag may be set only after the intended display, retention and
  automated-use terms have been reviewed. Provider absence or failure degrades to manual entry.

All work remains inside the existing Next.js modular monolith. Route handlers perform transport and
access checks, application use cases coordinate work, domain schemas validate records, and
infrastructure adapters own PDF/DOCX parsing, providers and persistence.

## Consequences

- Members can preserve a reusable base and compare role-specific revisions without silent edits or
  lost history.
- A review remains inspectable and tied to the exact source and target that produced it. Local
  review keeps the workflow usable when hosted AI is unavailable or unapproved.
- OfferLab minimises upload retention and avoids new storage infrastructure, but it cannot reproduce
  or download the original layout. Members must retain their source file and verify extracted text.
- Synchronous extraction is simple and bounded for ordinary CVs and letters. OCR, large files,
  complex layout preservation, binary retention and background conversion require a later product,
  privacy and architecture decision.
- External job discovery can be disabled without breaking saved/manual targets or career-document
  editing. Search breadth, freshness and apply-link availability remain provider limitations, not
  OfferLab guarantees.
- JSearch production availability is an explicit commercial and operational decision; merging the
  adapter or configuring a key does not imply approval.
- Search cost has database-enforced member and account ceilings that work across application
  instances. The defaults are pilot controls and must be reviewed when the provider plan changes.
- Document-review cost has the same database-enforced concurrency protection: ten rolling-day and
  40 monthly member attempts by default, plus 400 monthly hosted-model attempts across the account.
- The new member-owned tables add migration, forced-RLS, horizontal-isolation and immutable-history
  test obligations, but no microservice, queue, cache or separate deployment.
