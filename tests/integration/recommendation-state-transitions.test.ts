import postgres, { type Sql, type TransactionSql } from "postgres";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ApplicationValues } from "../../src/modules/applications/domain/application";
import { createApplication } from "../../src/modules/applications/infrastructure/application-repository";
import {
  listRecommendationStates,
  transitionRecommendationState,
} from "../../src/modules/recommendations/infrastructure/recommendation-state-repository";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const migrationDatabase = postgres(databaseUrl, { max: 2, prepare: false });
const runtimeUrl = new URL(databaseUrl);
runtimeUrl.username = "offerlab_runtime_login";
runtimeUrl.password = "postgres";
const runtimeDatabase = postgres(runtimeUrl.toString(), { max: 2, prepare: false });
const concurrentOne = postgres(runtimeUrl.toString(), { max: 1, prepare: false });
const concurrentTwo = postgres(runtimeUrl.toString(), { max: 1, prepare: false });

const ownerId = "20000000-0000-4000-8000-000000000001";
const applicationValues: ApplicationValues = {
  appliedDate: "2026-07-01",
  applicationDeadline: "2026-07-10",
  company: "State Test Employer",
  companyId: null,
  industry: null,
  location: null,
  nextStageDeadline: "2026-07-22",
  notes: null,
  opportunityType: "graduate_scheme",
  role: "Graduate Role",
  stage: "interview",
};

async function asUser<T>(
  operation: (database: TransactionSql) => PromiseLike<T>,
  connection: Sql = runtimeDatabase,
): Promise<T> {
  return (await connection.begin(async (transaction) => {
    await transaction`set local role offerlab_app`;
    await transaction`select set_config('app.current_user_id', ${ownerId}, true)`;
    return operation(transaction);
  })) as T;
}

async function createTestApplication(): Promise<string> {
  const result = await asUser((database) =>
    createApplication(database, ownerId, applicationValues),
  );
  if (!("application" in result)) throw new Error("Expected an application.");
  return result.application.id;
}

function transition(
  applicationId: string,
  targetState: "pending" | "completed" | "dismissed",
  expectedVersion: number | null,
  connection?: Sql,
) {
  return asUser(
    (database) =>
      transitionRecommendationState(database, {
        applicationId,
        expectedVersion,
        ownerId,
        recommendationKey: "interview_prepare_examples",
        ruleVersion: 1,
        targetState,
      }),
    connection,
  );
}

async function recommendationAudits() {
  return migrationDatabase<{ action: string; entity_id: string; metadata: object }[]>`
    select action, entity_id, metadata from app.audit_event
    where entity_type = 'recommendation_state'
    order by created_at, action
  `;
}

async function cleanupRecommendationFixtures() {
  await migrationDatabase`delete from app.audit_event where entity_type in ('recommendation_state', 'application')`;
  await migrationDatabase`delete from app.recommendation_state`;
  await migrationDatabase`delete from app.application`;
}

beforeEach(cleanupRecommendationFixtures);
afterEach(cleanupRecommendationFixtures);

afterAll(async () => {
  await Promise.all([
    migrationDatabase.end(),
    runtimeDatabase.end(),
    concurrentOne.end(),
    concurrentTwo.end(),
  ]);
});

describe("recommendation-state repository transitions", () => {
  it.each(["completed", "dismissed"] as const)(
    "creates one durable row for first %s and audits exactly once",
    async (targetState) => {
      const applicationId = await createTestApplication();
      const result = await transition(applicationId, targetState, null);
      expect(result).toMatchObject({
        outcome: targetState,
        recommendationState: { state: targetState, version: 1 },
      });
      const rows = await asUser((database) =>
        listRecommendationStates(database, ownerId, [applicationId]),
      );
      expect(rows).toHaveLength(1);
      expect(await recommendationAudits()).toEqual([
        {
          action: `recommendation.${targetState}`,
          entity_id: rows[0]?.id,
          metadata: {},
        },
      ]);
    },
  );

  it("supports completion, dismissal, and restoration with one version increment each", async () => {
    const applicationId = await createTestApplication();
    expect(await transition(applicationId, "completed", null)).toMatchObject({
      outcome: "completed",
      recommendationState: { version: 1 },
    });
    expect(await transition(applicationId, "dismissed", 1)).toMatchObject({
      outcome: "dismissed",
      recommendationState: { completedAt: null, state: "dismissed", version: 2 },
    });
    expect(await transition(applicationId, "completed", 2)).toMatchObject({
      outcome: "completed",
      recommendationState: { dismissedAt: null, state: "completed", version: 3 },
    });
    expect(await transition(applicationId, "pending", 3)).toMatchObject({
      outcome: "restored",
      recommendationState: {
        completedAt: null,
        dismissedAt: null,
        state: "pending",
        version: 4,
      },
    });
    expect((await recommendationAudits()).map(({ action }) => action)).toEqual([
      "recommendation.completed",
      "recommendation.dismissed",
      "recommendation.completed",
      "recommendation.restored",
    ]);
  });

  it.each([
    ["completed", "completed"],
    ["dismissed", "dismissed"],
  ] as const)("classifies repeated %s as unchanged", async (initial, repeated) => {
    const applicationId = await createTestApplication();
    const first = await transition(applicationId, initial, null);
    if (!("recommendationState" in first) || !first.recommendationState) {
      throw new Error("Expected a persisted state.");
    }
    const before = first.recommendationState;
    const result = await transition(applicationId, repeated, before.version);
    expect(result).toMatchObject({
      outcome: "unchanged",
      recommendationState: { updatedAt: before.updatedAt, version: before.version },
    });
    expect(await recommendationAudits()).toHaveLength(1);
  });

  it("treats restoration without a row as unchanged and does not persist", async () => {
    const applicationId = await createTestApplication();
    await expect(transition(applicationId, "pending", null)).resolves.toEqual({
      outcome: "unchanged",
      recommendationState: null,
    });
    await expect(
      asUser((database) => listRecommendationStates(database, ownerId, [applicationId])),
    ).resolves.toEqual([]);
    await expect(recommendationAudits()).resolves.toEqual([]);
  });

  it("returns a generic conflict for stale or falsely absent state", async () => {
    const applicationId = await createTestApplication();
    await transition(applicationId, "completed", null);
    await expect(transition(applicationId, "dismissed", null)).resolves.toEqual({
      outcome: "conflict",
    });
    await expect(transition(applicationId, "dismissed", 99)).resolves.toEqual({
      outcome: "conflict",
    });
    expect(await recommendationAudits()).toHaveLength(1);
  });

  it("gives concurrent first actions one winner and one conflict", async () => {
    const applicationId = await createTestApplication();
    const results = await Promise.all([
      transition(applicationId, "completed", null, concurrentOne),
      transition(applicationId, "dismissed", null, concurrentTwo),
    ]);
    const outcomes = results.map(({ outcome }) => outcome);
    expect(outcomes.filter((outcome) => outcome === "conflict")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome !== "conflict")).toEqual([
      expect.stringMatching(/completed|dismissed/),
    ]);
    const rows = await asUser((database) =>
      listRecommendationStates(database, ownerId, [applicationId]),
    );
    expect(rows).toHaveLength(1);
    expect(await recommendationAudits()).toHaveLength(1);
  });

  it("rolls back a meaningful state mutation when audit insertion fails", async () => {
    const applicationId = await createTestApplication();
    await migrationDatabase`revoke insert on app.audit_event from offerlab_app`;
    try {
      await expect(transition(applicationId, "completed", null)).rejects.toThrow();
    } finally {
      await migrationDatabase`
        grant insert (actor_user_id, action, entity_type, entity_id, metadata)
        on app.audit_event to offerlab_app
      `;
    }
    await expect(
      asUser((database) => listRecommendationStates(database, ownerId, [applicationId])),
    ).resolves.toEqual([]);
    await expect(recommendationAudits()).resolves.toEqual([]);
  });
});
