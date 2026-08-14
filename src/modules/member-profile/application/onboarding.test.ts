import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findOnboardingProfile: vi.fn(),
  withApplicationUser: vi.fn(),
}));

vi.mock("../../../infrastructure/analytics/capture", () => ({
  captureAnalyticsEvent: vi.fn(),
}));
vi.mock("../../../infrastructure/database/runtime-connections", () => ({
  withApplicationUser: mocks.withApplicationUser,
}));
vi.mock("../infrastructure/onboarding-repository", () => ({
  findOnboardingProfile: mocks.findOnboardingProfile,
  saveOnboardingProfile: vi.fn(),
}));

import { readOnboardingProfile } from "./onboarding";

describe("onboarding profile reads", () => {
  beforeEach(() => {
    mocks.withApplicationUser.mockImplementation(
      async (_owner: string, operation: (database: unknown) => Promise<unknown>) => operation({}),
    );
    mocks.findOnboardingProfile.mockResolvedValue(null);
  });

  afterEach(() => vi.unstubAllEnvs());

  it("returns the stored owner-scoped profile when one exists", async () => {
    const stored = { completedAt: new Date("2026-08-09T00:00:00.000Z") };
    mocks.findOnboardingProfile.mockResolvedValue(stored);

    await expect(readOnboardingProfile("20000000-0000-4000-8000-000000000003")).resolves.toBe(
      stored,
    );
  });

  it("returns null when no profile is stored", async () => {
    await expect(readOnboardingProfile("20000000-0000-4000-8000-000000000002")).resolves.toBeNull();
  });
});
