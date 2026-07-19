import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const database = postgres(databaseUrl, { max: 1, prepare: false });

afterAll(async () => {
  await database.end();
});

describe("member row isolation", () => {
  it("allows the application role to see only the current internal user", async () => {
    const visibleUsers = await database.begin(async (transaction) => {
      await transaction`set local role offerlab_app`;
      await transaction`select set_config('app.current_user_id', '20000000-0000-4000-8000-000000000001', true)`;

      return transaction<{ id: string }[]>`select id from app."user" order by id`;
    });

    expect(visibleUsers).toEqual([{ id: "20000000-0000-4000-8000-000000000001" }]);
  });

  it("returns no row for another member's direct identifier", async () => {
    const visibleUsers = await database.begin(async (transaction) => {
      await transaction`set local role offerlab_app`;
      await transaction`select set_config('app.current_user_id', '20000000-0000-4000-8000-000000000001', true)`;

      return transaction<{ id: string }[]>`
        select id
        from app."user"
        where id = '20000000-0000-4000-8000-000000000002'
      `;
    });

    expect(visibleUsers).toEqual([]);
  });
});
