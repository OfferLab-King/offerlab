# Approved founder decisions

**Status:** Approved  
**Date:** 2026-07-19  
**Last reviewed:** 2026-08-09
**Authority:** Highest product authority. These decisions govern current implementation; references to Vertical Slice 01 describe the original foundation unless a paragraph explicitly limits itself to that slice.

## Product experience

`docs/product/experience-principles.md` is the current authoritative UX decision. OfferLab is a preparation workspace, not a course or wizard. Default to direct, compact interfaces and proportionate contextual guidance. Earlier draft requirements for guided journeys, fixed pathways, central next-action panels, progress displays or completion targets are not active unless a later scoped decision justifies them.

`docs/product/product-strategy-and-roadmap.md` is the current authority for product positioning and priority. The workspace foundation supports, but must not obscure, OfferLab's distinctive annotated coaching cases, current recruitment intelligence, Group Mock practice, curated questions, industry cases and bounded premium feedback. Build manually operated practice or coaching services before speculative marketplace automation.

`docs/product/ai-product-strategy.md` governs permitted AI product use. OfferLab may introduce bounded, evidence-grounded AI early when it passes the defined product, privacy, evaluation and cost gates. AI should express OfferLab's coaching method and member evidence, not reproduce a generic chatbot.

### DeepSeek Answer Coach pilot

**Approved:** 6 August 2026

Add DeepSeek as the first hosted-model adapter for the bounded Answer Coach. A member must explicitly accept the current provider data notice before each model review request. Send only the selected answer, its question and key points, and no more than three member-linked evidence stories. The model diagnoses and asks coaching questions. Under the later Question-first Answer Bank decision below it may also return one fact-grounded suggested revision for explicit member acceptance; it must never silently edit source records or add an open-ended chatbot.

Keep the provider-neutral boundary, exact source anchoring, strict structured-output validation, one bounded repair attempt for malformed output, deterministic local-rubric fallback, immutable previous reviews, rate limits, monthly caps and the operational kill switch. Persist only non-content operational metadata such as provider identifier, token counts and latency; never log prompts, outputs or member evidence.

This approval permits local development and synthetic evaluation. Production use with real member content remains blocked until the provider's business/API terms, retention, training use, deletion, subprocessor, security and international-transfer position have completed the privacy gate. Production configuration must require an explicit operational approval flag.

### Question-first Answer Bank

**Approved:** 6 August 2026

Replace the primary multi-tab Answer and Story Bank journey with one question-first workspace. Present, in order, a personal introduction, the three motivation questions (“why this organisation”, “why this role” and “why you”), then ten stable competency questions. Each question expands directly into one plain answer field. Show Prepared, Draft or Not started beside the question so the page also serves as the member's stored answer bank.

Do not require a separate evidence story, application, recruitment stage, key-points field or answer title before a member can prepare an answer. Retain existing typed records and owner scope underneath the simpler interface; evidence stories remain optional supporting records rather than the navigation model.

Make Answer Coach visible inside the question editor. A member may explicitly save a draft and request review in one action. AI may return a complete suggested revision only when every fact is grounded in the member's answer, key points or selected stories. Display original and suggestion side by side. Copying either a whole suggestion or a small wording change into the draft requires a clear member action and does not save or mark the answer prepared. The member must check accuracy and save explicitly.

Coach by question type: natural present–past–future structure for introductions, credible specificity for motivation, and STAR with first-person action and reasoning for competency answers. Flag generic or machine-like language, inflated claims, unnatural polish, and answers that are materially too short, too long or difficult to say aloud. Do not show the model brand as product positioning; keep provider identity in the required data notice.

### Career documents and job discovery pilot

**Approved:** 7 August 2026

Add separate CV and Cover letters tabs to the member workspace. A member may keep multiple documents of each kind and multiple immutable versions of each document. OfferLab presents one current version, resolved deterministically as the highest immutable revision; saving an edit creates the next revision and never overwrites an earlier one. A version may be targeted to one owner-scoped saved job or to a member-entered role, company and job description. The member remains responsible for checking extracted text and every final document.

Accept PDF and DOCX uploads for synchronous server-side extraction within documented size and page limits. Discard the original upload bytes immediately after extraction. Persist only the editable extracted text and privacy-minimal source metadata: the safe filename, MIME type, byte count and SHA-256 digest. Do not introduce object storage, background processing or binary-document retention for this pilot.

Offer a bounded CV or cover-letter review against the selected version and target. The output may identify grounded strengths, represented and missing requirements, document checks, prioritised actions and one comparison draft when every candidate claim is grounded in the member's source. The review must never silently update a document, invent evidence or metrics, produce an ATS score, predict interview or hiring probability, or present itself as an employer decision. Hosted-model review requires explicit acceptance of the current provider notice for each request, strict structured-output validation, usage caps, immutable review records, non-content operational telemetry and a deterministic local-review fallback. Production use with real member content remains disabled until the applicable provider privacy and data-processing gate is explicitly approved.

Add a server-side JSearch adapter for explicit role-and-location searches. The provider API key remains server-only and must never be returned to browser code, logs or analytics. Treat provider listings as transient discovery results; persist a listing only when the member explicitly saves it as a private job target. Reserve each outbound call in a content-free usage record and enforce configurable member and account ceilings atomically. JSearch production access remains disabled unless an explicit operational flag records approval of the commercial display, retention and automated-use terms. Manual job targets remain available when the provider is absent, disabled or unavailable.

### Career-document evidence coverage and development guidance

**Approved:** 9 August 2026

Replace shallow keyword lists with an inspectable requirement-by-requirement review. Requirements must be meaningful job-description phrases or named skills, never filler words. For every represented requirement, show the exact member evidence; for every gap, explain what truthful evidence would demonstrate it and, where useful, suggest a bounded project or learning option. A CV must not be told to add the target company merely to appear tailored. Company naming remains relevant to a cover letter, while CV targeting is assessed through the relevance and prominence of evidence.

Permit one transparent **document evidence coverage score** from 0 to 100, calculated only as evidenced assessed requirements divided by all assessed requirements. Always show the numerator and denominator and label the measure as document coverage, not candidate quality. It is not an ATS score, job-match probability, candidate ranking, suitability decision or estimate of an interview, hiring or offer outcome. Do not weight protected characteristics, institution prestige, writing dialect or inferred personality.

Connect genuine evidence gaps to small OfferLab evidence-building projects and a bounded curated list of external learning options. Course completion alone is not evidence of competence; guidance should help a member create an inspectable output they can explain truthfully. External options must identify the provider, open outside OfferLab and state the current commercial relationship. Affiliate links may be introduced only after an actual agreement and must be clearly disclosed without changing recommendation order or implying that purchase improves recruitment outcomes.

### Recruitment Intelligence discussion pilot

**Approved:** 27 July 2026

Recruitment Intelligence remains a structured, searchable and moderated report database. Add a bounded member discussion layer beneath published reports so members can ask focused questions and add corroborating context. Reports remain the system of record and public SEO surface; comments are supporting, member-only context.

For the pilot, reports and comments require moderation before other members can see them. Allow one reply level, content reporting and administrator removal. Require acceptance of versioned community and confidentiality rules before contributing. Do not add general social posts, direct messages, public member profiles, follower graphs, popularity feeds, unrestricted nested threads or automatic publication. Public pages must not expose member comments. Preserve honest provenance between community reports, coach-curated material and OfferLab-authored guidance.

### Group Mock room pilot

**Approved:** 27 July 2026

Validate Group Mock as scheduled, fixed-duration OfferLab rooms for verified members aged 18 or over. Administrators create original OfferLab exercise packs, publish sessions and control capacity. Members reserve one owner-scoped seat or join a deterministic waitlist; they do not create instant rooms, receive shared provider credentials or match automatically. A cancellation may promote the earliest waitlisted member.

The pilot may use manually created external meeting links and external payment links. Meeting access is limited to confirmed participants in a short join window. External payment is reconciled manually and does not create an in-product payment, refund or entitlement system. Do not record sessions. Do not add participant messaging, public profiles, contact exchange, coach accounts or a tutor marketplace. A separate decision remains required for embedded video, recording, in-product payments and coach access to member records.

Exercise packs must be original OfferLab simulations. Do not reproduce leaked questions, copied assessment material, employer-confidential documents or identifying student information.

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
