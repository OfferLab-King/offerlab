# Career documents and job discovery data dictionary

**Status:** Implemented pilot

**Date:** 2026-08-07

## Scope and invariants

This domain stores private CV and cover-letter lineages, their immutable extracted-text versions,
bounded review snapshots and member-saved job targets. Job discovery is an optional transient input
to the saved-target workflow; an external provider is never the system of record.

Every persisted record is owned by an authenticated internal OfferLab user. Every repository query
includes that owner ID and every table has forced PostgreSQL RLS. An identifier without the owner
scope is never sufficient to read or mutate a record.

The pilot does not store an uploaded document binary. It does not calculate ATS scores, job-match
or outcome probabilities. The presentation layer may derive the approved document evidence
coverage score from stored represented and missing requirement counts; the score is not stored as
an employer or candidate judgement.

## `app.career_document`

One record is the stable lineage for a CV or cover letter.

| Field                      | Required | Storage and meaning                                                                                                                   |
| -------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                       | Yes      | Database-generated internal UUID.                                                                                                     |
| `owner_user_id`            | Yes      | Authenticated internal OfferLab user UUID; never accepted from client input.                                                          |
| `kind`                     | Yes      | `cv` or `cover_letter`. Separate member tabs filter on this stable key.                                                               |
| `title`                    | Yes      | Member-facing lineage title, trimmed, 1–160 characters.                                                                               |
| `archived_at`              | No       | UTC soft-archive timestamp; `null` means active.                                                                                      |
| `version`                  | Yes      | Positive database-controlled optimistic version for the lineage row, initially `1`. This is distinct from a document revision number. |
| `created_at`, `updated_at` | Yes      | Database-controlled UTC timestamps.                                                                                                   |

There is no mutable content column and no stored `current_version_id`. The one current version is
resolved deterministically as the related immutable version with the greatest `revision`. The
lineage list reports that latest version and the total version count.

## `app.career_document_version`

One record is one immutable document snapshot. The application role may select and insert rows but
cannot update or delete them. Saving an edit locks the owner-scoped lineage, calculates the next
revision and inserts a new row.

| Field               | Required | Storage and meaning                                                                                                                               |
| ------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                | Yes      | Database-generated internal UUID.                                                                                                                 |
| `owner_user_id`     | Yes      | Duplicated owner scope used in composite foreign keys and RLS.                                                                                    |
| `document_id`       | Yes      | Parent lineage UUID under the same owner.                                                                                                         |
| `revision`          | Yes      | Positive, monotonically increasing integer unique within a lineage.                                                                               |
| `label`             | Yes      | Member-facing version label, trimmed, 1–160 characters.                                                                                           |
| `content_text`      | Yes      | Editable normalised extracted or member-edited text, 40–60,000 characters. This is the canonical pilot document content.                          |
| `origin`            | Yes      | `upload`, `editor` or `copy`.                                                                                                                     |
| `source_filename`   | No       | Safe basename of the original upload, at most 255 characters. Present only with the complete source-metadata group.                               |
| `source_mime_type`  | No       | Validated PDF or DOCX MIME type for current uploads. `text/plain` is reserved by the database contract.                                           |
| `source_size_bytes` | No       | Validated original byte count, 1–5,000,000.                                                                                                       |
| `source_sha256`     | No       | Lower-case SHA-256 digest of the upload. It supports provenance and duplicate investigation; it is not a downloadable object reference.           |
| `target_job_id`     | No       | Owner-scoped saved target UUID. When supplied, the application snapshots that target's role, company and description into this immutable version. |
| `target_role`       | No       | Role title snapshot, trimmed, at most 160 characters.                                                                                             |
| `target_company`    | No       | Company snapshot, trimmed, at most 160 characters.                                                                                                |
| `job_description`   | Yes      | Target description snapshot, blank or at most 30,000 characters. A nonblank value requires both target role and target company.                   |
| `created_at`        | Yes      | Database-controlled UTC creation timestamp.                                                                                                       |

A version with `origin=upload` must have all four source-metadata fields; `editor` and `copy`
versions must have none. A nonnull `target_job_id` requires a nonblank snapshotted job description.
The database overwrites supplied creation times for immutable versions and reviews.

A saved target is resolved only when it belongs to the same owner and is active. Snapshot fields do
not change when the saved target later changes, so an old review retains its original target
context.

## Upload and extraction lifecycle

The Node route accepts only a non-empty PDF or DOCX whose extension, declared MIME type and magic
bytes agree. The maximum upload is 5 MB; PDFs are limited to ten pages; normalised extracted text is
limited to 60,000 characters and must contain at least 40 characters. Scans without enough
extractable text fail with guidance to use a text-based document.

Extraction is synchronous. PDF pages are read as text and DOCX content is converted to raw text.
The route computes the source metadata and SHA-256 digest, passes the extracted text into the
owner-scoped application transaction, and then releases the request bytes. No upload bytes, object
storage key or downloadable original is written to PostgreSQL, logs or analytics. Members must
check the extracted-text view because layout, images, tables and some document features may not be
represented.

## `app.career_job_target`

One record is a private role target explicitly saved by a member. A manual target remains available
without any external provider.

| Field                      | Required    | Storage and meaning                                                                                 |
| -------------------------- | ----------- | --------------------------------------------------------------------------------------------------- |
| `id`                       | Yes         | Database-generated internal UUID.                                                                   |
| `owner_user_id`            | Yes         | Authenticated internal OfferLab user UUID.                                                          |
| `provider`                 | Yes         | `manual` or `jsearch`.                                                                              |
| `provider_job_id`          | Conditional | Required for JSearch, absent for manual targets; unique per owner and provider when present.        |
| `source_publisher`         | No          | Provider-reported publisher, 1–160 characters when present.                                         |
| `role_title`               | Yes         | Trimmed display title, 1–160 characters.                                                            |
| `company_name`             | Yes         | Trimmed display company, 1–160 characters.                                                          |
| `location`                 | No          | Trimmed display location, at most 200 characters.                                                   |
| `employment_type`          | No          | Trimmed provider or member label, at most 80 characters.                                            |
| `description`              | Yes         | Job-description snapshot, 1–30,000 characters.                                                      |
| `apply_url`, `source_url`  | No          | HTTP(S) URLs only. Provider credentials in URLs are rejected before a discovery result is accepted. |
| `published_at`             | No          | Provider-reported publication timestamp.                                                            |
| `fetched_at`               | Conditional | Required for JSearch and absent for manual targets.                                                 |
| `archived_at`              | No          | UTC soft-archive timestamp; `null` means active.                                                    |
| `version`                  | Yes         | Positive database-controlled optimistic version, initially `1`.                                     |
| `created_at`, `updated_at` | Yes         | Database-controlled UTC timestamps.                                                                 |

Saving the same provider job again updates and restores the existing owner-scoped target instead of
creating a duplicate. A target is persisted only after an explicit member save; provider search
results are otherwise transient.

## Job discovery request and response

The member supplies a role and location, each 2–120 characters. Optional filters are date posted,
remote-only, employment types, experience/degree requirements, radius and a provider cursor. The
server constructs a UK English JSearch request for one page. The current `/search-v2` endpoint
rejects the earlier `fields` parameter, so OfferLab requests the standard response and applies its
strict allow-list while parsing. The API key is supplied only in the server-side `X-API-Key`
header.

Provider responses are strict-schema validated, limited to ten listings and normalised into typed
fields. Apply links must be safe HTTP(S) URLs without embedded credentials. Search requests use
`no-store`, and the raw provider response is not persisted. When the provider is disabled,
misconfigured, unavailable or not commercially approved for production, the member receives a
generic availability message and can continue with a manual target.

Production JSearch access requires both `JSEARCH_ENABLED=true` and
`JSEARCH_COMMERCIAL_USE_APPROVED=true`, plus a server-only key. The approval flag records an
operational decision after commercial display, retention and automated-use terms have been
reviewed; configuration alone does not create that approval.

## `app.job_search_usage`

One row is a content-free reservation for one outbound JSearch request. The row contains only a
database-generated numeric ID, the authenticated owner UUID, the stable provider key `jsearch` and
the database-controlled creation time. It never stores role, location, filters, results, company
names, links or provider request IDs.

The application cannot insert this table directly. A security-definer database function first
verifies the transaction owner context, takes a short transaction advisory lock, checks the member
rolling-day, member calendar-month and account calendar-month ceilings, and atomically reserves one
request only when every ceiling permits it. Forced RLS lets a member-scoped application transaction
select only its own reservations. Sessions without an owner context see none.

Conservative pilot defaults are 10 requests per member in a rolling 24-hour period, 20 per member
per calendar month and 180 across the provider account per calendar month. The three ceilings are
server configuration, not product promises or assumptions about permanent provider pricing, and
may be lowered or raised after the provider plan and budget are reviewed. Invalid input is rejected
before a reservation; a reserved provider attempt counts even if the upstream call later fails.

## `app.career_document_review`

One record is an immutable review of exactly one immutable document version.

| Field                                         | Required    | Storage and meaning                                                                                                                            |
| --------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                          | Yes         | Database-generated internal UUID.                                                                                                              |
| `owner_user_id`                               | Yes         | Owner scope copied from the reviewed version.                                                                                                  |
| `document_version_id`                         | Yes         | Reviewed version UUID under the same owner.                                                                                                    |
| `provider_id`                                 | Yes         | Bounded adapter/model identifier, 1–80 characters.                                                                                             |
| `provider_mode`                               | Yes         | `local`, `model` or `fallback`. `local` requires `model_requested=false`; `model` and `fallback` require `model_requested=true`.               |
| `model_requested`                             | Yes         | Whether the configured hosted-model path was requested.                                                                                        |
| `provider_notice_version`                     | Conditional | A nonblank 1–80 character version is required for `model`/`fallback`; it must be absent for `local`.                                           |
| `prompt_version`                              | Yes         | Positive prompt-contract version.                                                                                                              |
| `summary`                                     | Yes         | Concise result summary, 1–600 characters.                                                                                                      |
| `strengths`                                   | Yes         | Up to five requirement/evidence pairs; hosted evidence must be an exact excerpt from the selected source.                                      |
| `matched_requirements`                        | Yes         | Up to 20 grounded requirement labels represented in the source.                                                                                |
| `missing_requirements`                        | Yes         | Up to 20 target requirements needing a truthful evidence check. Absence is not evidence of candidate unsuitability.                            |
| `priority_actions`                            | Yes         | JSON array of one to eight observations and suggestions, categorised as Targeting, Evidence, Impact, Clarity, Structure, Voice or Readability. |
| `document_checks`                             | Yes         | Structured length, readability, specificity and targeting observations.                                                                        |
| `suggested_content`                           | No          | Reserved nullable field. V2 provider output must leave it null; complete model-written replacements are rejected.                              |
| `input_tokens`, `output_tokens`, `latency_ms` | No          | Non-negative operational measures; null for deterministic local review.                                                                        |
| `created_at`                                  | Yes         | Database-controlled UTC creation timestamp.                                                                                                    |

## `app.career_document_review_usage`

One row reserves one review attempt after the selected owner, immutable version and complete target
have been validated. It stores only a database-generated numeric ID, owner UUID, whether a hosted
model was requested and a database-controlled timestamp. It never stores document text, target
content, provider output, provider identifiers or record identifiers.

The application cannot insert reservations directly. A security-definer function verifies
`app.current_user_id()`, takes a transaction advisory lock, checks every applicable ceiling and
inserts atomically. Forced RLS permits owner-only selection. Defaults are ten attempts per owner in
a rolling 24-hour period, 40 per owner in a calendar month, and 400 hosted-model attempts across the
account in a calendar month. Local attempts count toward both member ceilings but not the hosted
account ceiling. The three defaults can be overridden with
`CAREER_DOCUMENT_REVIEW_MEMBER_DAILY_LIMIT`,
`CAREER_DOCUMENT_REVIEW_MEMBER_MONTHLY_LIMIT` and
`CAREER_DOCUMENT_REVIEW_HOSTED_ACCOUNT_MONTHLY_LIMIT`.

The reservation transaction commits before inference begins, so an admitted attempt still counts
if the hosted or local provider later fails. No database connection or advisory lock is held during
inference. Hosted review requires explicit acceptance of the current provider notice for each
request. Common email addresses, telephone numbers, LinkedIn URLs and GitHub URLs are redacted from
the selected text before the review adapter runs. Only the selected version's text, target role,
target company and job description enter the adapter.

The response is strict-schema validated. V2 rejects every complete model-written replacement;
specificity, requirement and editing advice remains diagnostic so the member authors each change.
ATS/job-match and interview, hiring or offer-probability claims are rejected at the provider
boundary before the single repair attempt and safe fallback. The model returns meaningful
requirement phrases and exact source evidence, while the presentation layer derives the approved
document evidence coverage score from validated counts. Provider failure uses the deterministic
local rubric and is stored honestly as `fallback`. The local review is a limited text and
requirement check, not an employer, recruiter or ATS simulation.

## Audit, logging and analytics

Meaningful inserts create owner-scoped content-free audit events:

- `career_document.created` and `career_document.version_created`;
- `career_document.review_created`; and
- `career_job.created` or `career_job.updated`.

Audit metadata is always an empty JSON object. Prompt content, model output, extracted document
text, job descriptions, company/role names, contact details, provider keys and record UUIDs are not
permitted in logs or analytics. Operational provider logs may contain only a bounded event name,
provider/model identifier, status, retry number, token counts and latency. Product analytics remains
deny-by-default; this pilot does not make private content an analytics property.
