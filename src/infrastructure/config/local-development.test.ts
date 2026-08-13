import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isLocalAuthBypassEnabled,
  isLoopbackRequestHost,
  isLoopbackUrl,
  localAuthBypassRole,
  localAuthBypassUserId,
  parseLocalAuthBypassArguments,
} from "./local-development";

describe("local development access gate", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("requires the explicit local-development flag and a loopback application URL", () => {
    vi.stubEnv("APP_ENV", "local");
    vi.stubEnv("LOCAL_AUTH_BYPASS_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://127.0.0.1:3000");
    vi.stubEnv("NODE_ENV", "development");

    expect(isLocalAuthBypassEnabled()).toBe(true);
  });

  it.each([
    ["production", "development", "http://127.0.0.1:3000"],
    ["local", "production", "http://127.0.0.1:3000"],
    ["local", "development", "https://offerlab.example"],
  ] as const)("fails closed outside loopback local development", (appEnv, nodeEnv, appUrl) => {
    expect(
      isLocalAuthBypassEnabled({
        APP_ENV: appEnv,
        LOCAL_AUTH_BYPASS_ENABLED: "true",
        NEXT_PUBLIC_APP_URL: appUrl,
        NODE_ENV: nodeEnv,
      }),
    ).toBe(false);
  });

  it("recognises only loopback URLs and request hosts", () => {
    expect(isLoopbackUrl("http://localhost:3000")).toBe(true);
    expect(isLoopbackUrl("http://[::1]:3000")).toBe(true);
    expect(isLoopbackUrl("https://offerlab.example")).toBe(false);
    expect(isLoopbackRequestHost("127.0.0.1:3000")).toBe(true);
    expect(isLoopbackRequestHost("offerlab.example")).toBe(false);
  });

  it.each([
    { arguments_: [], role: "member" },
    { arguments_: ["--admin"], role: "administrator" },
  ] as const)("selects $role from local bypass arguments", ({ arguments_, role }) => {
    expect(parseLocalAuthBypassArguments(arguments_)).toBe(role);
  });

  it("rejects unknown local bypass arguments with usage guidance", () => {
    expect(() => parseLocalAuthBypassArguments(["--member"])).toThrow(/usage/i);
  });

  it("defaults the local bypass role to member and permits an explicit administrator role", () => {
    expect(localAuthBypassRole({ NODE_ENV: "development" })).toBe("member");
    expect(
      localAuthBypassRole({
        LOCAL_AUTH_BYPASS_ROLE: "administrator",
        NODE_ENV: "development",
      }),
    ).toBe("administrator");
  });

  it("defaults to the deterministic bypass member and permits a launcher-selected user", () => {
    expect(localAuthBypassUserId({ NODE_ENV: "development" })).toBe(
      "20000000-0000-4000-8000-000000000003",
    );
    expect(
      localAuthBypassUserId({
        LOCAL_AUTH_BYPASS_USER_ID: "20000000-0000-4000-8000-000000000001",
        NODE_ENV: "development",
      }),
    ).toBe("20000000-0000-4000-8000-000000000001");
  });
});
