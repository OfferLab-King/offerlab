import postgres from "postgres";

import { loadLocalEnvironment } from "../shared/load-local-environment";

loadLocalEnvironment();

const email = process.argv
  .find((argument) => argument.startsWith("--email="))
  ?.slice("--email=".length);
const status = process.argv
  .find((argument) => argument.startsWith("--status="))
  ?.slice("--status=".length);
const periodEnd = process.argv
  .find((argument) => argument.startsWith("--period-end="))
  ?.slice("--period-end=".length);
const confirmed = process.argv.includes("--confirm");
const databaseUrl = process.env.DATABASE_MIGRATION_URL;

if (!email || !status || (status !== "active" && status !== "cancelled" && status !== "expired")) {
  throw new Error(
    "Usage: pnpm membership:grant --email=<verified-email> --status=active|cancelled|expired [--period-end=YYYY-MM-DD] --confirm",
  );
}
if (!confirmed) {
  throw new Error("Refusing to grant membership without --confirm.");
}
if (!databaseUrl) {
  throw new Error("DATABASE_MIGRATION_URL is required.");
}

const database = postgres(databaseUrl, {
  max: 1,
  onnotice: () => undefined,
  prepare: false,
});

try {
  const users = await database<{ id: string; email: string }[]>`
    select app_user.id, auth_user.email
    from app."user" as app_user
    inner join auth.users as auth_user on auth_user.id = app_user.auth_user_id
    where lower(auth_user.email) = ${email.trim().toLowerCase()}
    limit 1
  `;
  const user = users[0];
  if (!user) throw new Error("No OfferLab user exists for that email address.");

  if (status === "active") {
    await database`
      insert into app.membership (user_id, plan, status, period_end, source, updated_at)
      values (${user.id}::uuid, 'membership', 'active', ${periodEnd ? new Date(periodEnd) : null}::timestamptz, 'manual', now())
      on conflict (user_id) do update set
        status = excluded.status,
        period_end = excluded.period_end,
        source = excluded.source,
        updated_at = now()
    `;
    process.stdout.write(`Granted membership to ${user.email} (${user.id}).\n`);
  } else {
    await database`
      update app.membership
      set status = ${status}, updated_at = now()
      where user_id = ${user.id}::uuid
    `;
    process.stdout.write(`Set membership status to ${status} for ${user.email}.\n`);
  }
} finally {
  await database.end();
}
