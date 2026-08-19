import { describe, expect, it } from "vitest";

import { safeRedirectPath } from "./redirect";

describe("safe redirects", () => {
  it.each(["https://evil.example", "//evil.example", "/sign-in", "javascript:alert(1)"])(
    "rejects %s",
    (value) => expect(safeRedirectPath(value)).toBe("/member"),
  );
  it("allows declared internal member paths", () => {
    expect(safeRedirectPath("/member?from=sign-in")).toBe("/member?from=sign-in");
  });
  it("allows returning to public content paths after sign-in", () => {
    expect(safeRedirectPath("/jobs/analyst-role")).toBe("/jobs/analyst-role");
    expect(safeRedirectPath("/jobs?q=analyst&sector=technology")).toBe(
      "/jobs?q=analyst&sector=technology",
    );
    expect(safeRedirectPath("/employers/synthetic-bank")).toBe("/employers/synthetic-bank");
    expect(safeRedirectPath("/intelligence/2026-autumn")).toBe("/intelligence/2026-autumn");
    expect(safeRedirectPath("/plans")).toBe("/plans");
  });
  it("keeps rejecting unapproved paths", () => {
    expect(safeRedirectPath("/sign-in")).toBe("/member");
    expect(safeRedirectPath("/api/member/applications")).toBe("/member");
  });
});
