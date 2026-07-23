# Local Learn demonstration content

Run the idempotent local demonstration seed after local Supabase is available:

```bash
DATABASE_MIGRATION_URL="postgresql://postgres:postgres@127.0.0.1:55322/postgres" pnpm seed:learn-demo -- --confirm-local
```

The command publishes five Preparation Plans and their supporting canonical resources **only to an approved local database host**. It is optional development content: it never runs during application startup, migration replay, builds or production deployment.

The copy is realistic beta demonstration material, not production editorial content. A founder or editor must review and approve it before any separate production publishing process. Running this local seed is not part of production deployment.
