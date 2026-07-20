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
});
