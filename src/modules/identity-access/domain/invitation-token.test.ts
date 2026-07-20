import { describe, expect, it } from "vitest";

import { generateInvitationToken, hashInvitationToken } from "./invitation-token";

describe("invitation tokens", () => {
  it("generates high-entropy distinct URL-safe values", () => {
    const first = generateInvitationToken();
    const second = generateInvitationToken();
    expect(first).toMatch(/^[\w-]{43}$/);
    expect(second).not.toBe(first);
  });

  it("hashes deterministically without retaining the raw token", () => {
    const token = "example-token";
    const hash = hashInvitationToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    expect(hashInvitationToken(token)).toBe(hash);
  });
});
