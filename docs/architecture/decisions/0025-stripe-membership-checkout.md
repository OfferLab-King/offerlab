# ADR 0025: Stripe-hosted membership checkout

**Status:** Accepted (founder direction 2026-08-20)
**Date:** 2026-08-20

## Context

ADR 0024 introduced owner-scoped membership entitlements, public pricing and
manual activation, but intentionally left provider-backed payment open. That
boundary produced an honest prototype but not a professional self-serve upgrade:
members could see prices and select membership without completing payment in the
product. The product also displayed two prices without defining renewal and
expiry semantics.

OfferLab needs a small, trustworthy paid conversion path. It does not need a
custom card form, a general commerce subsystem or speculative marketplace
payments. Hosted Stripe surfaces provide checkout and recurring-billing
management while keeping raw payment details outside OfferLab.

## Decision

### Offers

OfferLab exposes exactly two membership offers:

| Offer key                   | Consumer price | Payment model                  | Entitlement period                 |
| --------------------------- | -------------: | ------------------------------ | ---------------------------------- |
| `membership_monthly`        |             £9 | Monthly recurring subscription | Current successfully paid period   |
| `membership_season_6_month` |            £39 | One-time payment               | Six months from successful payment |

Prices are GBP and consumer-facing amounts include applicable tax. Both offers
grant the same `membership` entitlement. Monthly membership renews until
cancelled. The season pass never renews automatically and expires at its stored
period end. Changing price, duration, renewal behaviour or benefit scope is a
founder product decision.

The guaranteed benefit is a two-times multiplier on the member daily and monthly
career-document review ceilings. Early access is a secondary entitlement flag,
not a promise that a particular feature is always available. A capability may be
marketed as early access only while it is actually enabled for eligible members
and its pilot status, limits and fallback are stated. Membership does not change
Group Mock waitlist ordering.

### Checkout boundary

Use Stripe-hosted Checkout Sessions:

1. An authenticated eligible member selects one controlled offer key.
2. A server operation maps that key to an allow-listed environment-specific
   Stripe Price identifier and creates a short-lived Checkout Session.
3. Monthly uses subscription mode; the six-month season pass uses payment mode.
4. OfferLab redirects to the returned Stripe-hosted URL.
5. Checkout success returns to a dedicated membership confirmation route;
   abandonment returns to plans with a neutral “No payment was taken by
   OfferLab” message and no entitlement change.

The client cannot provide price, amount, currency, duration, customer identifier,
owner identifier, entitlement status, success authority or arbitrary return URL.
Checkout creation derives the internal owner from the authenticated session,
reuses the owner's server-side provider customer mapping when present and uses
controlled same-origin return routes.

Raw card data, full billing addresses and payment-method details are never
handled or persisted by OfferLab. Secrets and Stripe Price identifiers are
server-only configuration and are added to the runtime configuration schema and
`.env.example` by name only.

### Entitlement authority and reconciliation

The success redirect never grants membership. Provider-backed state changes
come only from signature-verified Stripe webhook events processed through a
dedicated membership application boundary. Processing is idempotent and safe for
duplicates, retries and out-of-order delivery.

Persist only the minimum reconciliation state: internal owner, controlled offer
key, Stripe customer/subscription or Checkout Session reference as applicable,
provider event identity for idempotency, entitlement status, paid-through or
expiry timestamp, cancellation-at-period-end state and timestamps. Do not store
payment methods, full addresses, invoice bodies or Checkout payloads.

Webhook processing must:

- resolve ownership from a server-created, integrity-protected mapping rather
  than accepting member identity from untrusted metadata;
- activate or extend only after a verified successful payment state;
- preserve access until the recorded paid-through timestamp for period-end
  cancellation or recoverable renewal failure;
- expire access after verified terminal state and the paid-through timestamp;
- reconcile authorised refunds without inventing entitlement state from a
  browser response;
- record a minimal audit event without billing or member-content payloads; and
- avoid product analytics that contain email, provider IDs, prices, addresses or
  payment details.

A privileged reconciliation command may repair state from Stripe during an
incident. It is audited, operator-only and does not weaken normal webhook
authority.

### Member billing management

Recurring members open a new short-lived Stripe Customer Portal session from the
OfferLab Plans page. The portal permits payment-method updates, invoice and
receipt access, and cancellation at the end of the current billing period.
Immediate self-serve cancellation is disabled. Members retain benefits until the
displayed paid-through date and may resume before that date when Stripe permits.

Season-pass members see the purchase type, active/expired state and expiry date.
They are not shown “renews,” “subscription” or “cancel subscription” controls.
They may access the appropriate Stripe receipt/invoice surface and OfferLab
support.

### Upgrade experience contract

The authoritative flow is compact and direct:

`Plans → choose monthly or six-month season → hosted Checkout → confirming → active membership`

The plans page must show, before checkout:

- the exact charge and whether it renews;
- six-month duration for the season pass;
- the guaranteed benefit and current free-plan limits in comparable language;
- honest availability for any named early-access capability;
- links to cancellation, refund, privacy and terms information; and
- no unsupported scarcity, countdown, popularity, savings or outcome claims.

Required states are:

- signed out, returning safely to the selected offer after authentication;
- free member with either offer available;
- checkout creation loading and retryable generic failure;
- checkout abandoned with no entitlement change;
- payment completed but webhook confirmation pending;
- active monthly, cancelling at period end, payment recovery and expired;
- active season pass and expired season pass;
- already-active member, preventing an accidental duplicate purchase;
- provider temporarily unavailable, preserving the free workspace; and
- generic support/reconciliation state when payment succeeded but membership is
  not confirmed within the bounded convergence window.

Loading and error states preserve the chosen offer without placing it in a URL
as an uncontrolled price identifier. Repeated clicks cannot create concurrent
live Checkout Sessions for the same intended purchase. The confirmation page is
safe to refresh. Accessibility, mobile behaviour, focus management and status
messages follow `docs/product/ui-ux-design-system.md`.

### Refund, tax and operations gates

Before enabling live checkout, the founder/operator must approve and publish
plain-language cancellation and refund terms, business contact information,
privacy information and statutory-rights language. Refunds are performed by an
authorised operator in Stripe and reconciled into entitlements; OfferLab does not
promise automated eligibility it cannot enforce. Statutory rights are never
excluded or reduced by product copy.

Configure tax-inclusive pricing and Stripe Tax before launch. Stripe supplies
receipts/invoices and hosted billing management. Registration, filing,
accounting, disputes and refund ownership remain documented operational duties.

Production activation requires:

- live Stripe account and approved business identity;
- two allow-listed live Price identifiers matching this ADR;
- webhook signing secret and signature verification;
- restricted production credentials in the provider secret store;
- end-to-end test-mode coverage for purchase, duplicate delivery, cancellation,
  renewal failure, recovery, expiry and refund;
- one controlled live purchase and refund verification;
- monitoring, reconciliation and support runbooks;
- a checkout kill switch that leaves the free product usable; and
- no unresolved high-severity security or dependency finding in the payment path.

## Consequences

- Members receive a familiar self-serve checkout and clear billing lifecycle.
- OfferLab remains outside raw card-data handling and does not build custom
  billing-management screens.
- Monthly and season purchases become distinguishable, auditable product offers
  while retaining one membership entitlement.
- Existing manual grants remain available for support and founder-operated
  exceptions; local test activation remains non-production only.
- Payment work for Group Mock, coaches, marketplace payouts, credits, trials,
  discounts and other products still requires a separate decision.

## Provider references

- [Stripe-hosted Checkout](https://docs.stripe.com/payments/checkout)
- [Fixed-price subscriptions with Checkout](https://docs.stripe.com/payments/checkout/build-subscriptions)
- [Stripe Customer Portal](https://docs.stripe.com/customer-management)
- [Automatic tax in Checkout](https://docs.stripe.com/tax/checkout?locale=en-GB)
