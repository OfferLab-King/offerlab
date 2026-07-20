import { NextRequest, type NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  capture: vi.fn(),
  clearLocalAuthCookies: vi.fn((response: NextResponse) => {
    response.headers.set("x-test-cookies-cleared", "true");
    return response;
  }),
  errorLog: vi.fn(),
  getClaims: vi.fn(),
  signOut: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("../../src/infrastructure/analytics/capture", () => ({
  captureAnalyticsEvent: mocks.capture,
}));
vi.mock("../../src/infrastructure/logging/logger", () => ({
  logger: { error: mocks.errorLog },
}));
vi.mock("../../src/infrastructure/supabase/route", () => ({
  createSupabaseRouteClient: () => ({
    applyTo: (response: NextResponse) => response,
    clearLocalAuthCookies: mocks.clearLocalAuthCookies,
    client: {
      auth: {
        getClaims: mocks.getClaims,
        signOut: mocks.signOut,
        updateUser: mocks.updateUser,
      },
    },
  }),
}));

import { POST } from "../../src/app/api/auth/update-password/route";

function request(): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/update-password", {
    body: JSON.stringify({ password: "new-secure-password" }),
    headers: {
      "content-type": "application/json",
      host: "localhost:3000",
      origin: "http://localhost:3000",
    },
    method: "POST",
  });
}

describe("password update partial failures", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    mocks.capture.mockReset();
    mocks.clearLocalAuthCookies.mockClear();
    mocks.errorLog.mockReset();
    mocks.getClaims.mockReset();
    mocks.signOut.mockReset();
    mocks.updateUser.mockReset();
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "auth-user" } }, error: null });
    mocks.updateUser.mockResolvedValue({ error: null });
    mocks.signOut.mockResolvedValue({ error: null });
  });

  it("updates the password and logs out", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ updated: true });
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });

  it("does not log out or report success when the password update fails", async () => {
    mocks.updateUser.mockResolvedValue({ error: new Error("provider failure") });
    const response = await POST(request());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ updated: false });
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("clears local cookies and gives safe guidance when provider logout fails", async () => {
    mocks.signOut.mockResolvedValue({ error: new Error("provider logout failure") });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("x-test-cookies-cleared")).toBe("true");
    expect(await response.json()).toMatchObject({ signedOut: false, updated: true });
    expect(mocks.clearLocalAuthCookies).toHaveBeenCalledOnce();
    expect(mocks.errorLog).toHaveBeenCalledWith(
      { event: "password_update_logout_failed" },
      "Provider logout failed after password update",
    );
  });
});
