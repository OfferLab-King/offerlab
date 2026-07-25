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

## `service_offering` and `service_request`

Offerings are administrator-curated descriptions of manually operated pilots. Availability distinguishes interest collection, open services, scheduled sessions and paused services. A request stores only owner, offering, status, version and timestamps. It contains no member free text, payment details, provider matching, chat or private answer content.

## Answer Coach prototype

- `answer_coach_review` stores an immutable snapshot of the reviewed answer version, prompt/provider identifiers, bounded summary fields and timestamps. It is private, owner scoped and recoverable.
- `answer_coach_comment` stores up to eight validated comments with exact character anchors, one of the five controlled categories (`Evidence`, `Reasoning`, `Relevance`, `Structure`, `Reflection`) and member-controlled `open`, `addressed` or `dismissed` state.
- Review records never update `member_answer`. Running **Review again** creates another review rather than replacing the previous result.
- The local pilot permits five reviews per rolling ten minutes and twenty per calendar month per owner. `ANSWER_COACH_ENABLED=false` is the operational kill switch.

The review is generated only on explicit request and returned as validated structured output. The local prototype derives only generic rubric observations. No model provider receives content. Moving to a production AI provider requires the privacy, provider, evaluation, cost, rate-limit and release controls in `ai-product-strategy.md`.
