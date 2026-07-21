import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  analytics: vi.fn(),
  listStates: vi.fn(),
  lockApplication: vi.fn(),
  transition: vi.fn(),
}));

vi.mock("../../../infrastructure/analytics/capture", () => ({
  captureAnalyticsEvent: mocks.analytics,
}));
vi.mock("../../../infrastructure/database/runtime-connections", () => ({
  withApplicationUser: (_ownerId: string, operation: (database: object) => unknown) =>
    operation({ transaction: true }),
}));
vi.mock("../../applications/application/applications", () => ({
  lockApplicationForRecommendationMutation: mocks.lockApplication,
}));
vi.mock("../infrastructure/recommendation-state-repository", () => ({
  listRecommendationStates: mocks.listStates,
  transitionRecommendationState: mocks.transition,
}));

import {
  mutateRecommendationState,
  readApplicationRecommendations,
  readDashboardRecommendations,
} from "./recommendations";
import type { RecommendationDefinition } from "../domain/catalogue";

const ownerId = "20000000-0000-4000-8000-000000000001";
const applicationId = "10000000-0000-4000-8000-000000000001";
const application = {
  appliedDate: "2026-07-01",
  applicationDeadline: "2026-07-31",
  archivedAt: null,
  id: applicationId,
  nextStageDeadline: "2026-07-23",
  opportunityType: "graduate_scheme",
  stage: "interview",
} as const;
const clock = { now: () => new Date("2026-07-20T12:00:00.000Z") };
const mutation = {
  expectedVersion: null,
  recommendationKey: "interview_prepare_evidence_examples",
  ruleVersion: 1,
  targetState: "completed",
} as const;

function controlledDefinition(
  key: string,
  priority: number,
  stage: "applied" | "interview" = "interview",
): RecommendationDefinition {
  const title = `Controlled action ${key}`;
  return {
    accessibilityLabels: {
      complete: `Mark “${title}” as completed.`,
      dismiss: `Dismiss “${title}” recommendation.`,
      restore: `Restore “${title}” to pending.`,
    },
    active: true,
    applicability: [{ active: true }],
    explanationTemplate: "Controlled static explanation.",
    guidance: "Controlled static guidance.",
    key,
    priority,
    ruleVersion: 1,
    stages: [stage],
    title,
    urgencyEligible: false,
  };
}

describe("recommendation application service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listStates.mockResolvedValue([]);
    mocks.lockApplication.mockResolvedValue(application);
    mocks.transition.mockResolvedValue({
      outcome: "completed",
      recommendationState: { version: 1 },
    });
  });

  it("merges absence as pending and a persisted state by stable identity", async () => {
    mocks.listStates.mockResolvedValue([
      {
        applicationId,
        recommendationKey: "interview_prepare_evidence_examples",
        ruleVersion: 1,
        state: "completed",
        version: 4,
      },
    ]);
    const recommendations = await readApplicationRecommendations(ownerId, application, clock);
    expect(recommendations).toHaveLength(3);
    expect(
      recommendations.find(
        ({ identity }) => identity.key === "interview_prepare_evidence_examples",
      ),
    ).toMatchObject({ state: "completed", stateVersion: 4 });
    expect(recommendations.filter(({ state }) => state === "pending")).toHaveLength(2);
    expect(mocks.listStates).toHaveBeenCalledWith(expect.anything(), ownerId, [applicationId]);
  });

  it("filters non-pending state before the dashboard limit", async () => {
    mocks.listStates.mockResolvedValue([
      {
        applicationId,
        recommendationKey: "interview_prepare_evidence_examples",
        ruleVersion: 1,
        state: "dismissed",
        version: 2,
      },
    ]);
    const recommendations = await readDashboardRecommendations(ownerId, [application], clock);
    expect(recommendations).toHaveLength(2);
    expect(recommendations.every(({ state }) => state === "pending")).toBe(true);
    expect(
      recommendations.some(
        ({ identity }) => identity.key === "interview_prepare_evidence_examples",
      ),
    ).toBe(false);
  });

  it("caps only pending current-stage actions after overlaying durable state", async () => {
    const catalogue = [
      controlledDefinition("completed_high", 900),
      controlledDefinition("dismissed_high", 800),
      ...[5, 4, 3, 2, 1].map((rank) => controlledDefinition(`pending_${rank}`, rank * 100)),
      controlledDefinition("prior_stage", 1_000, "applied"),
    ];
    mocks.listStates.mockResolvedValue([
      {
        applicationId,
        recommendationKey: "completed_high",
        ruleVersion: 1,
        state: "completed",
        version: 2,
      },
      {
        applicationId,
        recommendationKey: "dismissed_high",
        ruleVersion: 1,
        state: "dismissed",
        version: 3,
      },
      {
        applicationId,
        recommendationKey: "prior_stage",
        ruleVersion: 1,
        state: "completed",
        version: 4,
      },
    ]);

    const result = await readApplicationRecommendations(ownerId, application, clock, catalogue);
    expect(
      result.filter(({ state }) => state === "pending").map(({ identity }) => identity.key),
    ).toEqual(["pending_5", "pending_4", "pending_3", "pending_2", "pending_1"]);
    expect(
      result.filter(({ state }) => state === "completed").map(({ identity }) => identity.key),
    ).toEqual(["completed_high"]);
    expect(
      result.filter(({ state }) => state === "dismissed").map(({ identity }) => identity.key),
    ).toEqual(["dismissed_high"]);
    expect(result.some(({ identity }) => identity.key === "prior_stage")).toBe(false);
  });

  it.each([
    ["completed", "recommendation_completed"],
    ["dismissed", "recommendation_dismissed"],
    ["restored", "recommendation_restored"],
  ] as const)(
    "captures one property-free analytic after a committed %s",
    async (outcome, event) => {
      mocks.transition.mockResolvedValue({
        outcome,
        recommendationState: { version: 2 },
      });
      await expect(
        mutateRecommendationState(ownerId, applicationId, mutation, clock),
      ).resolves.toEqual({ outcome, stateVersion: 2 });
      expect(mocks.analytics).toHaveBeenCalledOnce();
      expect(mocks.analytics).toHaveBeenCalledWith(event);
    },
  );

  it.each(["unchanged", "conflict"] as const)(
    "does not capture analytics for %s",
    async (outcome) => {
      mocks.transition.mockResolvedValue(
        outcome === "conflict" ? { outcome } : { outcome, recommendationState: { version: 1 } },
      );
      await mutateRecommendationState(ownerId, applicationId, mutation, clock);
      expect(mocks.analytics).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["unknown_key", 1],
    ["interview_prepare_evidence_examples", 99],
  ] as const)("rejects an invalid catalogue identity", async (recommendationKey, ruleVersion) => {
    await expect(
      mutateRecommendationState(
        ownerId,
        applicationId,
        { ...mutation, recommendationKey, ruleVersion },
        clock,
      ),
    ).resolves.toEqual({ outcome: "invalid" });
    expect(mocks.transition).not.toHaveBeenCalled();
    expect(mocks.analytics).not.toHaveBeenCalled();
  });

  it("rejects a key that does not apply to the current stage", async () => {
    await expect(
      mutateRecommendationState(
        ownerId,
        applicationId,
        { ...mutation, recommendationKey: "preparing_confirm_deadline_plan" },
        clock,
      ),
    ).resolves.toEqual({ outcome: "not_applicable" });
    expect(mocks.transition).not.toHaveBeenCalled();
  });

  it("rejects archived and cross-owner-hidden applications before state access", async () => {
    mocks.lockApplication.mockResolvedValueOnce({ ...application, archivedAt: new Date() });
    await expect(
      mutateRecommendationState(ownerId, applicationId, mutation, clock),
    ).resolves.toEqual({ outcome: "not_applicable" });
    mocks.lockApplication.mockResolvedValueOnce(null);
    await expect(
      mutateRecommendationState(ownerId, applicationId, mutation, clock),
    ).resolves.toEqual({ outcome: "not_found" });
    expect(mocks.transition).not.toHaveBeenCalled();
    expect(mocks.analytics).not.toHaveBeenCalled();
  });
});
