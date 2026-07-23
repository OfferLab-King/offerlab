# OfferLab Product Documents

> Approved clarifications are recorded in `../architecture/founder-decisions.md`. Current positioning and priorities are in `product-strategy-and-roadmap.md`; current UX defaults are in `experience-principles.md`; permitted AI use is governed by `ai-product-strategy.md`. Together they supersede conflicting priorities, AI restrictions and guided-journey defaults in the earlier drafts below.

This bundle contains the governing product strategy, experience principles and earlier documents retained for scope and capability context.

## Files

1. `product-strategy-and-roadmap.md`
   Defines the current product thesis, distinctive value and evidence-led delivery sequence.

2. `experience-principles.md`
   Defines the current authoritative workspace-first product and UX defaults.

3. `ai-product-strategy.md`
   Defines where AI creates distinctive value and the prompt, model, privacy, evaluation and cost controls required before release.

4. `ai-prompts/answer-coach-v1.md`
   Defines the first evidence-grounded Answer Coach prompt and evaluation contract.

5. `critical-user-journey.md`
   Defines the primary paid-member journey from discovery through preparation and contribution.

6. `screen-map.md`
   Defines the functional screen inventory for the OfferLab MVP.

7. `vertical-slice-01.md`
   Defines the first end-to-end engineering slice: onboarding, application tracking and rule-based recommendations.

8. `onboarding-data-dictionary.md` and `application-tracking-data-dictionary.md`
   Record the implemented Increment 2 and Increment 3 data contracts and privacy boundaries.

9. `recommendation-data-dictionary.md` and `knowledge-library-data-dictionary.md`
   Record the deterministic recommendation and canonical preparation-resource contracts.

## Suggested repository location

```text
offerlab/
└── docs/
    └── product/
        ├── product-strategy-and-roadmap.md
        ├── experience-principles.md
        ├── ai-product-strategy.md
        ├── ai-prompts/
        │   └── answer-coach-v1.md
        ├── mvp-brief.md
        ├── critical-user-journey.md
        ├── screen-map.md
        └── vertical-slice-01.md
```

Future briefs should begin with the simplest direct workflow and add guidance or aggregate dashboards only after a demonstrated need.
