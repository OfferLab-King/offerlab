# Application tracking data dictionary

**Status:** Implemented for Vertical Slice 01, Increment 3  
**Date:** 2026-07-20

## Record and fields

`app.application` stores one current tracked application. Duplicate company and role combinations are intentionally permitted.

| Field                      | Required | Storage and meaning                                                                                 |
| -------------------------- | -------- | --------------------------------------------------------------------------------------------------- |
| `id`                       | Yes      | Database-generated internal UUID. It is never accepted as an owner identifier or sent to analytics. |
| `owner_user_id`            | Yes      | Internal OfferLab user UUID. It is derived from the authenticated session, not client input.        |
| `company_name`             | Yes      | Display-cased employer name, maximum 120 characters.                                                |
| `role_title`               | Yes      | Display-cased role title, maximum 160 characters.                                                   |
| `opportunity_type`         | Yes      | One approved opportunity key.                                                                       |
| `industry`                 | No       | One approved onboarding industry key, or `null`.                                                    |
| `current_stage`            | Yes      | One approved recruitment-stage key. Stage changes may skip, repeat, or move backwards.              |
| `location`                 | No       | Display-cased location, maximum 120 characters.                                                     |
| `application_deadline`     | No       | Calendar date with no assumed time.                                                                 |
| `applied_date`             | No       | Calendar date with no ordering constraint against the deadline.                                     |
| `next_stage_deadline`      | No       | Calendar date for the next known recruitment-stage deadline.                                        |
| `notes`                    | No       | Private multiline member text, maximum 2,000 characters.                                            |
| `archived_at`              | No       | UTC timestamp set for a soft-archived record; `null` means active.                                  |
| `version`                  | Yes      | Positive database-controlled integer optimistic concurrency token, initially `1`.                   |
| `created_at`, `updated_at` | Yes      | Database timestamps in UTC.                                                                         |

## Controlled values and labels

Opportunity keys reuse the onboarding vocabulary exactly: `graduate_scheme` (Graduate scheme), `internship` (Internship), `placement` (Placement year), and `entry_level_role` (Entry-level role).

Optional industry keys and labels reuse the onboarding industry vocabulary exactly: `consulting`, `accounting_professional_services`, `financial_services`, `technology`, `public_sector`, `consumer_retail`, `general_corporate`, and `other`. Labels are presentation values and stored keys remain stable identifiers.

Recruitment-stage keys are `preparing` (Preparing), `applied` (Applied), `online_assessment` (Online assessment), `video_interview` (Video interview), `interview` (Interview), `assessment_centre` (Assessment centre), `offer` (Offer), `rejected` (Rejected), and `withdrawn` (Withdrawn). Labels are presentation values and are not persisted identifiers.

## Normalisation and validation

Company, role, and location are normalised to Unicode NFC, trimmed, and have internal whitespace collapsed while retaining display casing. Company and role must remain nonblank; blank optional locations become `null`. Notes preserve line breaks, normalise CRLF/CR to LF, trim surrounding whitespace, and become `null` when blank.

The application boundary rejects unknown fields, malformed dates, unsupported controlled keys, non-positive versions, oversized JSON bodies, and values beyond the limits above. PostgreSQL independently enforces nonblank and canonical whitespace for company and role; canonical whitespace for non-null location; text limits; controlled opportunity and stage keys; positive version; and created, updated, and archive timestamp consistency. Unicode NFC and JSON request-size limits are application guarantees, not database guarantees. No questionable ordering rule is applied between the three dates.

## Archive semantics

Archive is soft and preserves the application and its audit history. The default list contains only records where `archived_at` is `null`; the explicit archived view contains only archived records. Archived records are readable but ordinary fields and stages are read-only until the member restores the record. Restore clears `archived_at`. Archive and restore each increment `version`; replaying the already-current archive state is `unchanged` and does neither. Archive and restore are separate strict operations from ordinary editing.

## Concurrency and mutation outcomes

Updates lock the owner-scoped row, require the submitted `version` to match, and atomically increment it for a meaningful change. A stale version returns `conflict` with generic user guidance to reload; it never overwrites the current record. Database-generated UUIDs prevent concurrent creates from sharing an identifier.

Deterministic outcomes are `created`, `updated`, `stage_changed`, `archived`, `restored`, `unchanged`, and `conflict`. When one ordinary edit changes both ordinary fields and stage, `stage_changed` takes precedence. Archive and restore cannot be combined with ordinary or stage edits and use their own outcomes. Each meaningful mutation produces one audit event and one analytics event, so combined ordinary/stage edits are not double-counted. Unchanged and conflict outcomes do not update timestamps or versions and produce no event. Public conflict responses contain only `ok: true` and `outcome: conflict`.

## Ownership and RLS

Every repository operation requires the authenticated internal owner UUID and includes it in its query. Each transaction assumes the least-privileged `offerlab_app` role and sets transaction-local `app.current_user_id`. Forced RLS independently limits select, insert, and update to matching ownership. `anon`, `authenticated`, and the identity-sync role have no direct application-table access. Administrator status does not bypass ownership. A missing record and another owner's record use the same generic not-found response.

Access additionally requires a verified identity, active beta entitlement, and completed onboarding. The same checks protect page and direct API access. Client-provided owner IDs are rejected as unexpected input and never used.

## Audit, analytics, logging, and privacy

The application mutation and its required audit insert share one database transaction. Meaningful audit actions are `application.created`, `application.updated`, `application.stage_changed`, `application.archived`, and `application.restored`. Audit rows contain only actor UUID, action, entity type, application UUID, timestamp, and empty metadata.

After commit, the corresponding property-free analytics event is captured: `application_created`, `application_updated`, `application_stage_changed`, `application_archived`, or `application_restored`. Failed, unchanged, and conflicted mutations capture none.

Company, role, opportunity type, stage, location, dates, notes, owner/auth UUIDs, application UUIDs, and validation values are prohibited from analytics. Application content is also excluded from audit metadata, structured/error logs, URLs, redirects, and browser page titles. Public errors do not echo submitted payloads or disclose cross-user record existence.

## Future recommendations handoff

The active application record is authoritative future input for deterministic, stage-based preparation recommendations. Increment 3 deliberately creates no recommendation rules, resources, matching logic, or AI dependency. A later increment can consume the public applications-module API without accessing its persistence implementation.
