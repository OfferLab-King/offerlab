import postgres from "postgres";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { promoteVerifiedUserToAdministrator } from "../../src/infrastructure/identity/promote-administrator";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const database = postgres(databaseUrl, { max: 1, prepare: false });
const testDomain = "@administrator-promotion.test.invalid";
const firstEmail = `candidate-one${testDomain}`;
const secondEmail = `candidate-two${testDomain}`;
const unrelatedEmail = `unrelated-administrator${testDomain}`;

beforeEach(async () => {
  await database`
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values
      (
        '00000000-0000-0000-0000-000000000000',
        '10000000-0000-4000-8000-000000000031', 'authenticated', 'authenticated',
        ${firstEmail}, '', now(), '{"provider":"email","providers":["email"]}', '{}',
        now(), now(), '', '', '', ''
      ),
      (
        '00000000-0000-0000-0000-000000000000',
        '10000000-0000-4000-8000-000000000032', 'authenticated', 'authenticated',
        ${secondEmail}, '', now(), '{"provider":"email","providers":["email"]}', '{}',
        now(), now(), '', '', '', ''
      ),
      (
        '00000000-0000-0000-0000-000000000000',
        '10000000-0000-4000-8000-000000000033', 'authenticated', 'authenticated',
        ${unrelatedEmail}, '', now(), '{"provider":"email","providers":["email"]}', '{}',
        now(), now(), '', '', '', ''
      )
  `;
  await database`
    insert into app."user" (id, auth_user_id, email) values
      (
        '20000000-0000-4000-8000-000000000031',
        '10000000-0000-4000-8000-000000000031', ${firstEmail}
      ),
      (
        '20000000-0000-4000-8000-000000000032',
        '10000000-0000-4000-8000-000000000032', ${secondEmail}
      ),
      (
        '20000000-0000-4000-8000-000000000033',
        '10000000-0000-4000-8000-000000000033', ${unrelatedEmail}
      )
  `;
});

afterAll(async () => {
  await database.end();
});

afterEach(async () => {
  await database`
    delete from app.audit_event
    where action = 'administrator.promoted'
      and entity_id in (
        '20000000-0000-4000-8000-000000000031',
        '20000000-0000-4000-8000-000000000032'
      )
  `;
  await database`delete from app."user" where email like ${`%${testDomain}`}`;
  await database`delete from auth.users where email like ${`%${testDomain}`}`;
});

describe("administrator promotion", () => {
  it("promotes one verified user and records an audit event atomically", async () => {
    const result = await promoteVerifiedUserToAdministrator(database, firstEmail);
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
    await promoteVerifiedUserToAdministrator(database, firstEmail);

    await expect(promoteVerifiedUserToAdministrator(database, secondEmail)).rejects.toThrow(
      "administrator already exists",
    );
  });

  it("fails for a missing user", async () => {
    await expect(
      promoteVerifiedUserToAdministrator(database, "missing@test.offerlab.invalid"),
    ).rejects.toThrow("No OfferLab user exists");
  });

  it("fails for an unverified user", async () => {
    await database`update auth.users set email_confirmed_at = null where email = ${firstEmail}`;

    await expect(promoteVerifiedUserToAdministrator(database, firstEmail)).rejects.toThrow(
      "has not verified",
    );
  });

  it("does not change an unrelated administrator", async () => {
    await database`
      update app."user"
      set role = 'administrator'
      where id = '20000000-0000-4000-8000-000000000033'
    `;

    await expect(promoteVerifiedUserToAdministrator(database, firstEmail)).rejects.toThrow(
      "administrator already exists",
    );
    const unrelated = await database<{ role: string }[]>`
      select role from app."user" where id = '20000000-0000-4000-8000-000000000033'
    `;
    expect(unrelated).toEqual([{ role: "administrator" }]);
  });
});
