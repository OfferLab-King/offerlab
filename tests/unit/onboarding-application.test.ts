import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  capture: vi.fn(),
  save: vi.fn(),
  withApplicationUser: vi.fn(),
}));

vi.mock("../../src/infrastructure/analytics/capture", () => ({
  captureAnalyticsEvent: mocks.capture,
}));
vi.mock("../../src/infrastructure/database/runtime-connections", () => ({
  withApplicationUser: mocks.withApplicationUser,
}));
vi.mock("../../src/modules/member-profile/infrastructure/onboarding-repository", () => ({
  findOnboardingProfile: vi.fn(),
  saveOnboardingProfile: mocks.save,
}));

import { updateOnboardingProfile } from "../../src/modules/member-profile/application/onboarding";

const input = {
  confidence: null,
  educationStage: "undergraduate",
  industries: ["consulting"],
  intent: "complete",
  opportunityTypes: ["graduate_scheme"],
  preparationPriorities: ["application_cv"],
  supportNeeds: [],
  targetCompanies: [],
};
const profile = {
  answers: {},
  completedAt: new Date("2026-07-20T12:00:00Z"),
  createdAt: new Date("2026-07-20T12:00:00Z"),
  updatedAt: new Date("2026-07-20T12:00:00Z"),
};

describe("onboarding analytics transitions", () => {
  beforeEach(() => {
    mocks.capture.mockReset();
    mocks.save.mockReset();
    mocks.withApplicationUser.mockReset();
    mocks.withApplicationUser.mockImplementation(
      async (_ownerId: string, operation: (database: unknown) => Promise<unknown>) =>
        operation({ purpose: "test transaction" }),
    );
  });

  it.each([
    ["saved_incomplete", "onboarding_started"],
    ["saved_incomplete", "onboarding_saved"],
    ["completed", "onboarding_completed"],
    ["updated", "onboarding_updated"],
  ] as const)("captures %s transition event once", async (outcome, analyticsEvent) => {
    mocks.save.mockResolvedValue({ analyticsEvent, ok: true, outcome, profile });
    await expect(updateOnboardingProfile("owner", input)).resolves.toMatchObject({ outcome });
    expect(mocks.capture).toHaveBeenCalledOnce();
    expect(mocks.capture).toHaveBeenCalledWith(analyticsEvent);
  });

  it("does not capture an unchanged retry", async () => {
    mocks.save.mockResolvedValue({
      analyticsEvent: null,
      ok: true,
      outcome: "unchanged",
      profile,
    });
    await updateOnboardingProfile("owner", input);
    expect(mocks.capture).not.toHaveBeenCalled();
  });

  it("does not capture when persistence or commit fails", async () => {
    mocks.save.mockRejectedValueOnce(new Error("persistence failed"));
    await expect(updateOnboardingProfile("owner", input)).rejects.toThrow("persistence failed");
    expect(mocks.capture).not.toHaveBeenCalled();

    mocks.save.mockResolvedValueOnce({
      analyticsEvent: "onboarding_completed",
      ok: true,
      outcome: "completed",
      profile,
    });
    mocks.withApplicationUser.mockImplementationOnce(
      async (_ownerId: string, operation: (database: unknown) => Promise<unknown>) => {
        await operation({ purpose: "test transaction" });
        throw new Error("commit failed");
      },
    );
    await expect(updateOnboardingProfile("owner", input)).rejects.toThrow("commit failed");
    expect(mocks.capture).not.toHaveBeenCalled();
  });
});
