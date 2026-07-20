# Database migrations

SQL migrations in `supabase/migrations/` are immutable after shared use. Create one with `pnpm db:new-migration <description>`, review the SQL, and validate by running `pnpm db:reset` against local Supabase.

Use expand-and-contract changes:

1. Add compatible structures.
2. deploy code that supports old and new forms;
3. backfill separately;
4. add constraints after validation;
5. remove old structures in a later release.

CI recreates the database from zero. Production migrations require a single controlled runner, advisory locking, a current recoverable backup, staging proof, and a written rollback note. Prefer corrective forward migrations. Only use down migrations for demonstrated lossless reversals. Never run `db reset --linked` against production.
