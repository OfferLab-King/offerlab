import postgres, { type Sql, type TransactionSql } from "postgres";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const migrationDatabase = postgres(databaseUrl, { max: 2, prepare: false });
const runtimeUrl = new URL(databaseUrl);
runtimeUrl.username = "offerlab_runtime_login";
runtimeUrl.password = "postgres";
const runtimeDatabase = postgres(runtimeUrl.toString(), { max: 2, prepare: false });
const concurrentRuntimeOne = postgres(runtimeUrl.toString(), { max: 1, prepare: false });
const concurrentRuntimeTwo = postgres(runtimeUrl.toString(), { max: 1, prepare: false });

const userOne = "20000000-0000-4000-8000-000000000001";
const userTwo = "20000000-0000-4000-8000-000000000002";

type RecommendationState = {
  application_id: string;
  completed_at: Date | null;
  created_at: Date;
  dismissed_at: Date | null;
  id: string;
  owner_user_id: string;
  recommendation_key: string;
  rule_version: number;
  state: string;
  updated_at: Date;
  version: number;
};

async function asUser<T>(
  userId: string,
  operation: (transaction: TransactionSql) => PromiseLike<T>,
  connection: Sql = runtimeDatabase,
): Promise<T> {
  return (await connection.begin(async (transaction) => {
    await transaction`set local role offerlab_app`;
    await transaction`select set_config('app.current_user_id', ${userId}, true)`;
    return operation(transaction);
  })) as T;
}

async function cleanup() {
  await migrationDatabase`
    delete from app.audit_event
    where entity_type in ('application', 'recommendation_state')
  `;
  await migrationDatabase`delete from app.recommendation_state`;
  await migrationDatabase`delete from app.application`;
  await migrationDatabase`
    update app."user"
    set role = 'member'
    where id in (${userOne}::uuid, ${userTwo}::uuid)
  `;
}

async function createApplication(ownerUserId: string) {
  const rows = await asUser(
    ownerUserId,
    (database) => database<{ id: string }[]>`
      insert into app.application (
        owner_user_id,
        company_name,
        role_title,
        opportunity_type,
        current_stage
      ) values (
        ${ownerUserId}::uuid,
        'Recommendation Test Employer',
        'Graduate Role',
        'graduate_scheme',
        'interview'
      )
      returning id
    `,
  );
  const application = rows[0];
  if (!application) throw new Error("Expected a test application.");
  return application.id;
}

async function insertState(
  ownerUserId: string,
  applicationId: string,
  recommendationKey = "interview_prepare_examples",
  state = "pending",
  connection: Sql = runtimeDatabase,
) {
  const rows = await asUser(
    ownerUserId,
    (database) => database<RecommendationState[]>`
      insert into app.recommendation_state (
        owner_user_id,
        application_id,
        recommendation_key,
        rule_version,
        state
      ) values (
        ${ownerUserId}::uuid,
        ${applicationId}::uuid,
        ${recommendationKey},
        1,
        ${state}
      )
      returning *
    `,
    connection,
  );
  const recommendationState = rows[0];
  if (!recommendationState) throw new Error("Expected a recommendation-state row.");
  return recommendationState;
}

beforeEach(cleanup);
afterEach(cleanup);

afterAll(async () => {
  await Promise.all([
    migrationDatabase.end(),
    runtimeDatabase.end(),
    concurrentRuntimeOne.end(),
    concurrentRuntimeTwo.end(),
  ]);
});

describe("recommendation-state PostgreSQL constraints and triggers", () => {
  it("installs the explicit identity, lifecycle, ownership, and lookup constraints", async () => {
    const constraints = await migrationDatabase<{ conname: string }[]>`
      select conname
      from pg_constraint
      where conrelid = 'app.recommendation_state'::regclass
      order by conname
    `;
    expect(constraints.map(({ conname }) => conname)).toEqual(
      expect.arrayContaining([
        "recommendation_state_application_owner_fk",
        "recommendation_state_identity_unique",
        "recommendation_state_key_check",
        "recommendation_state_owner_user_id_fkey",
        "recommendation_state_pkey",
        "recommendation_state_rule_version_check",
        "recommendation_state_state_check",
        "recommendation_state_timestamps_check",
        "recommendation_state_transition_timestamps_check",
        "recommendation_state_version_check",
      ]),
    );
    const applicationOwnerConstraint = await migrationDatabase<{ exists: boolean }[]>`
      select exists (
        select 1 from pg_constraint
        where conrelid = 'app.application'::regclass
          and conname = 'application_owner_id_unique'
          and contype = 'u'
      ) as exists
    `;
    expect(applicationOwnerConstraint).toEqual([{ exists: true }]);
    const lookupIndex = await migrationDatabase<{ index: string | null }[]>`
      select to_regclass(
        'app.recommendation_state_owner_application_state_idx'
      )::text as index
    `;
    expect(lookupIndex).toEqual([
      { index: "app.recommendation_state_owner_application_state_idx" },
    ]);
  });

  it("accepts a bounded stable key and isolates rule versions and applications", async () => {
    const firstApplication = await createApplication(userOne);
    const secondApplication = await createApplication(userOne);
    const maximumLengthKey = `a${"b".repeat(79)}`;

    await insertState(userOne, firstApplication, maximumLengthKey);
    await asUser(
      userOne,
      (database) => database`
        insert into app.recommendation_state (
          owner_user_id, application_id, recommendation_key, rule_version
        ) values (
          ${userOne}::uuid, ${firstApplication}::uuid, ${maximumLengthKey}, 2
        )
      `,
    );
    await insertState(userOne, secondApplication, maximumLengthKey);

    await expect(insertState(userOne, firstApplication, maximumLengthKey)).rejects.toThrow(
      /recommendation_state_identity_unique/,
    );

    const rows = await migrationDatabase<{ count: number }[]>`
      select count(*)::int as count
      from app.recommendation_state
      where owner_user_id = ${userOne}::uuid
        and recommendation_key = ${maximumLengthKey}
    `;
    expect(rows).toEqual([{ count: 3 }]);
  });

  it.each([
    ["empty key", "", 1, "pending"],
    ["uppercase key", "Interview_prepare", 1, "pending"],
    ["punctuated key", "interview-prepare", 1, "pending"],
    ["overlong key", `a${"b".repeat(80)}`, 1, "pending"],
    ["zero rule version", "interview_prepare", 0, "pending"],
    ["negative rule version", "interview_prepare", -1, "pending"],
    ["unsupported state", "interview_prepare", 1, "hidden"],
  ])("rejects an %s", async (_name, recommendationKey, ruleVersion, state) => {
    const applicationId = await createApplication(userOne);
    await expect(
      asUser(
        userOne,
        (database) => database`
          insert into app.recommendation_state (
            owner_user_id, application_id, recommendation_key, rule_version, state
          ) values (
            ${userOne}::uuid,
            ${applicationId}::uuid,
            ${recommendationKey},
            ${ruleVersion},
            ${state}
          )
        `,
      ),
    ).rejects.toThrow();
  });

  it("controls insert values, preserves a no-op, and increments each transition once", async () => {
    const applicationId = await createApplication(userOne);
    const callerTimestamp = new Date("2000-01-01T00:00:00.000Z");
    const insertedRows = await asUser(
      userOne,
      (database) => database<RecommendationState[]>`
        insert into app.recommendation_state (
          owner_user_id,
          application_id,
          recommendation_key,
          rule_version,
          state,
          version,
          created_at,
          updated_at,
          completed_at,
          dismissed_at
        ) values (
          ${userOne}::uuid,
          ${applicationId}::uuid,
          'interview_prepare_examples',
          1,
          'completed',
          999,
          ${callerTimestamp},
          ${callerTimestamp},
          ${callerTimestamp},
          ${callerTimestamp}
        )
        returning *
      `,
    );
    const inserted = insertedRows[0];
    expect(inserted).toBeDefined();
    if (!inserted) return;
    expect(inserted.version).toBe(1);
    expect(inserted.created_at).toEqual(inserted.updated_at);
    expect(inserted.completed_at).toEqual(inserted.updated_at);
    expect(inserted.dismissed_at).toBeNull();
    expect(inserted.created_at.getTime()).toBeGreaterThan(callerTimestamp.getTime());

    const unchangedRows = await asUser(
      userOne,
      (database) => database<RecommendationState[]>`
        update app.recommendation_state
        set state = 'completed',
            version = -100,
            created_at = ${callerTimestamp},
            updated_at = ${callerTimestamp},
            completed_at = null,
            dismissed_at = ${callerTimestamp}
        where id = ${inserted.id}::uuid
        returning *
      `,
    );
    const unchanged = unchangedRows[0];
    expect(unchanged).toMatchObject({
      completed_at: inserted.completed_at,
      created_at: inserted.created_at,
      dismissed_at: null,
      updated_at: inserted.updated_at,
      version: 1,
    });

    const dismissedRows = await asUser(
      userOne,
      (database) => database<RecommendationState[]>`
        update app.recommendation_state
        set state = 'dismissed', version = 500, updated_at = ${callerTimestamp}
        where id = ${inserted.id}::uuid and version = 1
        returning *
      `,
    );
    const dismissed = dismissedRows[0];
    expect(dismissed).toBeDefined();
    if (!dismissed) return;
    expect(dismissed).toMatchObject({ completed_at: null, state: "dismissed", version: 2 });
    expect(dismissed.dismissed_at).toEqual(dismissed.updated_at);
    expect(dismissed.created_at).toEqual(inserted.created_at);

    const restoredRows = await asUser(
      userOne,
      (database) => database<RecommendationState[]>`
        update app.recommendation_state
        set state = 'pending', version = 900,
            completed_at = ${callerTimestamp}, dismissed_at = ${callerTimestamp}
        where id = ${inserted.id}::uuid and version = 2
        returning *
      `,
    );
    expect(restoredRows[0]).toMatchObject({
      completed_at: null,
      dismissed_at: null,
      state: "pending",
      version: 3,
    });

    const audits = await migrationDatabase<{ count: number }[]>`
      select count(*)::int as count
      from app.audit_event
      where entity_type = 'recommendation_state'
    `;
    expect(audits).toEqual([{ count: 0 }]);
  });

  it("prevents a persisted recommendation identity from being rewritten", async () => {
    const applicationId = await createApplication(userOne);
    const recommendationState = await insertState(userOne, applicationId);

    await expect(
      asUser(
        userOne,
        (database) => database`
          update app.recommendation_state
          set recommendation_key = 'interview_different_key'
          where id = ${recommendationState.id}::uuid
        `,
      ),
    ).rejects.toThrow(/recommendation_state_identity_is_immutable/);
  });

  it("uses the composite foreign key to reject mismatched application ownership", async () => {
    const applicationId = await createApplication(userOne);

    await expect(
      asUser(
        userTwo,
        (database) => database`
          insert into app.recommendation_state (
            owner_user_id, application_id, recommendation_key, rule_version
          ) values (
            ${userTwo}::uuid, ${applicationId}::uuid, 'interview_prepare_examples', 1
          )
        `,
      ),
    ).rejects.toThrow(/recommendation_state_application_owner_fk/);
  });

  it("serializes competing first inserts into one durable identity", async () => {
    const applicationId = await createApplication(userOne);
    const insert = (connection: Sql, state: "completed" | "dismissed") =>
      asUser(
        userOne,
        (database) => database<{ id: string; state: string }[]>`
          insert into app.recommendation_state (
            owner_user_id, application_id, recommendation_key, rule_version, state
          ) values (
            ${userOne}::uuid,
            ${applicationId}::uuid,
            'interview_prepare_examples',
            1,
            ${state}
          )
          on conflict (
            owner_user_id, application_id, recommendation_key, rule_version
          ) do nothing
          returning id, state
        `,
        connection,
      );

    const results = await Promise.all([
      insert(concurrentRuntimeOne, "completed"),
      insert(concurrentRuntimeTwo, "dismissed"),
    ]);
    expect(results.map((rows) => (rows.length === 1 ? "inserted" : "conflict")).sort()).toEqual([
      "conflict",
      "inserted",
    ]);
    const winner = results.find((rows) => rows.length === 1)?.[0];
    expect(winner).toBeDefined();

    const durableRows = await migrationDatabase<{ id: string; state: string; version: number }[]>`
      select id, state, version
      from app.recommendation_state
      where owner_user_id = ${userOne}::uuid
        and application_id = ${applicationId}::uuid
        and recommendation_key = 'interview_prepare_examples'
        and rule_version = 1
    `;
    expect(durableRows).toEqual([{ id: winner?.id, state: winner?.state, version: 1 }]);
  });

  it("lets exactly one competing expected-version transition commit", async () => {
    const applicationId = await createApplication(userOne);
    const recommendationState = await insertState(userOne, applicationId);
    const update = (connection: Sql, state: "completed" | "dismissed") =>
      asUser(
        userOne,
        (database) => database<{ state: string; version: number }[]>`
          update app.recommendation_state
          set state = ${state}
          where id = ${recommendationState.id}::uuid and version = 1
          returning state, version
        `,
        connection,
      );

    const results = await Promise.all([
      update(concurrentRuntimeOne, "completed"),
      update(concurrentRuntimeTwo, "dismissed"),
    ]);
    expect(results.map((rows) => (rows.length === 1 ? "updated" : "conflict")).sort()).toEqual([
      "conflict",
      "updated",
    ]);
    const winner = results.find((rows) => rows.length === 1)?.[0];

    const durableRows = await migrationDatabase<{ state: string; version: number }[]>`
      select state, version
      from app.recommendation_state
      where id = ${recommendationState.id}::uuid
    `;
    expect(durableRows).toEqual([{ state: winner?.state, version: 2 }]);
  });
});

describe("recommendation-state RLS, roles, and audit policy", () => {
  it("allows owner access but hides identifiers and writes from another member or administrator", async () => {
    const applicationId = await createApplication(userOne);
    const recommendationState = await insertState(userOne, applicationId);

    await expect(
      asUser(
        userOne,
        (database) => database<{ id: string }[]>`
          select id from app.recommendation_state where id = ${recommendationState.id}::uuid
        `,
      ),
    ).resolves.toEqual([{ id: recommendationState.id }]);
    await expect(
      asUser(
        userTwo,
        (database) => database<{ id: string }[]>`
          select id from app.recommendation_state where id = ${recommendationState.id}::uuid
        `,
      ),
    ).resolves.toEqual([]);
    await expect(
      asUser(
        userTwo,
        (database) => database<{ id: string }[]>`
          update app.recommendation_state
          set state = 'completed'
          where id = ${recommendationState.id}::uuid
          returning id
        `,
      ),
    ).resolves.toEqual([]);

    await migrationDatabase`
      update app."user" set role = 'administrator' where id = ${userTwo}::uuid
    `;
    await expect(
      asUser(
        userTwo,
        (database) => database<{ id: string }[]>`
          select id from app.recommendation_state where id = ${recommendationState.id}::uuid
        `,
      ),
    ).resolves.toEqual([]);
  });

  it("denies a forged owner and prevents owner context leaking on a reused connection", async () => {
    const applicationId = await createApplication(userOne);
    const recommendationState = await insertState(userOne, applicationId);

    await expect(
      asUser(
        userTwo,
        (database) => database`
          insert into app.recommendation_state (
            owner_user_id, application_id, recommendation_key, rule_version
          ) values (
            ${userOne}::uuid, ${applicationId}::uuid, 'interview_second_action', 1
          )
        `,
        concurrentRuntimeOne,
      ),
    ).rejects.toThrow(/row-level security/);

    await expect(
      asUser(
        userOne,
        (database) => database<{ id: string }[]>`
          select id from app.recommendation_state where id = ${recommendationState.id}::uuid
        `,
        concurrentRuntimeOne,
      ),
    ).resolves.toEqual([{ id: recommendationState.id }]);
    const withoutContext = await concurrentRuntimeOne.begin(async (transaction) => {
      await transaction`set local role offerlab_app`;
      return transaction<{ id: string }[]>`select id from app.recommendation_state`;
    });
    expect(withoutContext).toEqual([]);
  });

  it("enables forced RLS and grants only select, insert, and update to the app role", async () => {
    const rls = await migrationDatabase<
      { relforcerowsecurity: boolean; relrowsecurity: boolean }[]
    >`
      select relrowsecurity, relforcerowsecurity
      from pg_class
      where oid = 'app.recommendation_state'::regclass
    `;
    expect(rls).toEqual([{ relforcerowsecurity: true, relrowsecurity: true }]);

    const applicationPrivileges = await migrationDatabase<
      { delete: boolean; insert: boolean; select: boolean; update: boolean }[]
    >`
      select
        has_table_privilege('offerlab_app', 'app.recommendation_state', 'select') as select,
        has_table_privilege('offerlab_app', 'app.recommendation_state', 'insert') as insert,
        has_table_privilege('offerlab_app', 'app.recommendation_state', 'update') as update,
        has_table_privilege('offerlab_app', 'app.recommendation_state', 'delete') as delete
    `;
    expect(applicationPrivileges).toEqual([
      { delete: false, insert: true, select: true, update: true },
    ]);

    for (const role of [
      "public",
      "anon",
      "authenticated",
      "offerlab_identity_sync",
      "offerlab_auth_function_owner",
    ]) {
      const denied = await migrationDatabase<
        { insert: boolean; select: boolean; update: boolean }[]
      >`
        select
          has_table_privilege(${role}, 'app.recommendation_state', 'select') as select,
          has_table_privilege(${role}, 'app.recommendation_state', 'insert') as insert,
          has_table_privilege(${role}, 'app.recommendation_state', 'update') as update
      `;
      expect(denied, role).toEqual([{ insert: false, select: false, update: false }]);
    }
  });

  it("restricts the database trigger helper to the runtime application role", async () => {
    const signature = "app.control_recommendation_state_mutation()";
    const privileges = await migrationDatabase<
      {
        anon: boolean;
        authenticated: boolean;
        identity_sync: boolean;
        public: boolean;
        runtime: boolean;
      }[]
    >`
      select
        has_function_privilege('public', ${signature}, 'execute') as public,
        has_function_privilege('anon', ${signature}, 'execute') as anon,
        has_function_privilege('authenticated', ${signature}, 'execute') as authenticated,
        has_function_privilege(
          'offerlab_identity_sync', ${signature}, 'execute'
        ) as identity_sync,
        has_function_privilege('offerlab_app', ${signature}, 'execute') as runtime
    `;
    expect(privileges).toEqual([
      {
        anon: false,
        authenticated: false,
        identity_sync: false,
        public: false,
        runtime: true,
      },
    ]);
    const definition = await migrationDatabase<{ security_definer: boolean }[]>`
      select prosecdef as security_definer
      from pg_proc
      where oid = ${signature}::regprocedure
    `;
    expect(definition).toEqual([{ security_definer: false }]);
  });

  it("allows only owner-scoped, property-free recommendation transition audits", async () => {
    const ownerApplicationId = await createApplication(userOne);
    const ownerState = await insertState(userOne, ownerApplicationId);
    const otherApplicationId = await createApplication(userTwo);
    const otherState = await insertState(userTwo, otherApplicationId);

    for (const action of [
      "recommendation.completed",
      "recommendation.dismissed",
      "recommendation.restored",
    ]) {
      await asUser(
        userOne,
        (database) => database`
          insert into app.audit_event (
            actor_user_id, action, entity_type, entity_id, metadata
          ) values (
            ${userOne}::uuid,
            ${action},
            'recommendation_state',
            ${ownerState.id}::uuid,
            '{}'::jsonb
          )
        `,
      );
    }

    const audits = await migrationDatabase<
      { action: string; entity_id: string; metadata: Record<string, unknown> }[]
    >`
      select action, entity_id, metadata
      from app.audit_event
      where entity_type = 'recommendation_state'
      order by action
    `;
    expect(audits).toEqual([
      { action: "recommendation.completed", entity_id: ownerState.id, metadata: {} },
      { action: "recommendation.dismissed", entity_id: ownerState.id, metadata: {} },
      { action: "recommendation.restored", entity_id: ownerState.id, metadata: {} },
    ]);

    await expect(
      asUser(
        userOne,
        (database) => database`
          insert into app.audit_event (
            actor_user_id, action, entity_type, entity_id, metadata
          ) values (
            ${userOne}::uuid,
            'recommendation.completed',
            'recommendation_state',
            ${ownerState.id}::uuid,
            '{"state":"completed"}'::jsonb
          )
        `,
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      asUser(
        userOne,
        (database) => database`
          insert into app.audit_event (
            actor_user_id, action, entity_type, entity_id, metadata
          ) values (
            ${userOne}::uuid,
            'recommendation.opened',
            'recommendation_state',
            ${ownerState.id}::uuid,
            '{}'::jsonb
          )
        `,
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      asUser(
        userOne,
        (database) => database`
          insert into app.audit_event (
            actor_user_id, action, entity_type, entity_id, metadata
          ) values (
            ${userOne}::uuid,
            'recommendation.completed',
            'recommendation_state',
            ${otherState.id}::uuid,
            '{}'::jsonb
          )
        `,
      ),
    ).rejects.toThrow(/row-level security/);
  });
});
