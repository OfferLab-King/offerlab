import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isLocalAuthBypassEnabled,
  isLoopbackRequestHost,
  isLoopbackUrl,
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
});
