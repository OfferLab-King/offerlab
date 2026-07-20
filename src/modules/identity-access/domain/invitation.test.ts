import { describe, expect, it } from "vitest";

import { canConsumeInvitation, invitationRejection } from "./invitation";

const now = new Date("2026-07-20T12:00:00Z");

describe("invitation transitions", () => {
  it("accepts an unused future invitation", () => {
    expect(
      canConsumeInvitation(
        { consumedAt: null, expiresAt: new Date("2026-07-21T12:00:00Z"), revokedAt: null },
        now,
      ),
    ).toBe(true);
  });

  it.each([
    ["expired", { consumedAt: null, expiresAt: now, revokedAt: null }],
    ["revoked", { consumedAt: null, expiresAt: new Date("2026-07-21T12:00:00Z"), revokedAt: now }],
    ["consumed", { consumedAt: now, expiresAt: new Date("2026-07-21T12:00:00Z"), revokedAt: null }],
  ] as const)("rejects an %s invitation", (reason, invitation) => {
    expect(invitationRejection(invitation, now)).toBe(reason);
  });
});
