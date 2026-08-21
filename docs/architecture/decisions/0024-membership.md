# ADR 0024: Paid membership entitlements

**Status:** Accepted; payment boundary amended by ADR 0025 (founder direction 2026-08-20)
**Date:** 2026-08-15

## Context

The founder directed the product towards monetisation readiness: visitors
should be willing to pay on arrival. The previous contract required a
separate decision for in-product payments and did not approve any payment
provider. The product already had a natural premium moment — bounded
career-document review ceilings with hard member limits — and a
provider-neutral AI boundary that made capacity a saleable, honest
differentiator.

## Decision

Introduce a membership tier with an owner-scoped entitlement record and a
clearly labelled free/premium split:

- **`app.membership`** (one row per paying member; plan `membership`,
  status `active`/`cancelled`/`expired`, period, source
  `manual`/`stripe`/`test`). Forced RLS with owner-only policies mirroring
  the onboarding profile; a security-definer administrator view
  (`app.membership_admin_view()`) exposes a purpose-limited listing to
  `offerlab_app`.
- **Free plan is the current product.** Premium adds capacity and early
  access; it never removes or hides previously free functionality.
- **First premium benefit:** active membership doubles the member daily and
  monthly career-document review ceilings
  (`readEffectiveReviewUsageLimits`); the hosted-account monthly cap stays a
  shared safety ceiling.
- **Pricing** is founder-set in the membership domain constants
  (£9/month, £39/recruitment season) and surfaced on `/plans`.
- **Activation paths:** privileged CLI (`pnpm membership:grant`, migration
  role, mirroring `admin:promote`), owner self-serve test activation in
  local development (`source = test`), and the bounded Stripe-hosted production
  checkout approved later in ADR 0025.
- **UI:** one `/plans` surface for public pricing and signed-in member management; legacy
  `/member/membership` links redirect to it. An
  administrator read-only membership screen, and honest upgrade prompts at
  the review capacity point in the career-document workspace.

## Consequences

- Members see double review capacity immediately; free members keep the
  current limits and see a clearly labelled upgrade path instead of a dead
  end at the limit error.
- RLS isolation is tested with two-user horizontal-access tests; the
  owner-scoped application API never accepts another member's id from
  routes (session-derived only).
- ADR 0025 resolves the provider, offer, checkout, renewal, cancellation and
  provisioning boundary for the two approved membership offers. Other payments
  remain outside this ADR.
- Pricing constants are product constants, not environment configuration:
  changing them is a product decision with a single edit point.
- Membership does not alter Group Mock waitlist order. Any interface or metadata
  claiming priority queue placement is incorrect until a later founder decision
  explicitly changes that policy.
