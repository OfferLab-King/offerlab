# Approved founder decisions

**Status:** Approved  
**Date:** 2026-07-19  
**Last reviewed:** 2026-08-20
**Authority:** Highest product authority. These decisions govern current implementation; references to Vertical Slice 01 describe the original foundation unless a paragraph explicitly limits itself to that slice.

## Product experience

### Finished-product standard; no MVP scope ceiling

**Approved:** 11 August 2026

OfferLab is being built as a finished, production-grade product. Historical
documents labelled MVP, vertical slice, initial journey or screen hypothesis
are research and implementation history only. Their old non-goals, feature
counts and staged-release boundaries must never be used to refuse or remove a
later founder-approved capability. Scope discipline now means keeping the
product coherent, secure, private and operationally supportable; it does not
mean enforcing an MVP ceiling. Production safeguards, source health controls,
member data isolation, accessibility and truthful product claims remain
binding.

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

### Job catalogue as the primary job-discovery experience

**Approved:** 10 August 2026

This decision supersedes the earlier JSearch pilot for the primary discovery
experience and records the rules for the OfferLab job catalogue.

- **JSearch is temporarily disabled.** `JSEARCH_ENABLED=false` is the documented
  deployment posture. The JSearch implementation, migrations and historical
  usage records are retained but the member job-search UI must not present a
  broken search form while disabled; it is replaced by a clear link into the
  OfferLab catalogue. Manual job targets remain available and private.
- **OfferLab's own catalogue is the main job-discovery experience.** Jobs are
  collected from employers' official public career websites and official public
  ATS job-board APIs, in this source-order preference: (1) official public ATS
  job-board API; (2) employer's official structured job feed; (3) employer's
  official careers pages with verified connector and URL configuration;
  (4) manually entered official employer job URL. JSearch may be reconsidered
  later; it is not part of this implementation.
- **Bright Network is a product-structure reference only and is not an
  authorised data source.** Its current terms prohibit copying, storing,
  republishing or commercially using its website information without prior
  written permission. Do not scrape, crawl, bulk-copy or republish Bright
  Network job records; do not use authenticated pages, reverse-engineer private
  APIs, bypass bot protection or access controls, copy its editorial content,
  branding, CSS, layouts, icons, images or page text, or present OfferLab as
  affiliated with it. Do not use Bright Network links as application URLs when
  an official employer application URL exists. The public catalogue may be
  reviewed manually to understand common information architecture only;
  implementation and presentation must be original. Any future use of Bright
  Network data requires a separately gated source with
  `BRIGHT_NETWORK_DATA_USE_APPROVED=true` (default false), an approval record
  naming who approved it, when, its scope, retention restrictions and evidence
  location, and both the approval gate and source-level permission before any
  request.
- **Official public employer sources.** As amended on 12 August 2026, an
  official, unauthenticated public employer careers page or official public ATS
  job-board API does not require a separate manual crawl-permission or terms-review
  gate. Sources retain operational active, paused and archived states, URL and
  connector verification, health reporting and emergency kill switches. Do not
  use LinkedIn, Indeed, Glassdoor, Reed or another commercial job aggregator.
- **Browser-rendered crawling and bot-walled public career sites.** Approved on
  12 August 2026. The targeted crawler may use a real browser engine
  (Playwright/Chromium) to render employer career pages, including public pages
  protected by JavaScript challenges or anti-bot walls that block plain HTTP
  clients. Browser-rendered sources (`needs_browser`) are part of the crawler,
  with bounded concurrency and respectful request pacing. This decision removes
  the earlier non-goals and security restrictions on browser automation, stealth
  scraping, proxy rotation, CAPTCHA handling and bot-protection bypass for
  official public employer career sources; those restrictions are removed from
  the product contract, the targeted-company-crawler design and implementation
  plan, ADR 0022, and the job-catalog operations guide. Sources remain public
  and unauthenticated; Bright Network and other commercial aggregators remain
  subject to their own terms and approval gates.
- **Information architecture.** The catalogue uses two separate classification
  dimensions — sector (broad career family) and subsector (specific professional
  area) — plus an opportunity-type taxonomy that makes the full range of
  early-career opportunities easy to filter (graduate jobs, graduate schemes/programmes,
  internships, industrial placements, work experience, degree apprenticeships,
  training contracts, vacation schemes, immediate-start roles,
  knowledge-transfer partnerships, professionally relevant volunteering,
  entry-level and junior roles, and postgraduate opportunities only when they
  are genuine career opportunities). As amended on 2026-08-11, the public
  catalogue is not limited to early-career work: valid general and
  experienced-hire roles from reviewed employer sources also appear. Career
  level and opportunity type are filters, not publication gates. Employment type remains a separate field.
  Stable machine keys are identifiers; display labels are never identifiers.
  Locations support country, region, city, free-text source location,
  remote/hybrid/on-site and multiple locations; filters are derived from stored
  jobs rather than hard-coded lists.
- **Combined employer and sector directory.** As amended on 11 August 2026,
  Employers is the single public directory for companies, sectors and
  subsectors. Do not maintain a second Sectors navigation destination or a
  competing sector-card index. Employer groups expose their current sector and
  subsector job links directly; legacy `/jobs/sectors/**` URLs permanently
  redirect into the relevant employer-directory section. The Jobs page keeps
  sector filters because those filter job records rather than duplicate the
  directory.
- **Priority UK employer cohort.** Source onboarding prioritises a researched
  UK-relevant employer universe. As amended on 13 August 2026, the employer
  directory and research universe may exceed 500 employers; visibility is
  determined by data quality and product usefulness, not an arbitrary
  numerical ceiling. The number of researched employers, public profiles,
  source candidates, verified sources and active sources can all differ.
  Selection must record a current evidence basis and favour demonstrated UK
  hiring relevance: current graduate/employer research, large UK private and
  listed employers, major public employers, and sector coverage. Directory
  inclusion does not imply endorsement or claim a current vacancy. A company
  appears with “No current roles” until a verified official source produces an
  eligible published job.
- **Eligibility and publication pipeline.** Whole-company feeds must not
  automatically become public. Deterministic rules classify every job as
  eligible, ineligible or needs_review with machine-readable reasons and exact
  source evidence. Only eligible, published, active roles appear publicly.
  Eligibility establishes that a record is a current job listing from a
  verified official source; seniority or absence of graduate wording does not make it
  ineligible. Ambiguous source records remain needs_review and are never
  automatically published. Title-based sector and opportunity classification
  is overridden by contradictory description evidence.
  Administrator overrides of eligibility, classification or publication are
  owner-attributed, timestamped and audited. Classification precedence:
  reliable source-provided taxonomy mapped through an explicit mapping, then
  administrator override, then deterministic title/department/team mapping,
  then optional AI-assisted suggestion, then needs_review. AI must not directly
  publish a job; `JOB_LLM_ENABLED=false` by default; AI output requires
  structured schema validation, exact evidence, administrator confirmation for
  low-confidence classifications and synthetic evaluation before activation.
- **Targeted company sources and UK admission.** As approved on 12 August 2026,
  employer identity is separate from crawl-source identity. One employer may have
  independently scheduled early-career, professional, apprenticeship and general
  sources. Global employers are eligible when they have material UK operations,
  but only UK-confirmed vacancies may publish. Explicit non-UK jobs are suppressed;
  ambiguous locations remain unpublished for administrator review. The registry
  scales with the researched employer universe. Sources run daily through the
  least-privilege CLI worker; CMS may
  request a run but never performs crawler traffic. Optional grounded job
  structuring may use DeepSeek V4 Flash through OpenCode Go behind the existing
  provider-neutral, strict-schema and kill-switch boundaries.
- **Top 1,000 employer research universe.** Approved on 13 August 2026. The
  researched Top 1,000 sponsor-aware employer workbook
  (`data/research/employer-targets/`) becomes an OfferLab employer-intelligence
  and source-discovery foundation: a versioned research artifact feeding a
  database research layer (employer aliases, Home Office sponsor legal
  entities, dated research snapshots, source-discovery candidates) that is
  separate from the live `app.job_source` registry. Importing a researched
  employer never activates crawling; a spreadsheet row must not automatically
  create a guessed active source. Canonical identity matching is
  confidence-gated and ambiguous identities are retained for administrator
  review. Internal priority tiers, employer-value and crawler-readiness
  scores are research signals and must never be exposed publicly as employer
  rankings. The existing versioned cohort manifest remains a bootstrap/core
  source manifest, not the master representation of the employer universe.
  Employer industry and job function are distinct product dimensions to be
  separated in a later non-destructive taxonomy migration
  (`docs/product/taxonomy-redesign-plan.md`).
- **Feature gate.** A master `JOB_CATALOG_ENABLED` gate (default false) keeps
  the catalogue routes, APIs, sitemap entries, crawling and enrichment dormant
  until this feature is explicitly enabled for production. The web runtime
  login must never be able to assume the crawler role.

This is the product-authority record for the implementation described in
ADR 0023.

### Verified job-source automation

**Approved:** 21 August 2026

Reduce crawler administration to exception handling. A high-confidence ATS
candidate may become an active source without a separate promotion,
configuration, resume or run-now action only when OfferLab can deterministically
derive a supported typed connector and a bounded live probe confirms the expected
official public API response shape. The source is created with complete connector
configuration, its machine endpoint, verification evidence and a queued first
crawl. The same path may repair a previously promoted but incomplete source when
it has not been manually overridden or archived.

URL fingerprinting, a successful generic landing-page request, spreadsheet
research or AI output alone are never sufficient to activate crawling. Unknown,
unsupported, weakly fingerprinted, blocked or response-shape-mismatched candidates
remain inactive for administrator review. Administrator URL/configuration
overrides and archived sources are preserved. Automatic crawling retains the
least-privilege worker, official-source restriction, SSRF/robots/request bounds,
UK admission, deterministic publication rules, failure pauses and kill switch.

Resolve deterministic exceptions within ingestion where official structured
evidence is available. In particular, Workday aggregate location labels may be
resolved from bounded public job-detail JSON-LD before publication, with the
official job path used as a conservative UK-location fallback when the detail
budget is exhausted. Clear foreign-country or region evidence with no UK place
signal is sufficient to suppress a vacancy; mixed or same-named-place evidence
remains ambiguous. One malformed vacancy is quarantined and counted rather than
failing an otherwise healthy source run. Human review is reserved for records
that remain genuinely ambiguous after supported deterministic resolution.

### Full licensed-sponsor employer universe

**Approved:** 21 August 2026

Expand the canonical employer identity universe from the curated Top 1,000 to
every unique legal organisation in the dated Home Office Worker and Temporary
Worker sponsor register. Aggregate duplicate branch and route rows under an
exact case-insensitive legal-name identity. Reuse an existing company only from
an exact company name, exact alias or previous sponsor mapping; never collapse
distinct legal entities through fuzzy or legal-suffix matching.

The Top 1,000 remains the curated research, prioritisation and crawler-discovery
overlay. Register presence alone does not establish an official website,
careers URL, open vacancy, job-level sponsorship or permission to crawl. New
sponsor-only identities expose no placeholder link and stay outside the
unfiltered employer directory, but are available to explicit employer search,
the licensed-sponsor filter and member employer selection. Each refresh is a
full dated snapshot: current rows become active, older rows remain historical,
and sources, administrator overrides and member records are preserved.

Official web-presence discovery may cover the full current sponsor universe as
a bounded operations batch. It must use exact legal-name searches, reject
directories, aggregators and social profiles, and retain separate general,
early-careers, apprenticeship and professional-career candidates. Search
results may fill a corporate website only with strong employer-identity
evidence. They remain inactive administrator-only candidates until an official
domain or typed ATS endpoint is verified; search ranking or an HTTP 200 alone
never establishes an official source. Every paid run requires an explicit query
ceiling, reports its maximum provider cost before execution, and is resumable.

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

Include open member registration, email verification when enabled by Supabase, and password reset. A verified registration creates one internal member identity with active member access. Registration never grants administrator privileges and never requires payment. Stripe is permitted only for the bounded, optional membership checkout approved on 20 August 2026 below.

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

## Membership monetisation direction (2026-08-15)

The founder directed the product towards paid membership readiness: visitors
should arrive and be willing to pay, with a clearly labelled offer.

- The free plan keeps every currently approved preparation capability; paid
  membership adds capacity and early access and never hides previously free
  functionality.
- Implemented: `app.membership` entitlements (owner-scoped, forced RLS),
  unified `/plans` pricing and member-management page, with legacy
  `/member/membership` links redirected there,
  administrator membership view, privileged grant CLI
  (`pnpm membership:grant`), and a first real premium benefit: active
  membership doubles the member daily and monthly career-document review
  ceilings (hosted-account safety cap unchanged).
- Prices are founder-set constants in
  `src/modules/membership/domain/membership.ts` (currently £9/month and
  £39/recruitment season).
- Provider-backed activation was subsequently approved on 20 August 2026 under
  the self-serve membership checkout decision below and ADR 0025. Manual and
  local test activation remain supported operational fallbacks, not the normal
  member upgrade journey.

## Self-serve membership checkout (2026-08-20)

Approve Stripe-hosted Checkout and the Stripe-hosted Customer Portal for
self-serve OfferLab membership. Use hosted surfaces so OfferLab does not collect,
render or persist raw card details. This approval is limited to the existing
membership entitlement and the two founder-set GBP offers below; it does not
approve a general commerce platform, marketplace payouts, coach payments,
credits, coupons, trials or usage-based billing.

- **Monthly membership:** £9 including any applicable consumer-facing tax,
  renewing monthly until cancelled. Cancellation takes effect at the end of the
  current paid period; access and benefits remain active until that date.
- **Recruitment-season membership:** £39 including any applicable
  consumer-facing tax for six months from successful payment. It is a one-time,
  non-renewing purchase and expires at the recorded period end.
- **Benefits:** both offers grant the same membership entitlement. The current
  guaranteed paid benefit is double the member daily and monthly career-document
  review ceilings. Early access may be advertised only for a specifically named,
  currently available capability with an honest pilot label and availability
  terms. “Support OfferLab” may be supporting copy, never the principal benefit.
- **Group Mock:** membership does not change waitlist order. The earliest
  waitlisted eligible member remains first to be promoted. Do not advertise
  priority queue placement unless a later founder decision changes the booking
  policy and its fairness implications.
- **Checkout:** authenticated eligible members choose one offer on OfferLab and
  continue to a newly created Stripe-hosted Checkout Session. Price identifiers
  are server-side allow-listed configuration. The browser never supplies an
  amount, currency, entitlement period, Stripe customer identifier or owner ID.
- **Provisioning:** only verified, signature-checked and idempotently processed
  Stripe webhook events may activate, extend, cancel or expire a provider-backed
  entitlement. A success redirect is confirmation of payment flow completion,
  not authority to grant access. The success page may briefly show “Confirming
  membership” while webhook state converges and must offer a safe retry/status
  refresh without creating another purchase.
- **Management:** recurring members use the Stripe-hosted Customer Portal to
  update payment details, view invoices and schedule period-end cancellation.
  Season-pass members can view their OfferLab period and payment receipt but are
  not presented with subscription-management language. OfferLab must show the
  current offer, status, paid-through date and renewal or expiry behaviour in
  plain language.
- **Failure and recovery:** abandoned or failed checkout changes no entitlement.
  Duplicate and out-of-order webhook delivery must be harmless. A monthly
  membership remains active through its paid-through timestamp when renewal
  payment fails; Stripe recovery attempts and verified terminal subscription
  state determine whether it later expires. OfferLab never grants access from a
  query-string result or client assertion.
- **Refunds and support:** publish concise cancellation, refund, contact and
  statutory-rights information before production activation. Refund decisions
  are handled by an authorised operator in Stripe and reconciled by webhook; the
  application must not promise an automatic refund it cannot perform. Refunds do
  not reduce or waive a member's statutory rights.
- **Tax and receipts:** configure Stripe Tax and consumer-facing tax-inclusive GBP
  prices before launch. Stripe supplies receipts/invoices and the billing portal;
  OfferLab stores only the minimum provider identifiers and entitlement state
  needed for reconciliation. Tax registration, filing and accounting ownership
  remain founder/finance operational responsibilities, not application logic.
- **Privacy and operations:** secrets remain server-only. Logs, analytics and
  audit metadata exclude email, payment method, billing address, invoice content
  and private member content. Record only controlled payment lifecycle event
  names and opaque internal/provider identifiers where operationally required.
  Production activation requires live-mode webhook verification, an operator
  runbook, support contact, refund policy, end-to-end test purchase and refund,
  monitoring and a checkout kill switch.

The member-facing flow and technical consequences are specified in ADR 0025.
