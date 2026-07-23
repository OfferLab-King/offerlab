# OfferLab AI product strategy

**Status:** Approved product direction

**Date:** 2026-07-23

**Authority:** Governs product uses of generative AI, model selection, prompt design, privacy, evaluation and cost control. Read with `product-strategy-and-roadmap.md` and `experience-principles.md`.

## Decision

OfferLab may use generative AI where it gives a member useful, personalised interpretation or feedback faster than a static tool can. AI is an enhancement to the preparation workspace, not a prohibition and not the product's organising idea.

The core records, curated content, navigation and rule-based recommendations must remain usable when an AI provider is unavailable. This is a reliability and cost boundary, not a reason to postpone every valuable AI feature.

OfferLab must not compete as a generic chatbot. Its advantage comes from combining:

- the member's own evidence and chosen target;
- founder-authored coaching rubrics and annotated examples;
- controlled recruitment taxonomies and curated questions;
- a narrow task with an inspectable result; and
- a workflow in which the member reviews, edits and owns the final work.

The desired result is not text disguised as human-written. It is truthful work that sounds specific to the member because it is grounded in their evidence, preserves their voice and avoids generic AI phrasing. The interface should identify AI assistance plainly where that context matters.

## Best early uses

Prioritise tasks where the input and success criteria are bounded.

1. **Answer Coach:** review a selected answer against its question, linked stories and an OfferLab rubric. Identify missing evidence, unclear reasoning, generic claims and likely follow-up questions. Suggest focused revisions without inventing content.
2. **Story Coach:** identify gaps in Situation, Task, Actions, Reasoning, Result and Reflection. Ask for missing specifics rather than supplying achievements or numbers.
3. **Rewrite a selection:** offer two or three concise alternatives for a member-selected passage while preserving facts, meaning and the member's chosen tone.
4. **Practice variations:** generate safe variations and follow-up prompts from a curated canonical question, without claiming that generated questions were reported by an employer.
5. **Editorial assistance:** help authorised editors propose tags, summaries, rubric checks or practice variants for cases and resources. A human approves publication.
6. **Moderation assistance:** flag possible personal data, confidential material or unsupported employer claims in submitted recruitment intelligence. A human makes the moderation decision.

The Answer Coach is the preferred first member-facing experiment because the Story Bank supplies grounded evidence and the result can be evaluated against a clear coaching rubric.

## Uses that are excluded or require a later decision

- No generic open-ended career chatbot as a primary experience.
- No complete interview answer generated from an empty prompt.
- No invented experience, achievement, employer fact, quotation, metric or recruitment intelligence.
- No automated prediction of hiring probability, candidate ranking or suitability decision.
- No AI-derived authentication, authorisation, entitlement or moderation enforcement.
- No autonomous publication of member submissions or editorial content.
- No replacement of deterministic recommendation rules where controlled logic already solves the task.
- No model training or fine-tuning on member content by default.
- No audio, video, emotion or biometric analysis without a separate product, equality, privacy, safeguarding and architecture decision.

## Interaction standard

An AI action must be explicit and narrowly labelled, for example “Review my answer,” not hidden behind an unrelated save action. Before sending content, show what types of information will be used. The response must:

- separate observations, coaching questions and optional suggestions;
- cite the relevant answer or story section where practical;
- say when evidence is missing instead of filling the gap;
- preserve user edits and never overwrite the source automatically;
- let the member accept, edit or dismiss suggestions individually where practical;
- avoid authoritative claims about what an employer will ask or decide; and
- fail safely with a normal retry or continue-without-AI path.

AI assistance must never be presented as human coach feedback. Human review and AI review need distinct labels.

## Prompt packs

Prompts are versioned product assets, not ad hoc strings scattered through route handlers. Each production prompt pack must define:

- a stable prompt ID and version;
- the member problem and permitted input fields;
- a founder-approved rubric and tone rules;
- explicit non-fabrication and privacy constraints;
- an output schema that the application validates;
- model tier, input ceiling and output ceiling;
- representative synthetic evaluation cases; and
- an owner and review date.

Static instructions should be cacheable. Member content must be inserted into clearly delimited data fields and treated as untrusted content, never as instructions. Prompt files must not contain secrets, real member content or environment configuration.

`ai-prompts/answer-coach-v1.md` records the first design contract. A production implementation may compile prompts into typed application code, but the reviewed product intent, rubric and version must remain traceable.

## Model routing

Choose a model for a measured task, not for its brand or parameter count. Maintain a provider-neutral model adapter and a small evaluation set for each prompt pack.

| Tier                | Suitable work                                                        | Default posture                                       |
| ------------------- | -------------------------------------------------------------------- | ----------------------------------------------------- |
| 0 — deterministic   | validation, taxonomy, filters, permissions and recommendations       | Use code; do not call a model.                        |
| 1 — tiny or small   | classification, extraction, PII flags and short constrained rewrites | Cheapest model that passes the task evaluation.       |
| 2 — capable small   | nuanced story and answer coaching                                    | Default for an explicit member feedback action.       |
| 3 — high capability | difficult premium review or low-confidence escalation                | Use only when evidence shows a material quality gain. |

Hosted commercial, European-hosted and open-weight models may all be evaluated. Small open models such as Ministral- or Qwen-class models are plausible candidates for local or controlled hosting; they are not presumed adequate until they pass OfferLab's tests. A provider based in any jurisdiction, including China, must meet the same contract, licensing, security, subprocessor, international-transfer, retention and deletion requirements. Country of origin is neither automatic approval nor automatic rejection.

“Free” API tiers are suitable for synthetic prototyping only unless their terms, data use and service guarantees pass the production review. Self-hosting can reduce disclosure to an external inference provider, but it also creates patching, abuse prevention, monitoring, capacity and operational costs. It is an option to measure, not an assumed saving.

Lock production model versions or snapshots where supported. A model change is a product change and must pass the relevant evaluations before rollout.

## Token and cost controls

Every AI feature must have a per-request and monthly budget before release.

- Send only the fields needed for the task, not a member's full profile or application history.
- Select relevant stories explicitly; cap their number and length.
- Use short structured outputs and enforce maximum output tokens.
- Cache stable rubric and instruction prefixes when a provider supports it.
- Prefer batch processing for offline editorial work when it reduces cost.
- Permit at most one bounded automatic retry for a malformed response.
- Apply member and account rate limits; premium usage may use transparent credits.
- Record model, prompt version, token counts, latency and estimated cost without logging prompt or answer content.
- Set budget alerts and a feature-level kill switch.
- Escalate to a larger model only after a low-confidence or failed-quality signal, not by default.

Illustrative cost should be calculated for the complete action, including input, cached input, output, retries and moderation. Provider prices change and must not be embedded as permanent product assumptions.

## Privacy and security gate

Member stories, answers and application context can contain personal data. Before a production provider receives them, document:

- lawful basis, purpose and the minimum fields required;
- the member-facing explanation and any necessary choice;
- processor terms, subprocessors, processing locations and international-transfer safeguards;
- training/data-improvement defaults, retention and deletion controls;
- encryption, access control, incident handling and abuse monitoring;
- the persistence and deletion policy for generated outputs; and
- whether a data protection impact assessment is required.

Use business/API terms approved for member data. Do not use consumer chat accounts or a provider's data-sharing free tier with real member content. Do not log prompts, outputs, stories, answers, emails, company names, role names or raw application identifiers. Analytics remains allow-listed and may record only coarse feature events and operational measures.

## Evaluation and release gate

Each task needs a compact, versioned evaluation set using synthetic or explicitly approved data. Measure at least:

- factual grounding and absence of invented claims;
- coverage of the OfferLab rubric;
- specificity and usefulness of coaching questions;
- preservation of the member's meaning and voice;
- generic phrasing and unnecessary verbosity;
- structured-output validity;
- privacy leakage and prompt-injection resistance;
- latency, failure rate, tokens and cost; and
- accessibility and clarity of the review workflow.

Founder or qualified coach review establishes the initial quality bar. Compare model tiers blind where practical. Release first to a small opt-in cohort, collect suggestion acceptance and qualitative usefulness, and retain a quick rollback. Do not optimise for generated word count or number of AI calls.

## Delivery sequence

1. Finalise the Answer Coach prompt pack and synthetic evaluation set.
2. Run offline comparisons across one economical hosted model, one stronger hosted model and one viable small open-weight model.
3. Prototype an explicit Answer Coach action with strict inputs, structured output, usage caps and no automatic source edits.
4. Complete privacy and provider review before using real member content.
5. Pilot with a small opt-in group and compare results with founder or coach feedback.
6. Expand only the tasks whose usefulness, safety and unit economics meet the release bar.

This sequence permits useful AI early without committing OfferLab to a single provider, an expensive default model or a generic chatbot experience.
