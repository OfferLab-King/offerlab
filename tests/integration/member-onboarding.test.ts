import postgres, { type Sql, type TransactionSql } from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { OnboardingAnswers } from "../../src/modules/member-profile/domain/onboarding";
import {
  findOnboardingProfile,
  saveOnboardingProfile,
  type SaveOnboardingResult,
} from "../../src/modules/member-profile/infrastructure/onboarding-repository";

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
const complete: OnboardingAnswers = {
  confidence: "mixed",
  educationStage: "undergraduate",
  industries: ["consulting"],
  opportunityTypes: ["graduate_scheme"],
  preparationPriorities: ["application_cv"],
  supportNeeds: ["feedback"],
  targetCompanies: ["Example Plc"],
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

function saved(result: SaveOnboardingResult) {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Expected onboarding save to succeed.");
  return result;
}

async function onboardingAudits() {
  return migrationDatabase<{ action: string; metadata: Record<string, unknown> }[]>`
    select action, metadata
    from app.audit_event
    where entity_type = 'onboarding_profile'
    order by action
  `;
}

beforeEach(async () => {
  await migrationDatabase`delete from app.audit_event where entity_type = 'onboarding_profile'`;
  await migrationDatabase`delete from app.onboarding_profile`;
  await migrationDatabase`update app."user" set role = 'member' where id = ${userTwo}::uuid`;
});

afterAll(async () => {
  await Promise.all([
    migrationDatabase.end(),
    runtimeDatabase.end(),
    concurrentRuntimeOne.end(),
    concurrentRuntimeTwo.end(),
  ]);
});

describe("member onboarding persistence and isolation", () => {
  it("saves and resumes an incomplete profile without an audit event", async () => {
    const draft = { ...complete, industries: [], preparationPriorities: [] };
    const result = saved(
      await asUser(userOne, (database) => saveOnboardingProfile(database, userOne, draft)),
    );
    expect(result.outcome).toBe("saved_incomplete");
    expect(result.analyticsEvent).toBe("onboarding_started");
    expect(result.profile.completedAt).toBeNull();
    await expect(
      asUser(userOne, (database) => findOnboardingProfile(database, userOne)),
    ).resolves.toMatchObject({ answers: draft, completedAt: null });
    await expect(onboardingAudits()).resolves.toEqual([]);
  });

  it("records first completion, ignores an unchanged save, then audits an update", async () => {
    const first = saved(
      await asUser(userOne, (database) => saveOnboardingProfile(database, userOne, complete)),
    );
    expect(first.outcome).toBe("completed");
    expect(first.analyticsEvent).toBe("onboarding_completed");

    const repeated = saved(
      await asUser(userOne, (database) => saveOnboardingProfile(database, userOne, complete)),
    );
    expect(repeated.outcome).toBe("unchanged");
    expect(repeated.analyticsEvent).toBeNull();
    expect(repeated.profile.updatedAt).toEqual(first.profile.updatedAt);

    const updated = saved(
      await asUser(userOne, (database) =>
        saveOnboardingProfile(database, userOne, { ...complete, confidence: "confident" }),
      ),
    );
    expect(updated.outcome).toBe("updated");
    expect(updated.analyticsEvent).toBe("onboarding_updated");
    expect(updated.profile.completedAt).toEqual(first.profile.completedAt);
    await expect(onboardingAudits()).resolves.toEqual([
      { action: "onboarding.completed", metadata: {} },
      { action: "onboarding.updated", metadata: {} },
    ]);
  });

  it("serializes simultaneous meaningful first-completion saves", async () => {
    const alternative = { ...complete, confidence: "confident" as const };
    const results = await Promise.all([
      asUser(
        userOne,
        (database) => saveOnboardingProfile(database, userOne, complete),
        concurrentRuntimeOne,
      ),
      asUser(
        userOne,
        (database) => saveOnboardingProfile(database, userOne, alternative),
        concurrentRuntimeTwo,
      ),
    ]);
    const successful = results.map(saved);
    expect(successful.map(({ outcome }) => outcome).sort()).toEqual(["completed", "updated"]);

    const rows = await migrationDatabase<{ count: number }[]>`
      select count(*)::int as count from app.onboarding_profile where user_id = ${userOne}::uuid
    `;
    expect(rows).toEqual([{ count: 1 }]);
    await expect(onboardingAudits()).resolves.toEqual([
      { action: "onboarding.completed", metadata: {} },
      { action: "onboarding.updated", metadata: {} },
    ]);

    const finalProfile = await asUser(userOne, (database) =>
      findOnboardingProfile(database, userOne),
    );
    expect([complete.confidence, alternative.confidence]).toContain(
      finalProfile?.answers.confidence,
    );
  });

  it("classifies concurrent unchanged replay without duplicate audit events", async () => {
    saved(await asUser(userOne, (database) => saveOnboardingProfile(database, userOne, complete)));
    const results = await Promise.all([
      asUser(
        userOne,
        (database) => saveOnboardingProfile(database, userOne, complete),
        concurrentRuntimeOne,
      ),
      asUser(
        userOne,
        (database) => saveOnboardingProfile(database, userOne, complete),
        concurrentRuntimeTwo,
      ),
    ]);
    expect(results.map(saved).map(({ outcome }) => outcome)).toEqual(["unchanged", "unchanged"]);
    await expect(onboardingAudits()).resolves.toEqual([
      { action: "onboarding.completed", metadata: {} },
    ]);
  });

  it("rolls the profile write back when completion audit insertion fails", async () => {
    await migrationDatabase`
      insert into app.audit_event (actor_user_id, action, entity_type, entity_id, metadata)
      values (${userOne}::uuid, 'onboarding.completed', 'onboarding_profile', ${userOne}::uuid, '{}')
    `;
    await expect(
      asUser(userOne, (database) => saveOnboardingProfile(database, userOne, complete)),
    ).rejects.toThrow(/onboarding_first_completion_audit_unique/);
    const profileRows = await migrationDatabase<{ count: number }[]>`
      select count(*)::int as count from app.onboarding_profile where user_id = ${userOne}::uuid
    `;
    expect(profileRows).toEqual([{ count: 0 }]);
    await expect(onboardingAudits()).resolves.toEqual([
      { action: "onboarding.completed", metadata: {} },
    ]);
  });

  it("denies cross-user reads and writes at RLS and repository boundaries", async () => {
    saved(await asUser(userOne, (database) => saveOnboardingProfile(database, userOne, complete)));
    await expect(
      asUser(userTwo, (database) => findOnboardingProfile(database, userOne)),
    ).resolves.toBeNull();
    await expect(
      asUser(userTwo, (database) => saveOnboardingProfile(database, userOne, complete)),
    ).rejects.toThrow(/row-level security|onboarding_save_failed/);
  });

  it("does not let an administrator bypass profile ownership", async () => {
    saved(await asUser(userOne, (database) => saveOnboardingProfile(database, userOne, complete)));
    await migrationDatabase`update app."user" set role = 'administrator' where id = ${userTwo}::uuid`;
    await expect(
      asUser(userTwo, (database) => findOnboardingProfile(database, userOne)),
    ).resolves.toBeNull();
  });
});

describe("onboarding PostgreSQL invariants", () => {
  async function expectRuntimeRejection(query: (database: TransactionSql) => PromiseLike<unknown>) {
    await expect(asUser(userOne, query)).rejects.toThrow();
  }

  it.each([
    [
      "education stage",
      "unknown",
      ["graduate_scheme"],
      ["consulting"],
      ["application_cv"],
      [],
      null,
    ],
    [
      "opportunity type",
      "undergraduate",
      ["unknown"],
      ["consulting"],
      ["application_cv"],
      [],
      null,
    ],
    ["industry", "undergraduate", ["graduate_scheme"], ["unknown"], ["application_cv"], [], null],
    ["priority", "undergraduate", ["graduate_scheme"], ["consulting"], ["unknown"], [], null],
    [
      "support need",
      "undergraduate",
      ["graduate_scheme"],
      ["consulting"],
      ["application_cv"],
      ["unknown"],
      null,
    ],
    [
      "confidence",
      "undergraduate",
      ["graduate_scheme"],
      ["consulting"],
      ["application_cv"],
      [],
      "unknown",
    ],
  ])(
    "rejects an unsupported %s",
    async (_name, education, opportunities, sectors, priorities, support, confidence) => {
      await expectRuntimeRejection(
        (database) => database`
      insert into app.onboarding_profile (
        user_id, education_stage, opportunity_types, industries, preparation_priorities,
        support_needs, confidence, completed_at
      ) values (
        ${userOne}::uuid, ${education}, ${opportunities}, ${sectors}, ${priorities},
        ${support}, ${confidence}, now()
      )
    `,
      );
    },
  );

  it.each([
    [
      "duplicate controlled values",
      databaseArray("graduate_scheme", "graduate_scheme"),
      databaseArray("consulting"),
      databaseArray("application_cv"),
    ],
    [
      "null controlled element",
      databaseArray("graduate_scheme"),
      nullIndustryArray,
      databaseArray("application_cv"),
    ],
    [
      "excessive controlled cardinality",
      excessiveOpportunityArray,
      databaseArray("consulting"),
      databaseArray("application_cv"),
    ],
  ])("rejects %s", async (_name, opportunities, sectors, priorities) => {
    await expectRuntimeRejection((database) =>
      database.unsafe(`
      insert into app.onboarding_profile (
        user_id, education_stage, opportunity_types, industries, preparation_priorities, completed_at
      ) values (
        '${userOne}', 'undergraduate', ${opportunities}, ${sectors}, ${priorities}, now()
      )
    `),
    );
  });

  it.each([
    ["whitespace-only company", ["   "]],
    ["null company", ["Example Plc", null]],
    ["overlong company", ["x".repeat(81)]],
    ["case-insensitive duplicates", ["Example Plc", "example plc"]],
    ["excess internal whitespace", ["Example  Plc"]],
    ["companies differing only by excess whitespace", ["Example Plc", "Example  Plc"]],
    ["excessive company count", Array.from({ length: 11 }, (_, index) => `Company ${index}`)],
  ])("rejects %s", async (_name, companies) => {
    await expectRuntimeRejection(
      (database) => database`
      insert into app.onboarding_profile (user_id, target_companies)
      values (${userOne}::uuid, ${companies})
    `,
    );
  });

  it("rejects contradictory completion states and timestamp ordering", async () => {
    await expectRuntimeRejection(
      (database) => database`
      insert into app.onboarding_profile (
        user_id, education_stage, opportunity_types, industries, preparation_priorities
      ) values (
        ${userOne}::uuid, 'undergraduate', array['graduate_scheme'], array['consulting'],
        array['application_cv']
      )
    `,
    );
    await expectRuntimeRejection(
      (database) => database`
      insert into app.onboarding_profile (user_id, completed_at)
      values (${userOne}::uuid, now())
    `,
    );
    await expectRuntimeRejection(
      (database) => database`
      insert into app.onboarding_profile (user_id, created_at, updated_at)
      values (${userOne}::uuid, now(), now() - interval '1 second')
    `,
    );
  });

  it("rejects attempts to revert or alter first completion", async () => {
    saved(await asUser(userOne, (database) => saveOnboardingProfile(database, userOne, complete)));
    await expectRuntimeRejection(
      (database) => database`
      update app.onboarding_profile
      set completed_at = null, industries = '{}'
      where user_id = ${userOne}::uuid
    `,
    );
    await expectRuntimeRejection(
      (database) => database`
      update app.onboarding_profile
      set completed_at = now() + interval '1 second'
      where user_id = ${userOne}::uuid
    `,
    );
  });

  it("enforces controlled-array and company invariants on updates", async () => {
    const draft = { ...complete, industries: [], preparationPriorities: [] };
    saved(await asUser(userOne, (database) => saveOnboardingProfile(database, userOne, draft)));
    await expectRuntimeRejection(
      (database) => database`
        update app.onboarding_profile
        set opportunity_types = array['graduate_scheme', 'graduate_scheme']
        where user_id = ${userOne}::uuid
      `,
    );
    await expectRuntimeRejection(
      (database) => database`
        update app.onboarding_profile
        set target_companies = array['Example Plc', 'example plc']
        where user_id = ${userOne}::uuid
      `,
    );
    const unchanged = await asUser(userOne, (database) => findOnboardingProfile(database, userOne));
    expect(unchanged?.answers).toEqual(draft);
  });

  it("exposes helper execution only to the application role", async () => {
    for (const signature of [
      "app.onboarding_controlled_array_valid(text[],text[],integer)",
      "app.onboarding_target_companies_valid(text[])",
      "app.prevent_onboarding_completion_reversion()",
    ]) {
      const rows = await migrationDatabase<
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
          has_function_privilege('offerlab_identity_sync', ${signature}, 'execute') as identity_sync,
          has_function_privilege('offerlab_app', ${signature}, 'execute') as runtime
      `;
      expect(rows[0]).toEqual({
        anon: false,
        authenticated: false,
        identity_sync: false,
        public: false,
        runtime: true,
      });
    }
    const definitions = await migrationDatabase<{ security_definer: boolean }[]>`
      select prosecdef as security_definer
      from pg_proc
      where oid in (
        'app.onboarding_controlled_array_valid(text[],text[],integer)'::regprocedure,
        'app.onboarding_target_companies_valid(text[])'::regprocedure,
        'app.prevent_onboarding_completion_reversion()'::regprocedure
      )
    `;
    expect(definitions.every(({ security_definer }) => !security_definer)).toBe(true);
  });
});

function databaseArray(...values: string[]): string {
  return `array[${values.map((value) => `'${value}'`).join(",")}]::text[]`;
}
const nullIndustryArray = "array['consulting',null]::text[]";
const excessiveOpportunityArray =
  "array['graduate_scheme','internship','placement','entry_level_role','graduate_scheme']::text[]";
