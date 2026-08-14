import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticatedUserId: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("../../../infrastructure/analytics/capture", () => ({
  captureAnalyticsEvent: vi.fn(),
}));
vi.mock("../../../infrastructure/database/runtime-connections", () => ({
  getIdentitySyncDatabase: vi.fn(),
}));
vi.mock("../../../infrastructure/supabase/authenticated-user", () => ({
  getAuthenticatedSupabaseUserId: mocks.authenticatedUserId,
}));
vi.mock("../infrastructure/identity-linking", () => ({
  linkVerifiedIdentity: vi.fn(),
  readAuthorizationForIdentity: vi.fn(),
}));
vi.mock("../infrastructure/rate-limits", () => ({ checkAuthRateLimit: vi.fn() }));

import { currentAuthorization, currentMemberAccess } from "./authorization";

describe("member authorization", () => {
  beforeEach(() => {
    mocks.authenticatedUserId.mockReset();
  });

  afterEach(() => vi.unstubAllEnvs());

  it("treats a missing Supabase session as unauthenticated", async () => {
    mocks.authenticatedUserId.mockResolvedValue(null);
    await expect(currentAuthorization()).resolves.toBeNull();
    await expect(currentMemberAccess()).resolves.toEqual({ status: "unauthenticated" });
  });
});
