import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("runtime source boundaries", () => {
  it("keeps migration and service-role credentials out of application runtime modules", async () => {
    const runtimeSources = await Promise.all(
      [
        "src/app/auth/callback/route.ts",
        "src/app/api/auth/register/route.ts",
        "src/app/api/auth/recovery/route.ts",
        "src/app/api/auth/resend/route.ts",
        "src/app/api/auth/update-password/route.ts",
        "src/infrastructure/config/environment.ts",
        "src/infrastructure/database/runtime-connections.ts",
        "src/modules/identity-access/application/authorization.ts",
      ].map((path) => readFile(path, "utf8")),
    );
    const combined = runtimeSources.join("\n");
    expect(combined).not.toContain("DATABASE_MIGRATION_URL");
    expect(combined).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(combined).not.toContain("password_reset_ticket");
  });

  it("does not expose an anonymous authentication analytics endpoint", async () => {
    await expect(readFile("src/app/api/analytics/auth/route.ts", "utf8")).rejects.toThrow();
  });

  it("documents callback logging as a deployment gate rather than code-complete", async () => {
    const operations = await readFile("docs/operations/authentication.md", "utf8");
    expect(operations).toContain("Controls requiring deployment verification");
    expect(operations).toContain("This checklist is a production acceptance gate");
    expect(operations).toContain("upstream callback-token logging protection remains unverified");
    expect(operations).not.toContain("token-bearing URLs are universally excluded from logs");
  });
});
