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

  it("requires database and service credentials in production", () => {
    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        APP_ENV: "production",
        NODE_ENV: "production",
      }),
    ).toThrow();
  });
});
