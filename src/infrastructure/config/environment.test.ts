import { describe, expect, it } from "vitest";

import { parseServerEnvironment } from "./environment";

const validEnvironment: NodeJS.ProcessEnv = {
  APP_ENV: "test",
  LOG_LEVEL: "silent",
  NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55321",
  NODE_ENV: "test",
};

describe("parseServerEnvironment", () => {
  it("accepts a valid test environment", () => {
    expect(parseServerEnvironment(validEnvironment).APP_ENV).toBe("test");
  });

  it("requires runtime and identity credentials but not migration credentials in production", () => {
    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        APP_ENV: "production",
        NODE_ENV: "production",
      }),
    ).toThrow();
    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        APP_ENV: "production",
        AUTH_RATE_LIMIT_SECRET: "production-test-secret",
        DATABASE_URL: "postgresql://runtime.invalid/database",
        IDENTITY_SYNC_DATABASE_URL: "postgresql://identity.invalid/database",
        NODE_ENV: "production",
      }),
    ).not.toThrow();
  });
});
