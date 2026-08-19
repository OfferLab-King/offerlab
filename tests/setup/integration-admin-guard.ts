import postgres from "postgres";

export async function setup(): Promise<void> {
  const databaseUrl =
    process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
  const database = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    const rows = await database<{ count: string }[]>`
      select count(*)::text as count from app."user" where role = 'administrator'
    `;
    const count = Number(rows[0]?.count ?? "0");
    if (count > 0) {
      const admins = await database<{ email: string; id: string }[]>`
        select id, email from app."user" where role = 'administrator' limit 5
      `;
      const details = admins.map((admin) => `${admin.email} (${admin.id})`).join(", ");
      console.warn(
        `\n[integration-guard] Found ${count} persistent administrator(s): ${details}. ` +
          "Integration tests require a disposable database with zero administrators (seed state). " +
          "Run `pnpm db:reset` before `pnpm test:integration` or `pnpm validate`. " +
          "CI does this automatically. Tests will continue but administrator-promotion and RLS suites will fail with `user_single_administrator` until the DB is reset.\n",
      );
    }
  } catch (error) {
    console.warn(`[integration-guard] Could not check administrator state: ${String(error)}`);
  } finally {
    await database.end();
  }
}

export async function teardown(): Promise<void> {}
