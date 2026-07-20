import { describe, expect, it } from "vitest";

import { hasActiveBetaEntitlement } from "./entitlement";

describe("beta entitlement", () => {
  it.each([
    ["active", true],
    ["revoked", false],
    [null, false],
  ] as const)("evaluates %s", (status, expected) => {
    expect(hasActiveBetaEntitlement(status)).toBe(expected);
  });
});
