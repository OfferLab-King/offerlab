# ADR 0007: Deterministic recommendation precedence

- Status: Accepted
- Date: 2026-07-19

## Decision

Specificity outranks priority: stage/deadline/opportunity, stage/deadline, stage/opportunity, then stage. Priority descends only within equal specificity; stable resource/rule keys break ties. Results group by application, deduplicate per application, and cap at five per application and ten per dashboard.

## Consequences

The evaluator is pure, explainable, and frozen-clock testable. Inactive rules/resources are never eligible. No AI participates.
