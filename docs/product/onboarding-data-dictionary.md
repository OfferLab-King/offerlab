# Onboarding data dictionary

Vertical Slice 01 stores one current `app.onboarding_profile` row per internal OfferLab user. The internal user UUID is both the primary key and ownership key. The profile does not duplicate email, Supabase identity, credentials, sessions, invitations, recruitment stages, or deadlines.

## Fields and controlled values

| Field                  | Required | Shape and limit                                             | Controlled keys                                                                                                                                                                            |
| ---------------------- | -------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Education stage        | Yes      | One value                                                   | `undergraduate`, `postgraduate`, `recent_graduate`                                                                                                                                         |
| Opportunity types      | Yes      | 1–4 unique values                                           | `graduate_scheme`, `internship`, `placement`, `entry_level_role`                                                                                                                           |
| Industries             | Yes      | 1–8 unique values                                           | `consulting`, `accounting_professional_services`, `financial_services`, `technology`, `public_sector`, `consumer_retail`, `general_corporate`, `other`                                     |
| Preparation priorities | Yes      | 1–8 unique values                                           | `application_cv`, `online_tests`, `video_interview`, `behavioural_interview`, `assessment_centre`, `motivation_commercial_awareness`, `professional_communication`, `application_planning` |
| Target companies       | No       | Up to 10 normalized display names, each up to 80 characters | User-entered because a complete company directory is outside this increment; surrounding whitespace is trimmed, internal whitespace collapsed, and case-insensitive duplicates removed     |
| Support needs          | No       | 0–6 unique values                                           | `structured_plan`, `feedback`, `interview_practice`, `assessment_centre_practice`, `accountability`, `international_student_guidance`                                                      |
| Confidence             | No       | One value                                                   | `building`, `mixed`, `confident`                                                                                                                                                           |

The education, opportunity, industry, and priority keys come from the approved founder decisions. The small support-needs and confidence vocabularies are approved for the MVP and remain optional and structured. Support needs deliberately ask only what form of product support would help; they do not request diagnoses, medical details, or disability disclosures. Display labels are not persisted identifiers. International-student context is represented only as an optional support need; preferred learning format remains deferred because this increment requests only target companies, support needs, and confidence as optional fields.

Confidence is collected only as profile context and for future preparation-personalisation research. It does not affect eligibility, recommendation matching, ordering, or prioritisation in this increment. Any later use in recommendations requires a separate reviewed product decision.

## Target-company normalisation

The application normalises each company name to Unicode NFC, trims leading and trailing whitespace, collapses internal whitespace runs to one space, preserves display casing, and removes case-insensitive duplicates. PostgreSQL independently requires stored names to be trimmed, nonblank, no longer than 80 characters, internally space-normalised, case-insensitively unique, free of nulls, no more than 10 entries, and no more than 800 combined characters. PostgreSQL does not provide the Unicode NFC guarantee; that is explicitly the application boundary's responsibility. No fuzzy company matching is performed.

## Completion and state transitions

Completion is derived from a valid education stage and at least one valid opportunity type, industry, and preparation priority. The client cannot submit a completion boolean. A database constraint requires `completed_at` to agree with those required fields.

- **Not started:** no profile row exists.
- **In progress:** a row exists but one or more required fields are absent.
- **Completed:** the first save containing every required field sets `completed_at`, returns `completed`, and records `onboarding.completed` exactly once.
- **Updated after completion:** a later changed, still-complete profile keeps the original `completed_at`, returns `updated`, and records `onboarding.updated`.

Incomplete accepted saves return `saved_incomplete`. Replays with no meaningful change return `unchanged` and do not update timestamps or create audit or analytics events. A completed profile cannot be changed back to incomplete. Successful first completion automatically navigates to `/member`; incomplete saves and ordinary completed-profile updates remain on the onboarding form.

## Concurrent edit semantics

Onboarding uses serialized last-accepted-write wins for this MVP. Each save transaction acquires a deterministic per-owner transaction advisory lock before reading. Requests for one owner therefore execute sequentially, and each transition is classified against the profile committed before it. A later accepted request may replace values written by an earlier request; the system does not claim that lost updates are impossible and does not provide optimistic-lock conflict UX in this increment. Completion cannot revert, only one concurrent first save can return `completed`, and a later meaningful completed-profile change returns `updated`. A partial unique audit index independently prevents more than one `onboarding.completed` event per profile.

## Validation responsibilities

The application validates request size and shape, rejects unknown controlled keys, applies Unicode NFC and company-name canonicalisation, supplies field-level errors, and derives whether required answers are complete. PostgreSQL independently enforces the approved scalar values; controlled-array null, uniqueness, membership, and cardinality rules; target-company canonical storage rules other than NFC; timestamp ordering; consistency between required answers and `completed_at`; and permanent first completion. The profile write and its required audit event commit atomically.

## Ownership, privacy, and telemetry

Every repository read and mutation requires the authenticated internal owner UUID and includes it in the query. The application runs each operation as `offerlab_app` with a transaction-local `app.current_user_id`; forced RLS independently permits only the matching row. Administrator role does not bypass ownership.

Durable audit rows contain only the actor, action, entity type, profile owner UUID, empty metadata, and timestamp. They never contain onboarding answers. Product analytics events are property-free and limited to `onboarding_started`, `onboarding_saved`, `onboarding_completed`, and `onboarding_updated`; no profile value or identifier is permitted.

## Database type boundary

`src/infrastructure/database/generated.types.ts` intentionally represents only schemas exposed through the Supabase Data API (`public` and `graphql_public`). Private `app` tables are not exposed through that API and are therefore intentionally absent. Server-side private schema typing is authoritative in `src/infrastructure/database/schema.ts` through Drizzle, while explicit SQL migrations remain the schema source of truth. Regenerate the public API types with `pnpm db:types`; a source-boundary test prevents private application code from treating the generated public types as authoritative.
