import { NextRequest, type NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  capture: vi.fn(),
  getUser: vi.fn(),
  signUp: vi.fn(),
  link: vi.fn(),
  rate: vi.fn(),
}));
vi.mock("../../src/infrastructure/analytics/capture", () => ({
  captureAnalyticsEvent: mocks.capture,
}));
vi.mock("../../src/infrastructure/database/runtime-connections", () => ({
  getIdentitySyncDatabase: () => ({}),
}));
vi.mock("../../src/infrastructure/supabase/route", () => ({
  createSupabaseRouteClient: () => ({
    applyTo: (response: NextResponse) => response,
    client: { auth: { getUser: mocks.getUser, signUp: mocks.signUp } },
  }),
}));
vi.mock("../../src/modules/identity-access/infrastructure/identity-linking", () => ({
  linkVerifiedIdentity: mocks.link,
}));
vi.mock("../../src/modules/identity-access/infrastructure/rate-limits", () => ({
  checkAuthRateLimit: mocks.rate,
}));
import { POST } from "../../src/app/api/auth/register/route";
function request(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/auth/register", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "localhost:3000",
      origin: "http://localhost:3000",
    },
    body: JSON.stringify(body),
  });
}
describe("open member registration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    mocks.rate.mockResolvedValue({ allowed: true });
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    mocks.signUp.mockResolvedValue({
      data: { session: null, user: { id: "auth-new", email_confirmed_at: null } },
      error: null,
    });
    mocks.link.mockResolvedValue({
      userId: "member-new",
      role: "member",
      entitlementStatus: "active",
    });
  });
  it("registers without an invitation and requests configured email confirmation", async () => {
    const response = await POST(
      request({ email: "NEW@example.com", password: "StrongPassword123!" }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ next: "/verify-email?registered=1" });
    expect(mocks.signUp).toHaveBeenCalledWith({
      email: "new@example.com",
      password: "StrongPassword123!",
      options: { emailRedirectTo: "http://localhost:3000/auth/callback?next=/member" },
    });
    expect(mocks.link).not.toHaveBeenCalled();
  });
  it("ignores fake invite-shaped input", async () => {
    const response = await POST(
      request({
        email: "new@example.com",
        password: "StrongPassword123!",
        invitation: "fake-secret",
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.signUp).toHaveBeenCalledOnce();
    expect(mocks.rate.mock.calls.flat().join(" ")).not.toContain("fake-secret");
  });
  it("links immediate-login registrations through the same member identity flow", async () => {
    mocks.signUp.mockResolvedValue({
      data: {
        session: { access_token: "local" },
        user: { id: "auth-new", email_confirmed_at: "2026-01-01" },
      },
      error: null,
    });
    const response = await POST(
      request({ email: "new@example.com", password: "StrongPassword123!" }),
    );
    expect(await response.json()).toEqual({ next: "/member" });
    expect(mocks.link).toHaveBeenCalledWith({}, "auth-new");
    expect(mocks.capture).toHaveBeenCalledWith("identity_linked");
  });
});
