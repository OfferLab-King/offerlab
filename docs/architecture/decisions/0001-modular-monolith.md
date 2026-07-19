# ADR 0001: Modular monolith and single deployment

- Status: Accepted
- Date: 2026-07-19

## Decision

Build OfferLab as one modular monolith and deploy public, authentication, member, and administrator routes together. Enforce module boundaries in code rather than through network services.

## Consequences

Delivery and operation remain appropriate for a solo founder. Modules can be separated later only with evidence. Microservices, Kubernetes, separate frontend/backend deployments, queues, and caches are not part of the foundation.
