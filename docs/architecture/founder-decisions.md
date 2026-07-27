# Approved founder decisions

**Status:** Approved  
**Date:** 2026-07-19  
**Authority:** These decisions clarify the draft product documents and govern Vertical Slice 01 implementation.

## Product experience

`docs/product/experience-principles.md` is the current authoritative UX decision. OfferLab is a preparation workspace, not a course or wizard. Default to direct, compact interfaces and proportionate contextual guidance. Earlier draft requirements for guided journeys, fixed pathways, central next-action panels, progress displays or completion targets are not active unless a later scoped decision justifies them.

`docs/product/product-strategy-and-roadmap.md` is the current authority for product positioning and priority. The workspace foundation supports, but must not obscure, OfferLab's distinctive annotated coaching cases, current recruitment intelligence, Group Mock practice, curated questions, industry cases and bounded premium feedback. Build manually operated practice or coaching services before speculative marketplace automation.

`docs/product/ai-product-strategy.md` governs permitted AI product use. OfferLab may introduce bounded, evidence-grounded AI early when it passes the defined product, privacy, evaluation and cost gates. AI should express OfferLab's coaching method and member evidence, not reproduce a generic chatbot.

### Recruitment Intelligence discussion pilot

**Approved:** 27 July 2026

Recruitment Intelligence remains a structured, searchable and moderated report database. Add a bounded member discussion layer beneath published reports so members can ask focused questions and add corroborating context. Reports remain the system of record and public SEO surface; comments are supporting, member-only context.

For the pilot, reports and comments require moderation before other members can see them. Allow one reply level, content reporting and administrator removal. Require acceptance of versioned community and confidentiality rules before contributing. Do not add general social posts, direct messages, public member profiles, follower graphs, popularity feeds, unrestricted nested threads or automatic publication. Public pages must not expose member comments. Preserve honest provenance between community reports, coach-curated material and OfferLab-authored guidance.

## Architecture

Use a single Next.js App Router modular monolith with React, strict TypeScript, Node database operations, Supabase PostgreSQL/Auth, internal OfferLab UUIDs, Drizzle, explicit SQL migrations, mandatory RLS, Vercel London compute, Vitest, real PostgreSQL integration tests, and Playwright. Approved AI capabilities remain inside this modular monolith behind a provider-neutral application boundary; they must not bypass domain, privacy, validation, logging or owner-scoping rules.

## Onboarding

Required: education/career stage, target opportunity types, target industries, and preparation priorities.

Optional: target companies, confidence areas, support needs, international-student context, and preferred learning format.

Do not store profile-level recruitment stages or nearest deadlines. Applications are authoritative for recommendations.

## Applications

Required: company, role, opportunity type, and current recruitment stage.

Optional: location, industry, application deadline, next-stage deadline, and notes.

Applications are archive-only in Vertical Slice 01.

## Controlled keys

- Education: `undergraduate`, `postgraduate`, `recent_graduate`.
- Opportunity: `graduate_scheme`, `internship`, `placement`, `entry_level_role`.
- Industry: `consulting`, `accounting_professional_services`, `financial_services`, `technology`, `public_sector`, `consumer_retail`, `general_corporate`, `other`.
- Preparation priority: `application_cv`, `online_tests`, `video_interview`, `behavioural_interview`, `assessment_centre`, `motivation_commercial_awareness`, `professional_communication`, `application_planning`.

Display labels are never identifiers.

## Authentication and member access

Include open member registration, email verification when enabled by Supabase, and password reset. A verified registration creates one internal member identity with active member access. Registration never grants administrator privileges. Stripe remains excluded.

The initial administrator is promoted by explicit command from an existing verified internal user. The command must fail safely, use no user-editable authorization metadata, refuse silent additional administrators, and create a durable audit event.

## Recommendations

Specificity outranks priority. Priority applies only within equal specificity. Order:

1. Stage, deadline window, opportunity type.
2. Stage and deadline window.
3. Stage and opportunity type.
4. Stage.
5. Priority descending.
6. Stable key.

Group by application, deduplicate within an application, permit the same resource across different applications, return at most five per application and ten across the dashboard, exclude inactive rules/resources, and provide deterministic explanations.

Recommendations remain optional and secondary to direct navigation. Their availability does not require a next-action-led page layout.

## Dates

Store timestamps in UTC and application deadlines as dates. Calculate calendar distance in Europe/London. Prefer a next-stage deadline when today or future. Flag a past next-stage deadline as overdue and exclude it from future-window matching; otherwise use the application deadline. With no future deadline, only unwindowed rules match. Test midnight, BST transitions, and overdue cases with a frozen clock.

## Privacy, analytics, and operations

RLS and owner-scoped application queries are both mandatory. Every application repository operation requires owner ID and two-user access tests. Normal admin screens do not expose private notes. Logs exclude notes, secrets, tokens, emails, and sensitive onboarding data. Analytics is typed, allow-listed, provider-neutral, and excludes company/role names, notes, emails, and raw application IDs. Audit is separate.

For closed beta, the accepted database RPO is 24 hours. Use managed daily backups, document restoration, and enable PITR when paid-user volume, change rate, or the business impact of 24-hour loss becomes unacceptable. Do not provision extra backup infrastructure in this foundation. Production web and database services run in London.
