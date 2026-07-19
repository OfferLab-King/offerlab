import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const database = postgres(databaseUrl, { max: 1, prepare: false });

afterAll(async () => {
  await database.end();
});

describe("database foundation", () => {
  it("applies the identity and audit schema", async () => {
    const rows = await database<{ audit_table: string | null; user_table: string | null }[]>`
      select
        to_regclass('app.audit_event')::text as audit_table,
        to_regclass('app.user')::text as user_table
    `;

    expect(rows[0]).toEqual({ audit_table: "app.audit_event", user_table: 'app."user"' });
  });

  it("enables and forces RLS on the internal user table", async () => {
    const rows = await database<{ relforcerowsecurity: boolean; relrowsecurity: boolean }[]>`
      select relforcerowsecurity, relrowsecurity
      from pg_class
      where oid = 'app.user'::regclass
    `;

    expect(rows[0]).toEqual({ relforcerowsecurity: true, relrowsecurity: true });
  });
});
