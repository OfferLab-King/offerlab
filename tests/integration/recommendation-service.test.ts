import postgres from "postgres";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { RecommendationApplicationContext } from "../../src/modules/applications/application/applications";
import * as recommendations from "../../src/modules/recommendations/application/recommendations";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const migrationDatabase = postgres(databaseUrl, { max: 3, prepare: false });
const runtimeUrl = new URL(databaseUrl);
runtimeUrl.username = "offerlab_runtime_login";
runtimeUrl.password = "postgres";

const ownerId = "20000000-0000-4000-8000-000000000001";
const otherOwnerId = "20000000-0000-4000-8000-000000000002";
const clock = { now: () => new Date("2026-07-20T12:00:00.000Z") };

async function createApplication(
  stage: RecommendationApplicationContext["stage"] = "interview",
): Promise<RecommendationApplicationContext> {
  const rows = await migrationDatabase<
    {
      application_deadline: string | null;
      applied_date: string | null;
      archived_at: Date | null;
      id: string;
      next_stage_deadline: string | null;
      opportunity_type: RecommendationApplicationContext["opportunityType"];
    }[]
  >`
    insert into app.application (
      owner_user_id, company_name, role_title, opportunity_type, current_stage,
      application_deadline, applied_date, next_stage_deadline
    ) values (
      ${ownerId}::uuid, 'Service Test Employer', 'Graduate Role', 'graduate_scheme', ${stage},
      '2026-07-31', '2026-07-01', '2026-07-23'
    )
    returning id, opportunity_type, application_deadline::text, applied_date::text,
      next_stage_deadline::text, archived_at
  `;
  const row = rows[0];
  if (!row) throw new Error("Expected a service-test application.");
  return {
    applicationDeadline: row.application_deadline,
    appliedDate: row.applied_date,
    archivedAt: row.archived_at,
    id: row.id,
    nextStageDeadline: row.next_stage_deadline,
    opportunityType: row.opportunity_type,
    stage,
  };
}

beforeAll(() => {
  process.env.DATABASE_URL = runtimeUrl.toString();
});

async function cleanupRecommendationFixtures() {
  await migrationDatabase`delete from app.audit_event where entity_type in ('recommendation_state', 'application')`;
  await migrationDatabase`delete from app.recommendation_state`;
  await migrationDatabase`delete from app.application`;
}

beforeEach(cleanupRecommendationFixtures);
afterEach(cleanupRecommendationFixtures);

afterAll(async () => {
  await migrationDatabase.end();
});

describe("recommendation service with production-equivalent persistence", () => {
  it("persists every meaningful transition, preserves unchanged versions, and audits exactly once", async () => {
    const application = await createApplication();
    const identity = {
      expectedVersion: null,
      recommendationKey: "interview_prepare_evidence_examples",
      ruleVersion: 1,
      targetState: "completed",
    } as const;
    await expect(
      recommendations.mutateRecommendationState(ownerId, application.id, identity, clock),
    ).resolves.toEqual({ outcome: "completed", stateVersion: 1 });
    await expect(
      recommendations.mutateRecommendationState(
        ownerId,
        application.id,
        { ...identity, expectedVersion: 1 },
        clock,
      ),
    ).resolves.toEqual({ outcome: "unchanged", stateVersion: 1 });
    await expect(
      recommendations.mutateRecommendationState(
        ownerId,
        application.id,
        { ...identity, expectedVersion: 1, targetState: "dismissed" },
        clock,
      ),
    ).resolves.toEqual({ outcome: "dismissed", stateVersion: 2 });
    await expect(
      recommendations.mutateRecommendationState(
        ownerId,
        application.id,
        { ...identity, expectedVersion: 2, targetState: "pending" },
        clock,
      ),
    ).resolves.toEqual({ outcome: "restored", stateVersion: 3 });

    const rows = await migrationDatabase<
      { action: string; metadata: object; state: string; version: number }[]
    >`
      select audit.action, audit.metadata, state.state, state.version
      from app.recommendation_state as state
      join app.audit_event as audit on audit.entity_id = state.id
      where state.application_id = ${application.id}::uuid
      order by audit.created_at, audit.action
    `;
    expect(rows).toEqual([
      { action: "recommendation.completed", metadata: {}, state: "pending", version: 3 },
      { action: "recommendation.dismissed", metadata: {}, state: "pending", version: 3 },
      { action: "recommendation.restored", metadata: {}, state: "pending", version: 3 },
    ]);
  });

  it("rejects invalid, wrong-stage, archived, stale, and cross-owner mutations", async () => {
    const application = await createApplication();
    const base = {
      expectedVersion: null,
      recommendationKey: "interview_prepare_evidence_examples",
      ruleVersion: 1,
      targetState: "completed",
    } as const;
    await expect(
      recommendations.mutateRecommendationState(
        ownerId,
        application.id,
        { ...base, recommendationKey: "unknown_key" },
        clock,
      ),
    ).resolves.toEqual({ outcome: "invalid" });
    await expect(
      recommendations.mutateRecommendationState(
        ownerId,
        application.id,
        { ...base, ruleVersion: 99 },
        clock,
      ),
    ).resolves.toEqual({ outcome: "invalid" });
    await expect(
      recommendations.mutateRecommendationState(
        ownerId,
        application.id,
        { ...base, recommendationKey: "preparing_confirm_deadline_plan" },
        clock,
      ),
    ).resolves.toEqual({ outcome: "not_applicable" });
    await expect(
      recommendations.mutateRecommendationState(otherOwnerId, application.id, base, clock),
    ).resolves.toEqual({ outcome: "not_found" });

    await recommendations.mutateRecommendationState(ownerId, application.id, base, clock);
    await expect(
      recommendations.mutateRecommendationState(
        ownerId,
        application.id,
        { ...base, expectedVersion: 99, targetState: "dismissed" },
        clock,
      ),
    ).resolves.toEqual({ outcome: "conflict" });

    await migrationDatabase`
      update app.application set archived_at = now(), updated_at = now()
      where id = ${application.id}::uuid
    `;
    await expect(
      recommendations.mutateRecommendationState(
        ownerId,
        application.id,
        { ...base, expectedVersion: 1, targetState: "dismissed" },
        clock,
      ),
    ).resolves.toEqual({ outcome: "not_applicable" });
  });

  it("gives concurrent first actions one committed winner and one conflict", async () => {
    const application = await createApplication();
    const action = (targetState: "completed" | "dismissed") =>
      recommendations.mutateRecommendationState(
        ownerId,
        application.id,
        {
          expectedVersion: null,
          recommendationKey: "interview_prepare_evidence_examples",
          ruleVersion: 1,
          targetState,
        },
        clock,
      );
    const outcomes = (await Promise.all([action("completed"), action("dismissed")])).map(
      ({ outcome }) => outcome,
    );
    expect(outcomes.filter((outcome) => outcome === "conflict")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome !== "conflict")).toEqual([
      expect.stringMatching(/completed|dismissed/),
    ]);
    const counts = await migrationDatabase<{ audits: number; states: number }[]>`
      select
        (select count(*)::int from app.recommendation_state) as states,
        (select count(*)::int from app.audit_event where entity_type = 'recommendation_state') as audits
    `;
    expect(counts).toEqual([{ audits: 1, states: 1 }]);
  });

  it("hides prior-stage state and restores it when the application returns to that stage", async () => {
    const application = await createApplication();
    await recommendations.mutateRecommendationState(
      ownerId,
      application.id,
      {
        expectedVersion: null,
        recommendationKey: "interview_prepare_evidence_examples",
        ruleVersion: 1,
        targetState: "completed",
      },
      clock,
    );
    const interview = await recommendations.readApplicationRecommendations(
      ownerId,
      application,
      clock,
    );
    expect(
      interview.find(({ identity }) => identity.key === "interview_prepare_evidence_examples"),
    ).toMatchObject({ state: "completed", stateVersion: 1 });

    const appliedContext = { ...application, stage: "applied" } as const;
    const applied = await recommendations.readApplicationRecommendations(
      ownerId,
      appliedContext,
      clock,
    );
    expect(applied.every(({ identity }) => identity.key.startsWith("applied_"))).toBe(true);
    expect(applied.every(({ state }) => state === "pending")).toBe(true);

    const returned = await recommendations.readApplicationRecommendations(
      ownerId,
      application,
      clock,
    );
    expect(
      returned.find(({ identity }) => identity.key === "interview_prepare_evidence_examples"),
    ).toMatchObject({ state: "completed", stateVersion: 1 });
  });

  it("returns no active recommendations for an archived application", async () => {
    const application = await createApplication();
    await expect(
      recommendations.readApplicationRecommendations(
        ownerId,
        { ...application, archivedAt: new Date("2026-07-20T13:00:00.000Z") },
        clock,
      ),
    ).resolves.toEqual([]);
  });
});
