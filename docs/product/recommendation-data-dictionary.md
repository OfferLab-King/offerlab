# Recommendation data dictionary and deterministic rule-engine contract

**Status:** Vertical Slice 01, Increment 4 implementation contract  
**Date:** 2026-07-20

## Authority and conflict resolution

This increment follows [the approved founder decisions](../architecture/founder-decisions.md), [ADR 0007](../architecture/decisions/0007-recommendation-precedence.md), and [ADR 0008](../architecture/decisions/0008-london-calendar-days.md). Those sources remain authoritative and are not rewritten or superseded by this document.

The Increment 4 brief conflicts with those decisions in the following places. The resolutions are:

- Opportunity type remains an approved recommendation-matching input. It is not part of the Increment 4 excluded-input list.
- The member may receive at most five current recommendations for one application and at most ten across the member home, rather than the lower three/five limits in the Increment 4 brief.
- Deadline selection, past-next-stage-deadline fallback, and calendar-day calculation follow ADR 0008. The brief's default date model applies only where it is compatible with that decision.
- ADR 0007 controls ordering: specificity outranks priority, and priority is considered only among equally specific matches. The brief's suggested urgency-first ordering does not override that accepted precedence. Urgency and relevant date may rank recommendations only after specificity and priority; stable key and, where needed for an aggregate view, stable application UUID are the final tie-breakers.

The remainder of the Increment 4 brief applies where it does not conflict with these authorities.

## Purpose and boundaries

The recommendations module derives a small set of practical next actions from persisted, owner-scoped application state. The evaluation is pure for a given input and clock, contains no generative-AI call, does not scrape or enrich employer data, and does not use probabilistic scoring. Route handlers, server actions, and React components call the recommendations-module application API; they do not contain matching rules or query another module's internal persistence implementation.

Recommendations are optional, concise decision support. They remain secondary to direct workspace navigation, are easy to dismiss or ignore, and do not require every page to be organised around a next recommended action.

The application record is authoritative. Recommendation content is derived on demand from a code-owned catalogue. Only the member's interaction state is persisted.

## Rule inputs

The bounded input contract contains:

| Input                                  | Rule-engine use                                                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Authenticated internal owner UUID      | Scopes the application and interaction-state reads; never changes matching rank.                                   |
| Internal application UUID              | Associates results and persisted state; it is only a final internal cross-application tie-breaker where necessary. |
| Current recruitment stage              | Required exact-match input for every catalogue definition.                                                         |
| Opportunity type                       | Optional specificity input using the four approved stable opportunity keys.                                        |
| Application deadline                   | ADR 0008 fallback date; ordinarily the relevant date while an application is being prepared.                       |
| Applied date                           | Inside the approved Increment 4 input envelope, but catalogue version 1 does not use it for selection or ordering. |
| Next-stage deadline                    | Preferred deadline for today/future post-application work and an overdue signal when it is in the past.            |
| Archive state                          | An archived application is ineligible and produces no current recommendations.                                     |
| Current instant from an injected clock | Produces the Europe/London calendar date used for repeatable urgency calculations.                                 |

Opportunity-type keys are `graduate_scheme`, `internship`, `placement`, and `entry_level_role`. Display labels are never matching identifiers.

Inputs are read from persisted server-side state. The rule engine does not trust a client-supplied stage, opportunity type, deadline, archive status, owner UUID, or recommendation identity.

### Explicitly excluded inputs

The following do not affect recommendation eligibility, specificity, priority, urgency, ordering, wording, or state:

- company name, role title, location, industry, or private notes;
- onboarding answers, target companies, preparation priorities, support needs, confidence, international-student context, or preferred learning format;
- job descriptions, scraped content, employer enrichment, or external employer data;
- analytics history, audit history, browsing behaviour, or prior impressions;
- other members' records or aggregate member behaviour;
- free text, embeddings, AI output, inferred traits, or probabilistic scores.

The surrounding application UI may display approved application fields, but generated recommendation titles, guidance, and explanations never interpolate them.

## Code-owned catalogue

Each active catalogue definition contains:

| Field                 | Contract                                                                                                                                                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `key`                 | Stable, lowercase machine key; 1–80 characters matching `^[a-z][a-z0-9_]{0,79}$`.                                                                                                              |
| `ruleVersion`         | Positive integer identifying the matching semantics for this key.                                                                                                                              |
| `stages`              | One or more explicit approved recruitment-stage keys.                                                                                                                                          |
| `applicability`       | One or more match variants for the same action identity. A variant has an active flag and may constrain approved opportunity types, an inclusive London calendar-day window, both, or neither. |
| `title`               | Short user-facing action title that contains no application value.                                                                                                                             |
| `guidance`            | Brief, practical next step; not legal, immigration, financial, or employment-contract advice.                                                                                                  |
| `explanationTemplate` | Controlled template combined with matched stage, opportunity, and urgency context.                                                                                                             |
| `priority`            | Deterministic integer priority, descending, used only among matches of equal specificity.                                                                                                      |
| `urgencyEligible`     | Whether deadline urgency may change the presentation and explanation.                                                                                                                          |
| `accessibilityLabels` | Programmatic complete, dismiss, and restore labels that remain meaningful without colour.                                                                                                      |
| `active`              | Inactive definitions are ineligible.                                                                                                                                                           |

The catalogue is the source of generated titles, guidance, explanations, and accessibility labels. Database state never becomes a second catalogue. Stable action keys are globally unique in the current catalogue. Multiple applicability variants belong to one action definition and therefore share one output identity; they do not create duplicate recommendations or separate state rows. The evaluator chooses the highest-specificity eligible variant. Version 1 provides a generic fallback for every definition, controlled opportunity-specific variants where listed below, and `0–3`/`4–7` day variants for every urgency-eligible definition. Catalogue validation and unit tests prove that versions are positive, priorities are integers, controlled keys and windows are valid, stage coverage is complete, and user-facing text contains no private placeholders.

### Stable keys and rule versions

A recommendation identity is `(owner UUID, application UUID, stable key, rule version)`. Identity is never derived from title, guidance, explanation text, array position, or priority.

- Editorial wording, spelling, or accessibility improvements that preserve the action and applicability keep the same key and version, so member state is retained.
- A material change to applicability, action meaning, deadline behaviour, or state semantics increments `ruleVersion`.
- A genuinely different action receives a new stable key rather than reusing an unrelated key.
- Retired and previous-version state remains durable history. It is not shown as current and does not control a current version.
- Only a key/version present in the current catalogue and applicable to the application's current stage may be mutated.

### Version 1 catalogue and explicit stage coverage

Every approved stage has direct catalogue coverage; an unknown stage is rejected and never receives a generic fallback.

All initial actions use `ruleVersion: 1`. Within each stage, the three actions have priorities `300`, `200`, and `100` respectively.

| Stage key           | Stable action keys, highest priority first                                                                                     | Version 1 action coverage                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `preparing`         | `preparing_confirm_deadline_plan`, `preparing_tailor_materials`, `preparing_research_role_employer`                            | Confirm the deadline and plan; tailor materials; research the role and employer.                                          |
| `applied`           | `applied_preserve_submission`, `applied_prepare_next_stages`, `applied_check_response_timing`                                  | Preserve submitted materials; prepare for likely next stages; check expected response timing.                             |
| `online_assessment` | `online_assessment_confirm_deadline`, `online_assessment_practise_format`, `online_assessment_check_test_environment`          | Confirm the assessment deadline; practise the relevant format; prepare a reliable test environment.                       |
| `video_interview`   | `video_interview_prepare_examples`, `video_interview_practise_recorded_answers`, `video_interview_check_recording_environment` | Prepare structured examples; practise recorded answers; check camera, audio, and environment.                             |
| `interview`         | `interview_prepare_evidence_examples`, `interview_research_context`, `interview_confirm_format_logistics`                      | Prepare evidence-based examples; research relevant context; confirm format and logistics.                                 |
| `assessment_centre` | `assessment_centre_prepare_exercises`, `assessment_centre_review_context`, `assessment_centre_confirm_schedule`                | Prepare for group and individual exercises; review commercial and organisational context; confirm schedule and logistics. |
| `offer`             | `offer_review_terms_deadline`, `offer_identify_questions`, `offer_compare_priorities`                                          | Review terms and response deadline; identify questions or conditions; compare the offer with personal priorities.         |
| `rejected`          | `rejected_capture_feedback`, `rejected_choose_improvement`, `rejected_review_archive_choice`                                   | Capture useful feedback; choose one concrete improvement; decide whether to archive or retain the history.                |
| `withdrawn`         | `withdrawn_record_reason`, `withdrawn_review_archive_choice`, `withdrawn_retain_materials`                                     | Record a private reason if useful; decide whether to archive; retain reusable preparation material.                       |

Opportunity-specific applicability is deliberately controlled and always retains the same definition's generic fallback:

| Stable action keys                                                                                                                                                                   | More-specific opportunity match              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| `preparing_tailor_materials`, `applied_prepare_next_stages`, `online_assessment_practise_format`, `video_interview_practise_recorded_answers`, `assessment_centre_prepare_exercises` | `graduate_scheme`, `internship`, `placement` |
| `interview_research_context`                                                                                                                                                         | `graduate_scheme`                            |
| `offer_compare_priorities`                                                                                                                                                           | `graduate_scheme`, `placement`               |

All `preparing` through `offer` definitions are urgency-eligible and have both deadline windows. `rejected` and `withdrawn` definitions are unwindowed and not urgency-eligible.

The action text may tell the member to review information they already have, but it does not quote or copy company, role, notes, dates, or other private values.

## London calendar and urgency

Database timestamps are UTC instants. Application deadlines remain date-only values. The evaluator receives one injected clock and derives `today` in `Europe/London`; direct `new Date()` calls are not scattered through rule logic. This makes evaluation stable across London midnight and GMT/BST transitions.

Date selection follows ADR 0008:

1. A next-stage deadline that is today or in the future is the preferred relevant deadline.
2. A past next-stage deadline is flagged overdue and is not allowed to match a future deadline window; the application deadline is then considered as the fallback.
3. If no eligible next-stage deadline is present, the application deadline is considered.
4. A past selected date is overdue and cannot match a future deadline window.
5. With no today/future relevant deadline, only unwindowed rules match.

The urgency signal and the future-window matching date are deliberately separate for ADR 0008's fallback case. When the next-stage deadline is past but the application deadline is today or future, the past next-stage deadline keeps `urgent` status and the overdue explanation; the application deadline is used only to match a future-window applicability variant. If both dates are past, the overdue urgency remains but only an unwindowed variant can match.

Calendar distance is the relevant date minus the London `today` date:

| Distance                                     | Urgency  |
| -------------------------------------------- | -------- |
| Past / overdue                               | `urgent` |
| Today through 3 calendar days                | `urgent` |
| 4 through 7 calendar days                    | `high`   |
| 8 or more calendar days, or no relevant date | `normal` |

All nonterminal stages follow ADR 0008's selection. In ordinary `preparing` data the application deadline is the relevant date; a today/future next-stage deadline, when present, still wins under the accepted ADR. Post-application active stages normally use the next-stage deadline with application-deadline fallback. `rejected` and `withdrawn` actions remain unwindowed unless a later explicit product decision adds a controlled date rule. Urgency changes a label and controlled explanation and can make a deadline-window rule eligible; it never creates a second copy of a recommendation.

## Eligibility, specificity, ordering, and limits

Evaluation proceeds in a fixed order:

1. Return no results for an archived application.
2. Validate the stage and controlled application inputs.
3. Keep only active definitions that explicitly include the stage.
4. Keep only definitions whose optional opportunity-type and deadline-window constraints match.
5. Rank by specificity: stage/deadline/opportunity, stage/deadline, stage/opportunity, then stage.
6. Within equal specificity, rank by `priority` descending.
7. Within equal specificity and priority, rank by urgency (`urgent`, `high`, `normal`), eligible relevant deadline ascending, and stable key ascending.
8. Deduplicate by stable recommendation identity within the application, retaining the highest-ranked eligible match.
9. Overlay owner-scoped persisted state and separate pending, completed, and dismissed results.
10. Apply the accepted caps: at most five current pending recommendations per application and at most ten pending recommendations on the member home.

The same catalogue action may appear for two different applications because identity and member state are application-specific. No query or JavaScript insertion order is a tie-breaker. Aggregate ordering applies the same specificity, priority, urgency, relevant-deadline, and stable-key sequence, with stable application UUID as the final internal cross-application tie-breaker. The application UUID is never displayed as a ranking reason.

Completed and dismissed items are not counted as pending cards. They appear in separate collapsed or secondary sections on application detail so the member can restore them. The member-home cap applies across active applications and preserves the existing application entry point rather than creating an analytics-style dashboard.

## Explainability and presentation

Every displayed recommendation includes a catalogue title, concise guidance, and a deterministic reason. Reasons may state:

- that the application is at a named controlled stage;
- that an applicable deadline is overdue, within three days, or within seven days;
- that an approved opportunity type made a rule more specific.

Explanations do not reveal internal priorities, specificity tiers, database fields, UUIDs, state versions, or implementation terminology. They do not claim that an action guarantees success and do not describe the result as AI-personalised. Accessible urgency text accompanies any visual urgency treatment and never relies on colour alone.

## Persisted interaction state

`app.recommendation_state` stores one member interaction state, not generated recommendation content.

| Field                      | Storage meaning                                                            |
| -------------------------- | -------------------------------------------------------------------------- |
| `id`                       | Database-generated internal recommendation-state UUID and audit entity ID. |
| `owner_user_id`            | Authenticated internal OfferLab owner UUID.                                |
| `application_id`           | Internal owning application UUID.                                          |
| `recommendation_key`       | Stable current-or-historical catalogue key.                                |
| `rule_version`             | Positive catalogue rule version.                                           |
| `state`                    | `pending`, `completed`, or `dismissed`.                                    |
| `version`                  | Positive database-controlled optimistic-concurrency token, initially `1`.  |
| `created_at`, `updated_at` | Database-controlled UTC timestamps.                                        |
| `completed_at`             | Set only while state is `completed`.                                       |
| `dismissed_at`             | Set only while state is `dismissed`.                                       |

There is one unique row per owner/application/key/rule-version identity. The composite application foreign key makes a mismatched application and owner impossible. Absence of a row means pending, which avoids writing generated impressions. Restoring a completed or dismissed row retains that row as explicit pending; requesting pending while no row exists is unchanged and does not create one. Absence and explicit pending have the same visible meaning.

The table never stores recommendation titles, guidance, explanations, priorities, urgency, application company or role, stage, dates, notes, onboarding answers, or generated content.

## State transitions and outcomes

The server, not the client, classifies each outcome.

| Current durable state     | Request pending | Request completed       | Request dismissed       |
| ------------------------- | --------------- | ----------------------- | ----------------------- |
| No row / implicit pending | `unchanged`     | Create row; `completed` | Create row; `dismissed` |
| `pending`                 | `unchanged`     | `completed`             | `dismissed`             |
| `completed`               | `restored`      | `unchanged`             | `dismissed`             |
| `dismissed`               | `restored`      | `completed`             | `unchanged`             |

A first meaningful action creates row version `1`. A later meaningful transition updates the appropriate timestamp, clears the other state timestamp, increments the row version exactly once, and creates the matching audit record in the same transaction. An unchanged request preserves version and all timestamps and produces no audit or analytics event.

Processing precedence is:

1. Apply authentication, verification, entitlement, and onboarding gates.
2. Resolve the application through an owner-scoped query; missing and cross-owner identifiers remain indistinguishable.
3. Reject an unknown key/version as invalid through the generic validation response; the response never echoes the supplied identity.
4. Reject an archived application or a known definition that is inactive or inapplicable to the current stage as `not_applicable` without disclosing which condition failed.
5. For an existing row, require the expected current version before classifying idempotence; a stale expectation returns `conflict` even if the requested target now equals the durable state.
6. Return `unchanged` when the valid request already matches current state.
7. Otherwise commit `completed`, `dismissed`, or `restored` according to the requested target.

Malformed keys, non-positive versions, unknown fields, oversized bodies, and malformed requests are rejected at the application boundary. Public errors and conflict responses are generic and do not disclose recommendation, application, state, version, or member details.

### Stage and rule-version changes

Changing an application stage causes the new stage's recommendations to be recalculated. Prior-stage state remains stored but is not current. Returning to the previous stage restores its state for the same stable key and rule version. A new rule version has a distinct identity and starts pending; it never silently inherits the old version's state.

## Concurrency

For a persisted row, the client submits the last observed positive `version`. The owner-scoped update succeeds only when that expected version still matches. PostgreSQL controls `version` and timestamps: caller-supplied values cannot advance, preserve, or backdate them.

For a first completed or dismissed action, insertion uses the unique owner/application/key/rule-version identity in an atomic transaction. Concurrent first actions can produce only one row: one transaction establishes the durable state and the contender receives a generic conflict. The winner is the transaction PostgreSQL serializes first; the deterministic public postcondition is one row, one committed meaningful outcome, and at most one audit/analytics event. A client must reload before retrying a conflict.

Stale checks occur before unchanged classification. Meaningful transitions increment the database version once; unchanged requests preserve row version and timestamp. The state change and audit insertion commit or roll back together. Analytics is attempted only after a successful commit.

## Archive behaviour

An archived application produces no current recommendation cards and accepts no complete, dismiss, or restore mutation. Archiving does not delete recommendation-state rows. Restoring the application recalculates eligibility from its current persisted stage, opportunity type, dates, catalogue versions, and London clock; matching historical state then applies normally.

## Ownership, access gates, and RLS

Recommendation reads and mutations use the same member gates as applications: authenticated identity, verified email, active beta entitlement, and completed onboarding. Every page and endpoint enforces them server-side, including direct invocation.

Every recommendation-state repository operation accepts the authenticated internal owner UUID and scopes both application and state queries by it. Client-supplied owner identifiers are never accepted. Administrator status provides no cross-member bypass.

`app.recommendation_state` has RLS enabled and forced. The request transaction assumes the least-privileged `offerlab_app` role and sets transaction-local `app.current_user_id`; policies independently require matching ownership. Browser Supabase roles and identity-sync credentials have no direct table access. Transaction-local context must be reset by transaction boundaries and tested across pooled connections.

State UUIDs and application UUIDs are never sufficient query predicates. Cross-owner reads, writes, transitions, owner/application mismatches, and administrator non-owner access fail without revealing whether a target exists.

## Audit, analytics, privacy, and logging

Only meaningful committed transitions create durable audit events:

| Transition                     | Audit action               | Analytics event            |
| ------------------------------ | -------------------------- | -------------------------- |
| Pending/dismissed to completed | `recommendation.completed` | `recommendation_completed` |
| Pending/completed to dismissed | `recommendation.dismissed` | `recommendation_dismissed` |
| Completed/dismissed to pending | `recommendation.restored`  | `recommendation_restored`  |

The audit actor is the internal owner, the entity is the recommendation-state UUID, and metadata is exactly `{}`. Audit insertion shares the state transaction; an audit failure rolls back the mutation. Generated recommendations, page views, impressions, unchanged requests, conflicts, validation failures, and inapplicable transitions produce no recommendation audit event.

Analytics uses the existing typed provider-neutral abstraction, has no event properties, and runs only after commit. It does not expose a public client analytics endpoint. Audit and product analytics remain separate concepts and stores.

Recommendation payloads must not enter structured request logs or error logs. In particular, logs, audit metadata, analytics properties, query strings, redirect parameters, browser page titles, and public exceptions exclude recommendation keys, versions, state, urgency, explanations, application IDs, company/role names, dates, notes, owner identifiers, emails, and onboarding values. The existing opaque application-detail locator is always owner-authorized; generated text and interaction-state identifiers are never added to it. Generic conflicts direct the member to reload without exposing current state or version.

## Database and application guarantees

PostgreSQL independently guarantees:

- an approved interaction state and positive rule and row versions;
- the bounded stable-key storage shape, but not catalogue membership;
- unique owner/application/key/rule-version identity;
- owner/application correspondence through a composite foreign key;
- immutable identity fields and database-controlled versions and timestamps;
- timestamp consistency for pending, completed, and dismissed states;
- forced owner RLS, least-privilege grants, and ownership-safe audit insertion.

The application and code catalogue guarantee:

- catalogue membership, current rule version, active status, and current-stage applicability;
- complete explicit stage coverage and rejection of unsupported stages;
- allowed inputs, London date selection, urgency, specificity, priority, deduplication, and limits;
- generated wording, explainability, accessibility labels, and absence of private interpolation;
- access-gate orchestration, strict request shape/size validation, and generic public outcomes;
- post-commit property-free analytics.

PostgreSQL deliberately does not enumerate the complete code catalogue or decide whether a key applies to a current stage. Application-only catalogue validation must not be described as a database guarantee.

## Future replacement or complementary systems

A later enriched or AI-assisted recommender may be introduced only behind the recommendations module's public contract and after an explicit product, privacy, security, and architecture decision. It must not weaken owner scoping, forced RLS, controlled inputs, stable/versioned identities, interaction-state semantics, deterministic caps, explainability, accessible presentation, generic conflicts, or audit/analytics/logging boundaries.

The main journey must retain a deterministic controlled-data path. Any complementary system must provide a safe fallback, must not cause private application content to enter prompts or third-party systems without a separately approved data contract, and must return outputs that can be validated and capped before display. New provenance or generated-content persistence would require its own reviewed schema and retention decision; it is not implied by this interaction-state table.
