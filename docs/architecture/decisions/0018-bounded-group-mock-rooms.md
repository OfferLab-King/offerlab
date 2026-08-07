# ADR 0018: Bounded Group Mock rooms

**Status:** Accepted
**Date:** 2026-07-27

## Context

Applicants struggle to find a reliable cohort and realistic material for group-exercise practice. The existing practice-services module records interest only. A self-service video marketplace would add room concurrency, payment, safeguarding, moderation, recording and coach-access risks before demand is established.

## Decision

- Add flexible, administrator-authored `group_mock_material` records with draft, published and archived lifecycle states. Stable metadata covers industry, problem archetype, format, difficulty, capability focus, group size and phase timings; Markdown sections support varied briefs, datasets, options, role notes and required outputs without a rigid case template.
- Seed exactly 100 fictional OfferLab-authored cases across ten industries and ten problem archetypes. Synthetic library records are distinguishable from administrator-confirmed originals and may never reproduce supplied, leaked, confidential or live employer material.
- Let authenticated members search, filter and open published cases independently of room booking. Session bookings still control meeting access, not catalogue discovery.
- Add administrator-scheduled group_mock_session rooms with fixed start/end times, three-to-eight-person capacity, minimum attendance and either membership-included or manually reconciled external-payment access.
- Add owner-scoped group_mock_booking records. Database-controlled transitions assign confirmed, payment-pending or waitlisted status under a locked capacity check. Cancelling an occupied seat promotes the earliest waitlisted booking.
- Keep meeting credentials in a separate protected record. Only administrators and confirmed participants within 15 minutes of the start and before the end may read a join URL.
- Require versioned confirmation that a participant is at least 18 and accepts rules prohibiting recording, contact exchange and redistribution of materials.
- Use provider-neutral external meeting URLs for the pilot. Never store or distribute a provider account login or host password.
- Do not record sessions. External payment confirmation is operational, not an in-product payment or entitlement system.

All member bookings remain owner scoped with forced RLS. Materials, rooms and meetings are administrator-controlled. Published case reads remain authenticated. Audit metadata remains empty and does not contain exercise, payment, meeting or member content.

## Consequences

The case library and lobby can validate material demand, room fill rate, attendance and willingness to pay without automatic matching or embedded video. OfferLab must operate scheduling, payment reconciliation and facilitation manually. Embedded video, member-created rooms, recordings, coach accounts, individual feedback records and in-product payments require later product, privacy and architecture decisions.
