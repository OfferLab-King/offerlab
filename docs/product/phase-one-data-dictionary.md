# Phase 1 preparation services data dictionary

**Date:** 2026-07-24  
**Scope:** Annotated coaching cases, recruitment intelligence, practice/feedback pilots and the Answer Coach prototype.

## Reused governed records

- `preparation_resource` adds the controlled type `coaching_case`. Cases use the existing publication, access, taxonomy, Markdown and editorial controls.
- `interview_question` remains the single canonical question catalogue. Top Questions and focused collections are stable views over its existing editorial position, family and stage associations.
- `member_answer`, linked `member_story` rows and their existing owner scope are the only member source records read by Answer Coach.

## `recruitment_intelligence_report`

| Field                          | Purpose and constraint                                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `owner_user_id`                | Internal owner; visible to that member while pending or rejected.                                         |
| `recruitment_cycle`            | Controlled `YYYY/YY` display cycle.                                                                       |
| `approximate_date`             | Approximate experience date; exact time is not collected.                                                 |
| `recruitment_stage`            | Existing controlled recruitment-stage key.                                                                |
| `opportunity_type`, `industry` | Optional existing controlled taxonomy keys.                                                               |
| `format_summary`               | Short high-level format description, maximum 200 characters.                                              |
| `themes`                       | Themes only, maximum 1,000 characters; UI prohibits exact confidential questions.                         |
| `assessed_skills`              | One to ten short skill labels.                                                                            |
| `reflection`                   | Preparation-oriented reflection, maximum 1,500 characters.                                                |
| moderation fields              | `pending`, `published` or `rejected`, with human moderator, timestamp and confidence for terminal states. |

Published reports are stable-ordered by approximate date and identifier. A moderation decision is always human. Private submission text is never placed in logs, analytics or audit metadata.

## Recruitment Intelligence discussion pilot

- `member_community_agreement` records only the owner, accepted rules version and timestamps. Acceptance is required before contributing, not before reading a report.
- `recruitment_intelligence_comment` belongs to one published report and one owner. Comments are pending until human moderation, support at most one reply level and remain unavailable on public report pages.
- `recruitment_intelligence_comment_flag` lets a different member flag a published comment once using a controlled reason. Administrators resolve flags separately from comment authorship.
- Comment bodies, moderation notes and report content never enter audit metadata, analytics or logs. Audits identify the action and entity with empty metadata.
- Forced RLS and owner-scoped application operations protect pending comments and agreements. Published comment reads remain authenticated member operations; administrator moderation does not create a general member-data bypass.

This is supporting context beneath structured reports, not a general post feed. Direct messages, profiles, followers, reactions, popularity ranking, unrestricted threads and automatic publication are excluded.

## `service_offering` and `service_request`

Offerings are administrator-curated descriptions of manually operated pilots. Availability distinguishes interest collection, open services, scheduled sessions and paused services. A request stores only owner, offering, status, version and timestamps. It contains no member free text, payment details, provider matching, chat or private answer content.

## Group Mock room pilot

- `group_mock_material` stores a fictional OfferLab candidate brief, flexible Markdown case pack, working instructions, required output, facilitator guide and debrief questions. Stable metadata covers ten industries, ten problem archetypes, exercise format, difficulty, capability tags, group size and preparation/discussion/follow-up timing. The deterministic seed contains exactly 100 synthetic cases. Administrator-created originals require confirmation that they contain no copied assessment, leaked question, employer-confidential information or identifying student data.
- Authenticated members can search, filter and open published cases without booking a room. Drafts and archived cases remain administrator-only; saving a published case updates its member view.
- group_mock_session schedules one fixed Europe/London room against a published material pack. Capacity is three to eight and minimum attendance cannot exceed capacity. Access is membership-included or a manually reconciled external payment; no payment record or card data is stored.
- group_mock_booking stores one owner/session seat with 18+ and versioned participation-rule confirmations. A locked database transition assigns confirmed, payment-pending or waitlisted state. Cancellation of an occupied seat promotes the earliest waitlisted member.
- group_mock_session_meeting isolates the provider and HTTPS join URL. RLS exposes it only to administrators or a confirmed member from 15 minutes before the start until the end. Provider account credentials and host passwords are never stored.
- The pilot has no recording, chat, contact exchange, automatic matching, member-created instant rooms or coach access. Exercise and meeting content never enters audit metadata, analytics or logs.

## Answer Coach prototype

- `answer_coach_review` stores an immutable snapshot of the reviewed answer version, prompt/provider identifiers, bounded summary fields and timestamps. It is private, owner scoped and recoverable.
- `answer_coach_comment` stores up to eight validated comments with exact character anchors, one of the five controlled categories (`Evidence`, `Reasoning`, `Relevance`, `Structure`, `Reflection`) and member-controlled `open`, `addressed` or `dismissed` state.
- Review records never update `member_answer`. Running **Review again** creates another review rather than replacing the previous result.
- The local pilot permits five reviews per rolling ten minutes and twenty per calendar month per owner. `ANSWER_COACH_ENABLED=false` is the operational kill switch.

The review is generated only on explicit request and returned as validated structured output. The local prototype derives only generic rubric observations. No model provider receives content. Moving to a production AI provider requires the privacy, provider, evaluation, cost, rate-limit and release controls in `ai-product-strategy.md`.

## Structured annotated coaching cases

`coaching_case_detail` attaches an editorial teaching record to an existing `coaching_case` preparation resource. It stores the canonical or displayed question, anonymised original answer, improved answer, bounded exact-range changes, controlled comment categories, common weaknesses, improvement reasoning and a practice prompt. Change ranges must be ordered, non-overlapping and reproduce the improved answer exactly under application validation.

Cases use the existing content catalogue, access level, publication state, category, tags and saving controls. Members can read only details whose parent resource is published; only administrators can write details. Synthetic examples are the default. Previous-student material requires the `anonymised_approved` source state plus a confirming administrator and timestamp before it satisfies the database constraint. No real previous-student content is seeded.
