import postgres, { type Sql, type TransactionSql } from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { ApplicationValues } from "../../src/modules/applications/domain/application";
import {
  createApplication,
  findApplication,
  listApplications,
  setApplicationArchived,
  updateApplication,
} from "../../src/modules/applications/infrastructure/application-repository";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const migrationDatabase = postgres(databaseUrl, { max: 2, prepare: false });
const runtimeUrl = new URL(databaseUrl);
runtimeUrl.username = "offerlab_runtime_login";
runtimeUrl.password = "postgres";
const runtimeDatabase = postgres(runtimeUrl.toString(), { max: 2, prepare: false });
const concurrentOne = postgres(runtimeUrl.toString(), { max: 1, prepare: false });
const concurrentTwo = postgres(runtimeUrl.toString(), { max: 1, prepare: false });

const userOne = "20000000-0000-4000-8000-000000000001";
const userTwo = "20000000-0000-4000-8000-000000000002";
const base: ApplicationValues = {
  appliedDate: null,
  applicationDeadline: "2026-09-30",
  company: "Example Plc",
  industry: "consulting",
  location: "London",
  nextStageDeadline: "2026-08-20",
  notes: "Private preparation notes",
  opportunityType: "graduate_scheme",
  role: "Graduate Analyst",
  stage: "preparing",
};

async function asUser<T>(
  userId: string,
  operation: (database: TransactionSql) => PromiseLike<T>,
  connection: Sql = runtimeDatabase,
): Promise<T> {
  return (await connection.begin(async (transaction) => {
    await transaction`set local role offerlab_app`;
    await transaction`select set_config('app.current_user_id', ${userId}, true)`;
    return operation(transaction);
  })) as T;
}

async function create(values = base) {
  const result = await asUser(userOne, (database) => createApplication(database, userOne, values));
  if (!("application" in result)) throw new Error("Expected created application.");
  return result.application;
}

async function audits() {
  return migrationDatabase<{ action: string; entity_id: string; metadata: object }[]>`
    select action, entity_id, metadata from app.audit_event
    where entity_type = 'application' order by created_at, action
  `;
}

beforeEach(async () => {
  await migrationDatabase`delete from app.audit_event where entity_type in ('application', 'recommendation_state')`;
  await migrationDatabase`delete from app.recommendation_state`;
  await migrationDatabase`delete from app.application`;
  await migrationDatabase`update app."user" set role = 'member' where id = ${userTwo}::uuid`;
});

afterAll(async () => {
  await Promise.all([
    migrationDatabase.end(),
    runtimeDatabase.end(),
    concurrentOne.end(),
    concurrentTwo.end(),
  ]);
});

describe("application lifecycle, ownership, and concurrency", () => {
  it("creates, lists, and reads two same-company applications for their owner", async () => {
    const first = await create();
    const second = await create({ ...base, industry: null });
    expect(second.id).not.toBe(first.id);
    await expect(
      asUser(userOne, (database) => listApplications(database, userOne, false)),
    ).resolves.toHaveLength(2);
    await expect(
      asUser(userOne, (database) => findApplication(database, userOne, first.id)),
    ).resolves.toMatchObject({
      company: base.company,
      industry: "consulting",
      notes: base.notes,
      version: 1,
    });
    await expect(
      asUser(userOne, (database) => findApplication(database, userOne, second.id)),
    ).resolves.toMatchObject({ industry: null });
    await expect(audits()).resolves.toEqual([
      { action: "application.created", entity_id: first.id, metadata: {} },
      { action: "application.created", entity_id: second.id, metadata: {} },
    ]);
  });

  it("denies another member and an administrator without revealing the object", async () => {
    const application = await create();
    await expect(
      asUser(userTwo, (database) => findApplication(database, userTwo, application.id)),
    ).resolves.toBeNull();
    await migrationDatabase`update app."user" set role = 'administrator' where id = ${userTwo}::uuid`;
    await expect(
      asUser(userTwo, (database) => findApplication(database, userTwo, application.id)),
    ).resolves.toBeNull();
    await expect(
      asUser(userTwo, (database) =>
        updateApplication(database, userTwo, application.id, 1, { ...base, role: "Stolen" }),
      ),
    ).resolves.toEqual({ outcome: "not_found" });
  });

  it("classifies ordinary, stage, combined, and unchanged updates deterministically", async () => {
    const application = await create();
    const ordinary = await asUser(userOne, (database) =>
      updateApplication(database, userOne, application.id, 1, { ...base, location: "Manchester" }),
    );
    expect(ordinary).toMatchObject({ application: { version: 2 }, outcome: "updated" });
    const stage = await asUser(userOne, (database) =>
      updateApplication(database, userOne, application.id, 2, {
        ...base,
        location: "Manchester",
        stage: "applied",
      }),
    );
    expect(stage).toMatchObject({ application: { version: 3 }, outcome: "stage_changed" });
    const combined = await asUser(userOne, (database) =>
      updateApplication(database, userOne, application.id, 3, {
        ...base,
        location: "Bristol",
        role: "Graduate Consultant",
        stage: "interview",
      }),
    );
    expect(combined).toMatchObject({ application: { version: 4 }, outcome: "stage_changed" });
    const unchanged = await asUser(userOne, (database) =>
      updateApplication(database, userOne, application.id, 4, {
        ...base,
        location: "Bristol",
        role: "Graduate Consultant",
        stage: "interview",
      }),
    );
    expect(unchanged).toMatchObject({ application: { version: 4 }, outcome: "unchanged" });
    expect((await audits()).map(({ action }) => action)).toEqual([
      "application.created",
      "application.updated",
      "application.stage_changed",
      "application.stage_changed",
    ]);
  });

  it("returns a conflict for stale and simultaneous updates without double audit", async () => {
    const application = await create();
    const stale = await asUser(userOne, (database) =>
      updateApplication(database, userOne, application.id, 99, { ...base, role: "Stale" }),
    );
    expect(stale).toMatchObject({ current: { version: 1 }, outcome: "conflict" });
    const results = await Promise.all([
      asUser(
        userOne,
        (database) =>
          updateApplication(database, userOne, application.id, 1, { ...base, role: "First" }),
        concurrentOne,
      ),
      asUser(
        userOne,
        (database) =>
          updateApplication(database, userOne, application.id, 1, { ...base, role: "Second" }),
        concurrentTwo,
      ),
    ]);
    expect(results.map(({ outcome }) => outcome).sort()).toEqual(["conflict", "updated"]);
    expect((await audits()).map(({ action }) => action)).toEqual([
      "application.created",
      "application.updated",
    ]);
  });

  it("rolls back an update when its required audit insertion fails", async () => {
    const application = await create();
    await migrationDatabase`revoke insert on app.audit_event from offerlab_app`;
    try {
      await expect(
        asUser(userOne, (database) =>
          updateApplication(database, userOne, application.id, 1, { ...base, role: "Not saved" }),
        ),
      ).rejects.toThrow();
    } finally {
      await migrationDatabase`
        grant insert (actor_user_id, action, entity_type, entity_id, metadata)
        on app.audit_event to offerlab_app
      `;
    }
    await expect(
      asUser(userOne, (database) => findApplication(database, userOne, application.id)),
    ).resolves.toMatchObject({ role: base.role, version: 1 });
  });

  it("archives, filters, restores, and treats repeated transitions as unchanged", async () => {
    const application = await create();
    const archived = await asUser(userOne, (database) =>
      setApplicationArchived(database, userOne, application.id, 1, true),
    );
    expect(archived).toMatchObject({ application: { version: 2 }, outcome: "archived" });
    await expect(
      asUser(userOne, (database) => listApplications(database, userOne, false)),
    ).resolves.toEqual([]);
    await expect(
      asUser(userOne, (database) => listApplications(database, userOne, true)),
    ).resolves.toHaveLength(1);
    const repeated = await asUser(userOne, (database) =>
      setApplicationArchived(database, userOne, application.id, 2, true),
    );
    expect(repeated).toMatchObject({ application: { version: 2 }, outcome: "unchanged" });
    await expect(
      asUser(userOne, (database) =>
        updateApplication(database, userOne, application.id, 2, { ...base, role: "Blocked edit" }),
      ),
    ).resolves.toEqual({ outcome: "not_found" });
    const restored = await asUser(userOne, (database) =>
      setApplicationArchived(database, userOne, application.id, 2, false),
    );
    expect(restored).toMatchObject({ application: { version: 3 }, outcome: "restored" });
    await expect(
      asUser(userTwo, (database) =>
        setApplicationArchived(database, userTwo, application.id, 3, true),
      ),
    ).resolves.toEqual({ outcome: "not_found" });
    expect((await audits()).map(({ action }) => action)).toEqual([
      "application.created",
      "application.archived",
      "application.restored",
    ]);
  });
});

describe("application PostgreSQL invariants and RLS", () => {
  it.each([
    ["blank company", "", base.role, base.opportunityType, base.stage, base.location, base.notes],
    ["overlong company", "x".repeat(121), base.role, base.opportunityType, base.stage, null, null],
    ["overlong role", base.company, "x".repeat(161), base.opportunityType, base.stage, null, null],
    ["unsupported opportunity", base.company, base.role, "contract", base.stage, null, null],
    ["unsupported stage", base.company, base.role, base.opportunityType, "unknown", null, null],
    [
      "overlong location",
      base.company,
      base.role,
      base.opportunityType,
      base.stage,
      "x".repeat(121),
      null,
    ],
    [
      "overlong notes",
      base.company,
      base.role,
      base.opportunityType,
      base.stage,
      null,
      "x".repeat(2001),
    ],
  ])("rejects %s", async (_name, company, role, opportunity, stage, location, notes) => {
    await expect(
      asUser(
        userOne,
        (database) => database`
        insert into app.application (
          owner_user_id, company_name, role_title, opportunity_type, current_stage, location, notes
        ) values (
          ${userOne}::uuid, ${company}, ${role}, ${opportunity}, ${stage}, ${location}, ${notes}
        )
      `,
      ),
    ).rejects.toThrow();
  });

  it("prevents object-ID-only access and does not leak pooled owner context", async () => {
    const application = await create();
    const crossUserRows = await asUser(
      userTwo,
      (database) =>
        database<
          { id: string }[]
        >`select id from app.application where id = ${application.id}::uuid`,
    );
    expect(crossUserRows).toEqual([]);
    const noContextRows = await runtimeDatabase.begin(async (transaction) => {
      await transaction`set local role offerlab_app`;
      return transaction<{ id: string }[]>`select id from app.application`;
    });
    expect(noContextRows).toEqual([]);
  });

  it("rejects an unsupported industry at the PostgreSQL boundary", async () => {
    await expect(
      asUser(
        userOne,
        (database) => database`
        insert into app.application (
          owner_user_id, company_name, role_title, opportunity_type, industry, current_stage
        ) values (
          ${userOne}::uuid, 'Example Plc', 'Graduate Analyst', 'graduate_scheme', 'space', 'preparing'
        )
      `,
      ),
    ).rejects.toThrow();
  });

  it("preserves version and timestamp for direct no-op SQL and increments meaningful updates once", async () => {
    const application = await create();
    const auditCount = (await audits()).length;
    const callerTimestamp = new Date("2000-01-01T00:00:00.000Z");
    await asUser(
      userOne,
      (database) => database`
      update app.application
      set role_title = role_title, version = 999, updated_at = ${callerTimestamp}
      where id = ${application.id}::uuid and owner_user_id = ${userOne}::uuid
    `,
    );
    await expect(
      asUser(userOne, (database) => findApplication(database, userOne, application.id)),
    ).resolves.toMatchObject({ updatedAt: application.updatedAt, version: 1 });
    expect(await audits()).toHaveLength(auditCount);

    await asUser(
      userOne,
      (database) => database`
        update app.application
        set role_title = 'Changed directly', version = 999, updated_at = ${callerTimestamp}
        where id = ${application.id}::uuid and owner_user_id = ${userOne}::uuid
      `,
    );
    const changed = await asUser(userOne, (database) =>
      findApplication(database, userOne, application.id),
    );
    expect(changed).toMatchObject({ role: "Changed directly", version: 2 });
    expect(changed?.updatedAt.getTime()).toBeGreaterThan(application.updatedAt.getTime());
  });

  it("gives browser Supabase roles and identity sync no direct table access", async () => {
    const privileges = await migrationDatabase<
      { anon: boolean; authenticated: boolean; identity_sync: boolean; runtime: boolean }[]
    >`
      select
        has_table_privilege('anon', 'app.application', 'select') as anon,
        has_table_privilege('authenticated', 'app.application', 'select') as authenticated,
        has_table_privilege('offerlab_identity_sync', 'app.application', 'select') as identity_sync,
        has_table_privilege('offerlab_app', 'app.application', 'select') as runtime
    `;
    expect(privileges[0]).toEqual({
      anon: false,
      authenticated: false,
      identity_sync: false,
      runtime: true,
    });
  });
});
