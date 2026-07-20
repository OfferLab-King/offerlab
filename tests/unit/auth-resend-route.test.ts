import { NextRequest } from "next/server";
import type { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkAuthRateLimit: vi.fn(),
  getIdentitySyncDatabase: vi.fn(() => ({ purpose: "test" })),
  resend: vi.fn(),
}));

vi.mock("../../src/infrastructure/database/runtime-connections", () => ({
  getIdentitySyncDatabase: mocks.getIdentitySyncDatabase,
}));

vi.mock("../../src/infrastructure/supabase/route", () => ({
  createSupabaseRouteClient: () => ({
    applyTo: (response: NextResponse) => response,
    client: { auth: { resend: mocks.resend } },
  }),
}));

vi.mock("../../src/modules/identity-access/infrastructure/rate-limits", () => ({
  checkAuthRateLimit: mocks.checkAuthRateLimit,
}));

import { POST } from "../../src/app/api/auth/resend/route";

const generic = {
  message: "If the account is eligible, a new verification message has been sent.",
};

function resendRequest(email: string): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/resend", {
    body: JSON.stringify({ email }),
    headers: {
      "content-type": "application/json",
      host: "localhost:3000",
      origin: "http://localhost:3000",
    },
    method: "POST",
  });
}

describe("verification resend public boundary", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    mocks.checkAuthRateLimit.mockReset();
    mocks.resend.mockReset();
    mocks.checkAuthRateLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 900 });
    mocks.resend.mockResolvedValue({ error: null });
  });

  it("keeps the generic success response when Supabase reports a provider failure", async () => {
    mocks.resend.mockResolvedValue({ error: new Error("provider unavailable") });

    const response = await POST(resendRequest("candidate@example.com"));

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual(generic);
    expect(mocks.resend).toHaveBeenCalledOnce();
  });

  it("rate limits with the same public body and retry information", async () => {
    mocks.checkAuthRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 321 });

    const response = await POST(resendRequest("candidate@example.com"));

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("321");
    expect(await response.json()).toEqual(generic);
    expect(mocks.resend).not.toHaveBeenCalled();
  });

  it.each([
    ["cross origin", { origin: "https://attacker.invalid" }, 403],
    ["missing origin", { origin: "" }, 403],
    ["invalid host", { host: "attacker.invalid" }, 403],
    ["unsupported content type", { "content-type": "text/plain" }, 415],
  ])("rejects %s requests", async (_name, headers, status) => {
    const request = resendRequest("candidate@example.com");
    for (const [name, value] of Object.entries(headers)) {
      if (value) request.headers.set(name, value);
      else request.headers.delete(name);
    }
    const response = await POST(request);
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual(generic);
    expect(mocks.resend).not.toHaveBeenCalled();
  });

  it.each([
    ["oversized body", "x".repeat(4_097), 413],
    ["malformed JSON", "{", 400],
  ])("rejects %s", async (_name, body, status) => {
    const request = new NextRequest("http://localhost:3000/api/auth/resend", {
      body,
      headers: {
        "content-type": "application/json",
        host: "localhost:3000",
        origin: "http://localhost:3000",
      },
      method: "POST",
    });
    const response = await POST(request);
    expect(response.status).toBe(status);
    expect(mocks.resend).not.toHaveBeenCalled();
  });
});
