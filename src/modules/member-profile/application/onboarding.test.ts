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

describe("local development onboarding profile", () => {
  beforeEach(() => {
    vi.stubEnv("APP_ENV", "local");
    vi.stubEnv("LOCAL_AUTH_BYPASS_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://127.0.0.1:3000");
    vi.stubEnv("NODE_ENV", "development");
    mocks.withApplicationUser.mockImplementation(
      async (_owner: string, operation: (database: unknown) => Promise<unknown>) => operation({}),
    );
    mocks.findOnboardingProfile.mockResolvedValue(null);
  });

  afterEach(() => vi.unstubAllEnvs());

  it("supplies a completed synthetic profile only for the bypass member", async () => {
    await expect(
      readOnboardingProfile("20000000-0000-4000-8000-000000000003"),
    ).resolves.toMatchObject({
      answers: {
        educationStage: "recent_graduate",
        preparationPriorities: ["application_cv"],
      },
      completedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    await expect(readOnboardingProfile("20000000-0000-4000-8000-000000000002")).resolves.toBeNull();
  });

  it("prefers a stored owner-scoped profile when one exists", async () => {
    const stored = { completedAt: new Date("2026-08-09T00:00:00.000Z") };
    mocks.findOnboardingProfile.mockResolvedValue(stored);

    await expect(readOnboardingProfile("20000000-0000-4000-8000-000000000003")).resolves.toBe(
      stored,
    );
  });
});
