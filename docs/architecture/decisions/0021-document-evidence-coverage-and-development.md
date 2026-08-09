# ADR 0021: Document evidence coverage and development guidance

**Status:** Accepted

**Date:** 2026-08-09

## Context

The first career-document review reduced job descriptions to frequent individual words. This made
filler terms appear important, hid the actual skill or experience being assessed and produced
advice too short to support a useful CV edit. It also treated naming a target company as CV
targeting, which is appropriate for a cover letter but generally not necessary in a CV.

Members need a quick indication of document coverage, but a hiring likelihood or opaque job-match
score would imply access to employer decisions and data OfferLab does not possess. Genuine gaps can
also become useful return points when they lead to evidence-building work rather than unsupported
keyword insertion.

## Decision

- Extract a bounded set of meaningful requirement phrases and named skills from the selected job
  description. Ignore generic adjectives and filler terms.
- Classify each assessed requirement as evidenced or an evidence gap. Every evidenced requirement
  requires an exact source excerpt; every gap receives a specific truthful improvement action.
- Derive a document evidence coverage score as `evidenced / assessed × 100`. Show the underlying
  counts and state that the measure is not an ATS score, candidate ranking, suitability decision or
  outcome prediction. The model never supplies or weights the score.
- Do not recommend adding the company name to a CV. Assess CV targeting through evidence relevance
  and prominence. Continue to assess explicit company and role context in cover letters.
- Map recognised gaps to a small curated catalogue of OfferLab evidence projects and external
  learning options. Course completion is not treated as evidence; each recommendation includes an
  inspectable project output.
- Keep external recommendations centrally curated and explicitly disclose the commercial
  relationship. No affiliate parameters or commission claims are used without an actual agreement.

The existing review record remains sufficient: represented requirements, missing requirements,
exact evidence and actions are persisted, while the score and learning cards are derived at read
time. No new member-owned table or provider call is introduced.

## Consequences

The review becomes more explanatory without adding an employer simulation or storing a speculative
probability. Old immutable reviews remain readable and receive a score from their stored counts,
although members should request a new v2 review to receive phrase-level requirements and richer
actions. External course content and pricing can change, so links require periodic editorial review.
