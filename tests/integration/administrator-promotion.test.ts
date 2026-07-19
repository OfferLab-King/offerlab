import postgres from "postgres";
import { afterAll, afterEach, describe, expect, it } from "vitest";

import { promoteVerifiedUserToAdministrator } from "../../src/infrastructure/identity/promote-administrator";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const database = postgres(databaseUrl, { max: 1, prepare: false });

afterAll(async () => {
  await database.end();
});

afterEach(async () => {
  await database`delete from app.audit_event where action = 'administrator.promoted'`;
  await database`delete from app."user" where id = '20000000-0000-4000-8000-000000000003'`;
  await database`delete from auth.users where id = '10000000-0000-4000-8000-000000000003'`;
  await database`update app."user" set role = 'member' where role = 'administrator'`;
});

describe("administrator promotion", () => {
  it("promotes one verified user and records an audit event atomically", async () => {
    const result = await promoteVerifiedUserToAdministrator(
      database,
      "member-one@test.offerlab.invalid",
    );
    const users = await database<{ role: string }[]>`
      select role from app."user" where id = ${result.userId}::uuid
    `;
    const auditEvents = await database<{ action: string }[]>`
      select action from app.audit_event where entity_id = ${result.userId}::uuid
    `;

    expect(users[0]?.role).toBe("administrator");
    expect(auditEvents).toEqual([{ action: "administrator.promoted" }]);
  });

  it("fails rather than creating a second administrator", async () => {
    await promoteVerifiedUserToAdministrator(database, "member-one@test.offerlab.invalid");

    await expect(
      promoteVerifiedUserToAdministrator(database, "member-two@test.offerlab.invalid"),
    ).rejects.toThrow("administrator already exists");
  });

  it("fails for a missing user", async () => {
    await expect(
      promoteVerifiedUserToAdministrator(database, "missing@test.offerlab.invalid"),
    ).rejects.toThrow("No OfferLab user exists");
  });

  it("fails for an unverified user", async () => {
    await database`
      insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
      values (
        '10000000-0000-4000-8000-000000000003',
        'unverified@test.offerlab.invalid',
        '{}',
        '{}'
      )
    `;
    await database`
      insert into app."user" (id, auth_user_id, email)
      values (
        '20000000-0000-4000-8000-000000000003',
        '10000000-0000-4000-8000-000000000003',
        'unverified@test.offerlab.invalid'
      )
    `;

    await expect(
      promoteVerifiedUserToAdministrator(database, "unverified@test.offerlab.invalid"),
    ).rejects.toThrow("has not verified");
  });
});
