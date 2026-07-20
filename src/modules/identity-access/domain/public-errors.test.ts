import { describe, expect, it } from "vitest";

import { mapSupabasePublicError, publicAuthErrorMessage } from "./public-errors";

describe("public auth errors", () => {
  it("maps unknown account and invitation failures to a generic response", () => {
    expect(mapSupabasePublicError("User already registered")).toBe("generic");
    expect(publicAuthErrorMessage("generic")).not.toMatch(/registered|account exists/i);
  });

  it("maps rate limiting without exposing account state", () => {
    expect(mapSupabasePublicError("Too many requests", 429)).toBe("rate_limited");
  });
});
