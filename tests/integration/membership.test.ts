import postgres, { type TransactionSql } from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import {
  activateTestMembership,
  cancelMembershipForOwner,
  readAllMembershipsForAdmin,
  readMembershipSummary,
} from "../../src/modules/membership/application/membership";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const runtimeUrl = new URL(databaseUrl);
runtimeUrl.username = "offerlab_runtime_login";
runtimeUrl.password = "postgres";
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = runtimeUrl.toString();
}
const migrationDatabase = postgres(databaseUrl, { max: 2, prepare: false });
const runtimeDatabase = postgres(runtimeUrl.toString(), { max: 2, prepare: false });

const memberOne = "20000000-0000-4000-8000-000000000001";
const memberTwo = "20000000-0000-4000-8000-000000000002";
const administrator = "20000000-0000-4000-8000-000000000003";

async function asUser<T>(
  userId: string,
  operation: (database: TransactionSql) => PromiseLike<T>,
): Promise<T> {
  return (await runtimeDatabase.begin(async (transaction) => {
    await transaction`set local role offerlab_app`;
    await transaction`select set_config('app.current_user_id', ${userId}, true)`;
    return operation(transaction);
  })) as T;
}

afterAll(async () => {
  await migrationDatabase.end();
  await runtimeDatabase.end();
});

describe("membership entitlements", () => {
  it("activates, reads and cancels membership for the owner", async () => {
    await migrationDatabase`delete from app.membership where user_id in (${memberOne}::uuid, ${memberTwo}::uuid)`;
    try {
      const activated = await asUser(memberOne, () => activateTestMembership(memberOne));
      expect(activated).toMatchObject({ active: true, plan: "membership", status: "active" });

      const summary = await asUser(memberOne, () => readMembershipSummary(memberOne));
      expect(summary).toMatchObject({ active: true, plan: "membership", status: "active" });
      expect(summary.source).toBe("test");

      const cancelled = await asUser(memberOne, () => cancelMembershipForOwner(memberOne));
      expect(cancelled).toMatchObject({ active: false, plan: "membership", status: "cancelled" });
    } finally {
      await migrationDatabase`delete from app.membership where user_id = ${memberOne}::uuid`;
    }
  });

  it("isolates membership records between members and exposes them to administrators", async () => {
    await migrationDatabase`delete from app.membership where user_id in (${memberOne}::uuid, ${memberTwo}::uuid)`;
    try {
      await migrationDatabase`
        insert into app.membership (user_id, plan, status, source)
        values (${memberOne}::uuid, 'membership', 'active', 'manual')
      `;

      const ownerView = await asUser(memberOne, () => readMembershipSummary(memberOne));
      expect(ownerView.plan).toBe("membership");
      expect(ownerView.active).toBe(true);

      // Direct cross-member reads are filtered by RLS and writes affect no
      // rows; the owner-scoped application API is never handed another
      // member's id by the server routes.
      const directRead = await asUser(
        memberTwo,
        (database) =>
          database<{ plan: string }[]>`
          select plan from app.membership where user_id = ${memberOne}::uuid
        `,
      );
      expect(directRead).toHaveLength(0);

      await asUser(
        memberTwo,
        (database) =>
          database`
          update app.membership set status = 'cancelled'
          where user_id = ${memberOne}::uuid
        `,
      );
      const afterCrossWrite = await migrationDatabase<{ status: string }[]>`
        select status from app.membership where user_id = ${memberOne}::uuid
      `;
      expect(afterCrossWrite[0]!.status).toBe("active");

      const adminView = await asUser(administrator, () =>
        readAllMembershipsForAdmin(administrator),
      );
      expect(adminView.some((row) => row.userId === memberOne)).toBe(true);
    } finally {
      await migrationDatabase`delete from app.membership where user_id = ${memberOne}::uuid`;
    }
  });
});
