import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticatedUserId: vi.fn(),
  headers: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
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

describe("local development authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("APP_ENV", "local");
    vi.stubEnv("LOCAL_AUTH_BYPASS_ENABLED", "true");
    vi.stubEnv("LOCAL_AUTH_BYPASS_REQUEST_SECRET", "local-test-request-secret");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://127.0.0.1:3000");
    vi.stubEnv("NODE_ENV", "development");
    mocks.headers.mockResolvedValue(
      new Headers({
        cookie: "offerlab-local-bypass=local-test-request-secret",
        host: "127.0.0.1:3000",
        "x-offerlab-local-client-address": "127.0.0.1",
      }),
    );
    mocks.authenticatedUserId.mockResolvedValue(null);
  });

  afterEach(() => vi.unstubAllEnvs());

  it("returns the deterministic member without reading a Supabase session", async () => {
    await expect(currentAuthorization()).resolves.toEqual({
      entitlementStatus: "active",
      role: "member",
      userId: "20000000-0000-4000-8000-000000000003",
    });
    await expect(currentMemberAccess()).resolves.toMatchObject({
      authorization: { userId: "20000000-0000-4000-8000-000000000003" },
      status: "eligible",
    });
    expect(mocks.authenticatedUserId).not.toHaveBeenCalled();
  });

  it("returns the deterministic administrator only for a loopback bypass request", async () => {
    vi.stubEnv("LOCAL_AUTH_BYPASS_ROLE", "administrator");

    await expect(currentAuthorization()).resolves.toEqual({
      entitlementStatus: "active",
      role: "administrator",
      userId: "20000000-0000-4000-8000-000000000003",
    });
    expect(mocks.authenticatedUserId).not.toHaveBeenCalled();
  });

  it("returns the launcher-selected administrator without reading a Supabase session", async () => {
    vi.stubEnv("LOCAL_AUTH_BYPASS_ROLE", "administrator");
    vi.stubEnv("LOCAL_AUTH_BYPASS_USER_ID", "20000000-0000-4000-8000-000000000001");

    await expect(currentAuthorization()).resolves.toEqual({
      entitlementStatus: "active",
      role: "administrator",
      userId: "20000000-0000-4000-8000-000000000001",
    });
    expect(mocks.authenticatedUserId).not.toHaveBeenCalled();
  });

  it("refuses bypass requests arriving through a non-loopback host", async () => {
    vi.stubEnv("LOCAL_AUTH_BYPASS_ROLE", "administrator");
    mocks.headers.mockResolvedValue(
      new Headers({
        cookie: "offerlab-local-bypass=local-test-request-secret",
        host: "127.attacker.invalid:3000",
        "x-offerlab-local-client-address": "127.0.0.1",
      }),
    );

    await expect(currentMemberAccess()).resolves.toEqual({ status: "unauthenticated" });
    expect(mocks.authenticatedUserId).toHaveBeenCalledOnce();
  });

  it("refuses bypass requests from a non-loopback client behind a loopback Host", async () => {
    vi.stubEnv("LOCAL_AUTH_BYPASS_ROLE", "administrator");
    mocks.headers.mockResolvedValue(
      new Headers({
        cookie: "offerlab-local-bypass=local-test-request-secret",
        host: "127.0.0.1:3000",
        "x-offerlab-local-client-address": "203.0.113.10",
      }),
    );

    await expect(currentMemberAccess()).resolves.toEqual({ status: "unauthenticated" });
    expect(mocks.authenticatedUserId).toHaveBeenCalledOnce();
  });

  it("refuses a spoofed forwarding address without launcher-stamped transport proof", async () => {
    vi.stubEnv("LOCAL_AUTH_BYPASS_ROLE", "administrator");
    mocks.headers.mockResolvedValue(
      new Headers({
        host: "127.0.0.1:3000",
        "x-forwarded-for": "127.0.0.1",
        "x-offerlab-local-client-address": "127.0.0.1",
      }),
    );

    await expect(currentMemberAccess()).resolves.toEqual({ status: "unauthenticated" });
    expect(mocks.authenticatedUserId).toHaveBeenCalledOnce();
  });
});
