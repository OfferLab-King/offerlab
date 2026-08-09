# OfferLab current product contract

**Status:** Active implementation contract
**Owner:** Founder / Product
**Last reviewed:** 2026-08-09
**Authority:** This document consolidates already approved direction. It does not approve new commercial, access-control or marketplace scope. `../architecture/founder-decisions.md` remains the highest product authority.

## Current goal

OfferLab is a responsive preparation workspace for UK graduate applicants. It helps members organise applications and genuine experience, tailor truthful CVs and cover letters to a chosen role, learn from concise and inspectable examples, practise difficult recruitment activities, and use moderated recruitment intelligence. It is not a course, wizard, generic chatbot, open social network or tutor marketplace.

The product should make OfferLab's judgement visible through annotated coaching cases, curated questions, structured intelligence and bounded feedback while keeping saved jobs, applications, CVs, cover letters, the Answer and Story Bank, resources and preparation plans directly accessible.

## Current capability boundary

The current implementation contract covers:

- open registration, verification, password recovery and member onboarding;
- member-owned applications and deadlines;
- the question-first Answer Bank, including fourteen curated starting questions, simple
  member-authored answers and optional supporting evidence stories;
- separate member-owned CV and cover-letter workspaces with multiple immutable text versions, a
  deterministic current version, optional per-version job targets, bounded requirement-by-
  requirement review and a transparent document evidence-coverage measure;
- synchronous PDF and DOCX text extraction with immediate binary disposal and no original-file
  retention;
- private manual job targets and optional explicit role-and-location discovery through a gated,
  server-only JSearch adapter;
- content-free, database-enforced member and account request ceilings for outbound job search;
- preparation resources, taxonomy, learning paths and deterministic recommendations;
- contextual evidence-building projects and curated, commercially disclosed external learning
  options for genuine document-review gaps;
- administrator-managed content whose saved published version is the canonical member/public version;
- structured annotated coaching cases with anchored comments and visible revisions;
- structured, cycle-dated Recruitment Intelligence reports, public SEO previews, moderated member submissions and a bounded member-only discussion layer;
- a searchable library of 100 original fictional Group Mock cases, plus scheduled 18+ rooms with owner-scoped seats, deterministic waitlists and protected external meeting links;
- the bounded Answer Coach review mode, with explicit review, immutable recoverable reviews, no automatic source edits, a provider-neutral boundary and deterministic local fallback.

This list describes approved capability, not a requirement to give every capability equal visual weight or to expand every pilot.

## Now, next and not yet approved

### Now

- Improve the quality, consistency and discoverability of the approved capabilities.
- Validate whether members return to create a truthful job-specific CV or cover-letter version and
  whether the bounded review leads to useful member-owned edits.
- Validate annotated cases, curated questions, structured intelligence, Group Mock and bounded feedback with real use.
- Keep public proof honest and useful while protecting member-owned and moderated content.
- Operate services manually where demand and delivery quality remain uncertain.

### Next, after an explicit decision

- Human coach operations require a product and architecture decision covering the coach role, vetting, assignment, member consent, least-privilege record access, audit, retention and deletion.
- In-product payments require a separate decision covering provider, pricing records, refunds, tax/accounting boundaries, entitlements and operational ownership. Stripe is not currently approved.
- A production AI provider requires the privacy, evaluation, model, cost and kill-switch gates in `ai-product-strategy.md`.
- JSearch production use requires recorded approval of the provider's commercial display,
  retention and automated-use terms. Until then, manual job targets remain the production-safe
  path.

### Not approved

- a generic chatbot or ungrounded answer generator;
- ATS scores, job-match probabilities or predictions of interview, hiring or suitability outcomes;
  the founder-approved document evidence coverage score is permitted only with its visible
  numerator, denominator and non-predictive limitation;
- silent AI or coach edits to member source records; a grounded suggested revision is permitted
  only as a comparison that the member explicitly copies and then saves;
- an open tutor marketplace, automatic tutor/peer matching or unrestricted member-created rooms;
- general social posts, direct messages, public member profiles, follower graphs, popularity feeds or unrestricted nested discussions;
- automatic publication or AI-only moderation enforcement;
- exposing member comments on public Recruitment Intelligence pages;
- confidential employer documents, exact restricted questions, personal data or copyrighted assessment material;
- using member or previous-student content for model training;
- granting coaches broad administrator access as a shortcut for a proper reviewer role;
- production payment infrastructure without the explicit decision above.

## Content and provenance

Markdown is appropriate for governed documents and safe long-form resource bodies. It is not the canonical representation for structured product records. Applications, stories, answers, coaching-case annotations, reviews, intelligence reports, comments, moderation state and service requests must retain typed domain records and validation.

Every published artefact must preserve honest provenance. Distinguish clearly between synthetic teaching material, anonymised and authorised previous-student material, community submissions, coach-curated material, OfferLab-authored guidance, deterministic local feedback and provider-generated AI feedback.

Seeds and test fixtures remain deterministic and synthetic. Previous-student material must never be copied into seeds or source control merely to populate the product.

## Privacy and access restrictions

- Member-owned records require authenticated owner-scoped application queries and forced PostgreSQL RLS.
- CVs, cover letters, their versions, reviews and saved job targets are private member-owned
  records under the same owner-scope and forced-RLS requirements.
- Uploaded PDF and DOCX bytes are processed only for synchronous extraction and then discarded.
  Safe filename, MIME type, byte count and SHA-256 digest may be retained with the extracted text;
  they are not analytics properties.
- Administrator access must be purpose-limited; ordinary administrator screens do not expose private application notes.
- A coach panel must not be implemented by weakening owner scope or making every coach an administrator.
- Logs and analytics must exclude source answers, CV or cover-letter text, job descriptions,
  application notes, prompts, outputs, emails, employer/role names and raw record identifiers where
  prohibited by the governing privacy contracts.
- Public content reads must enforce publication and access state. Public Intelligence pages may expose moderated report content but not member comments.
- Moderation, audit and product analytics remain separate concepts and stores.

## Document status model

- **Active implementation contract:** binding for current work within its stated authority.
- **Approved strategy or decision:** binding according to the precedence in `AGENTS.md`.
- **Data dictionary or accepted ADR:** binding for its implemented domain unless superseded by a higher authority.
- **Implemented historical baseline:** useful evidence about an earlier delivery, but not the current scope boundary.
- **Historical hypothesis or capability inventory:** non-binding context that must not create requirements by itself.

When documents conflict, use the precedence in `AGENTS.md`. Do not use an older document's word “MVP,” “required” or “source of truth” to override a later approved decision.

## Decisions still intentionally open

1. Whether bounded paid feedback remains founder-operated or introduces separate vetted coach accounts.
2. Whether payments remain external/manual during validation or become an in-product capability.
3. Whether DeepSeek passes the documented privacy and international-transfer gates for production
   member content. Answer Coach and career-document adapters are approved only for local
   development and synthetic evaluation until that review is complete.
4. Whether the JSearch commercial display, retention and automated-use terms permit the intended
   production job-discovery experience. Production provider access remains off until explicit
   approval is recorded.

Until those decisions are recorded, implementation must preserve the existing manual, local-fallback and least-privilege boundaries.
