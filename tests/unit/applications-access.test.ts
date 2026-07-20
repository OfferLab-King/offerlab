import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  profile: vi.fn(),
}));

vi.mock("../../src/modules/identity-access/application/authorization", () => ({
  currentMemberAccess: mocks.access,
}));
vi.mock("../../src/modules/member-profile/application/onboarding", () => ({
  readOnboardingProfile: mocks.profile,
}));

import { applicationApiOwner } from "../../src/app/api/member/applications/access";

describe("application endpoint access gate", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["unauthenticated", 401],
    ["unverified", 403],
    ["denied", 403],
  ] as const)("rejects %s access", async (status, responseStatus) => {
    mocks.access.mockResolvedValue({ status });
    const result = await applicationApiOwner();
    expect(result).toHaveProperty("response");
    if (!("response" in result)) throw new Error("Expected an access response.");
    expect(result.response.status).toBe(responseStatus);
    expect(mocks.profile).not.toHaveBeenCalled();
  });

  it("rejects an entitled member with incomplete onboarding", async () => {
    mocks.access.mockResolvedValue({
      authorization: { userId: "server-owner" },
      status: "eligible",
    });
    mocks.profile.mockResolvedValue({ completedAt: null });
    const result = await applicationApiOwner();
    if (!("response" in result)) throw new Error("Expected an access response.");
    expect(result.response.status).toBe(403);
    await expect(result.response.json()).resolves.toEqual({
      message: "Complete onboarding before tracking applications.",
    });
  });

  it("returns only the authenticated internal owner after completed onboarding", async () => {
    mocks.access.mockResolvedValue({
      authorization: { userId: "server-owner" },
      status: "eligible",
    });
    mocks.profile.mockResolvedValue({ completedAt: new Date() });
    await expect(applicationApiOwner()).resolves.toEqual({ ownerId: "server-owner" });
    expect(mocks.profile).toHaveBeenCalledWith("server-owner");
  });
});
