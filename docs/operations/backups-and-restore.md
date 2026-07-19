# Backups and restore testing

## Closed-beta objective

- Recovery point objective: 24 hours.
- Supabase Pro managed backups: daily, with seven days of retained daily backups under the current plan assumptions.
- No additional backup infrastructure is provisioned by the technical foundation.

Confirm provider behavior and retention before production launch because service terms can change.

## Future PITR trigger

Enable point-in-time recovery before any of these becomes true:

- Losing up to 24 hours of paid-member data is commercially unacceptable.
- Application/report write volume makes manual reconstruction impractical.
- A high-risk data migration or launch event materially increases change rate.
- Contractual or regulatory obligations require a lower RPO.

## Restore-test procedure

1. Record the chosen backup timestamp and expected recovery point.
2. Create an isolated, access-restricted recovery project; never overwrite production for a test.
3. Restore the managed backup following the current Supabase procedure.
4. Apply any later compatible migrations through the normal migration runner.
5. verify table counts, constraints, RLS policies, representative owner isolation, and critical application queries;
6. confirm no production email, analytics, webhook, or external integration is active;
7. record actual recovery time, recovered timestamp, discrepancies, and cleanup;
8. destroy the recovery environment after evidence is retained.

Run this procedure before public launch and at least quarterly after launch.
