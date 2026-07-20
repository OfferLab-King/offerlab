import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentMemberAccess: vi.fn(),
  readOnboardingProfile: vi.fn(),
  updateOnboardingProfile: vi.fn(),
}));

vi.mock("../../src/modules/identity-access/application/authorization", () => ({
  currentMemberAccess: mocks.currentMemberAccess,
}));
vi.mock("../../src/modules/member-profile/application/onboarding", () => ({
  readOnboardingProfile: mocks.readOnboardingProfile,
  updateOnboardingProfile: mocks.updateOnboardingProfile,
}));

import { GET, PUT } from "../../src/app/api/member/onboarding/route";

const eligible = {
  authorization: { entitlementStatus: "active", role: "member", userId: "internal-user" },
  status: "eligible",
} as const;

function request(body: unknown): Request {
  return new Request("http://localhost:3000/api/member/onboarding", {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      host: "localhost:3000",
      origin: "http://localhost:3000",
    },
    method: "PUT",
  });
}

describe("direct onboarding endpoint authorization", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    mocks.currentMemberAccess.mockReset();
    mocks.readOnboardingProfile.mockReset();
    mocks.updateOnboardingProfile.mockReset();
  });

  it.each([
    ["unauthenticated", 401],
    ["unverified", 403],
    ["denied", 403],
  ] as const)("rejects %s reads and writes", async (status, responseStatus) => {
    mocks.currentMemberAccess.mockResolvedValue({ status });
    const getResponse = await GET();
    const putResponse = await PUT(request({ intent: "save" }));
    expect(getResponse.status).toBe(responseStatus);
    expect(putResponse.status).toBe(responseStatus);
    expect(mocks.readOnboardingProfile).not.toHaveBeenCalled();
    expect(mocks.updateOnboardingProfile).not.toHaveBeenCalled();
  });

  it("uses only the server-authorized internal owner ID", async () => {
    mocks.currentMemberAccess.mockResolvedValue(eligible);
    mocks.updateOnboardingProfile.mockResolvedValue({
      ok: true,
      outcome: "saved_incomplete",
      profile: { completedAt: null },
    });
    const response = await PUT(request({ intent: "save", userId: "attacker-selected" }));
    expect(response.status).toBe(200);
    expect(mocks.updateOnboardingProfile).toHaveBeenCalledWith("internal-user", {
      intent: "save",
      userId: "attacker-selected",
    });
  });

  it("rejects cross-origin direct mutations before authorization", async () => {
    const direct = request({ intent: "save" });
    direct.headers.set("origin", "https://attacker.invalid");
    const response = await PUT(direct);
    expect(response.status).toBe(403);
    expect(mocks.currentMemberAccess).not.toHaveBeenCalled();
  });
});
