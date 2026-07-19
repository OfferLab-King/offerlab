# ADR 0008: Europe/London calendar-day semantics

- Status: Accepted
- Date: 2026-07-19

## Decision

Store timestamps in UTC and user deadlines as dates. Calculate deadline distance using Europe/London calendar days. A future/today next-stage deadline wins; a past one is overdue and excluded from future-window matching, then application deadline is considered.

## Consequences

Time logic requires one injectable clock and explicit tests at midnight, BST transitions, and overdue boundaries.
