# OfferLab Product Documents

> Approved clarifications are recorded in `../architecture/founder-decisions.md`. The consolidated current goal, capability boundary and restrictions are in `current-product-contract.md`. Current positioning and priorities are in `product-strategy-and-roadmap.md`; current UX defaults are in `experience-principles.md`; permitted AI use is governed by `ai-product-strategy.md`. Together they supersede conflicting priorities, AI restrictions and guided-journey defaults in the historical documents below.

Visual implementation must also follow `ui-ux-design-system.md`, which defines OfferLab's spacing,
typography, colour, component, responsive and accessibility standards without overriding the
workspace-first behaviour in `experience-principles.md`.

This bundle contains active product contracts and earlier documents retained as historical delivery evidence or non-binding capability context.

## Files

1. `current-product-contract.md`
   Consolidates the current goal, approved capability boundary, explicit restrictions and decisions that remain open.

2. `product-strategy-and-roadmap.md`
   Defines the current product thesis, distinctive value and evidence-led delivery sequence.

3. `experience-principles.md`
   Defines the current authoritative workspace-first product and UX defaults.

4. `ai-product-strategy.md`
   Defines where AI creates distinctive value and the prompt, model, privacy, evaluation and cost controls required before release.

5. `ai-prompts/answer-coach-v1.md`, `ai-prompts/cv-review-v1.md` and
   `ai-prompts/cover-letter-review-v1.md`
   Define the evidence-grounded Answer Coach and career-document review prompt contracts.

6. `critical-user-journey.md`
   Retains an earlier paid-member journey as a non-binding product hypothesis.

7. `screen-map.md`
   Retains a possible functional inventory as non-binding screen context.

8. `vertical-slice-01.md`
   Records the implemented first engineering slice; it no longer limits current scope.

9. `onboarding-data-dictionary.md` and `application-tracking-data-dictionary.md`
   Record the implemented Increment 2 and Increment 3 data contracts and privacy boundaries.

10. `recommendation-data-dictionary.md` and `knowledge-library-data-dictionary.md`
    Record the deterministic recommendation and canonical preparation-resource contracts.

11. `phase-one-data-dictionary.md`
    Records the bounded data and privacy contracts for annotated cases, moderated intelligence,
    manually operated practice/feedback pilots and the local Answer Coach prototype.

12. `career-documents-and-job-discovery-data-dictionary.md`
    Records private CV and cover-letter versions, bounded reviews, saved job targets, synchronous
    extraction and the gated job-discovery boundary.

## Suggested repository location

```text
offerlab/
└── docs/
    └── product/
        ├── product-strategy-and-roadmap.md
        ├── experience-principles.md
        ├── ai-product-strategy.md
        ├── ai-prompts/
        │   ├── answer-coach-v1.md
        │   ├── cover-letter-review-v1.md
        │   └── cv-review-v1.md
        ├── career-documents-and-job-discovery-data-dictionary.md
        ├── mvp-brief.md
        ├── critical-user-journey.md
        ├── screen-map.md
        └── vertical-slice-01.md
```

Future briefs should begin with the simplest direct workflow and add guidance or aggregate dashboards only after a demonstrated need.
