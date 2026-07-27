# ADR 0017: Bounded Phase 1 services and coaching prototype

**Status:** Accepted  
**Date:** 2026-07-24

## Context

OfferLab needs to make its distinctive preparation value visible before building expensive marketplace, community or AI infrastructure. The approved product strategy prioritises annotated cases, curated questions, moderated recruitment intelligence, manually operated practice/feedback pilots and an evidence-grounded Answer Coach experiment.

## Decision

- Annotated coaching cases remain a governed `preparation_resource` type. They inherit the existing CMS, publication lifecycle, Markdown safety, taxonomy and member access controls.
- Top Questions are curated views over the existing canonical `interview_question` catalogue. No second question taxonomy or content store is introduced.
- Recruitment intelligence is a dedicated module. Candidate submissions are owner-visible while pending, become globally member-visible only after human moderation, and carry a cycle, approximate date and moderation confidence.
- Practice and feedback use curated global offerings and privacy-minimal owner-scoped requests. The database deliberately stores no request free text, payment, matching, chat or provider profile.
- Answer Coach uses a provider-neutral typed interface. The first member-facing implementation is an explicitly labelled deterministic local rubric pilot. It sends no content to a provider and never mutates the source answer. From the 2026-07-25 review-mode pilot, immutable owner-scoped review snapshots and comment state are persisted so members can recover previous reviews; both tables use forced RLS and application queries remain owner scoped.

All new member-owned rows are owner-scoped in repositories and protected by forced PostgreSQL RLS. Audits contain an action, actor and entity identifier with empty metadata.

## Consequences

The workflows are usable and measurable without implying automation that does not exist. Operations require administrator moderation and manual follow-up. A production model provider, payments, automated matching, open community features and a tutor marketplace each require a later product and architecture decision.
