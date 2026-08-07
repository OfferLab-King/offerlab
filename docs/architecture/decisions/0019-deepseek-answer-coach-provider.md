# ADR 0019: DeepSeek adapter for bounded Answer Coach

**Status:** Accepted for local pilot and synthetic evaluation
**Date:** 2026-08-06

## Context

Answer Coach already has a provider-neutral domain boundary, deterministic local rubric, immutable review snapshots and strict anchored comments. The founder approved evaluating DeepSeek as the first hosted provider without expanding the product into answer generation or a generic chatbot.

Member answers and linked stories may contain personal data. A hosted provider can be unavailable, return malformed output or produce text that cannot be grounded in the source. DeepSeek's production use also requires a documented international-transfer and provider-terms review.

## Decision

Implement DeepSeek's OpenAI-compatible chat-completions API behind the existing `AnswerCoachProvider` interface. Use JSON mode with thinking disabled and a hard output ceiling. OfferLab supplies deterministic answer-segment identifiers; model output selects those identifiers and OfferLab resolves exact offsets before validating the complete strict domain schema.

Retry once only when output is empty, truncated, invalid JSON, schema-invalid or ungrounded. Do not retry authentication, billing, rate-limit or service failures. Fall back to the local rubric and label the persisted review honestly.

Require explicit member acceptance of a versioned provider notice before a model request. Persist the notice version, requested/actual provider mode, token counts and latency, but never prompts, outputs or member evidence in logs. Keep existing rate limits, monthly cap and kill switch.

DeepSeek is disabled unless `ANSWER_COACH_PROVIDER=deepseek` and its server-only configuration is complete. Production additionally requires `ANSWER_COACH_MODEL_DATA_APPROVED=true`; this flag may be set only after the AI privacy gate is complete.

## Consequences

- Core Answer Bank and local feedback remain usable without DeepSeek.
- Previous reviews disclose whether they used AI, local rubric or local fallback.
- Model changes can be evaluated without changing application or persistence boundaries.
- Production member-data use remains an operational and legal review decision, not an implication of merging this adapter.
