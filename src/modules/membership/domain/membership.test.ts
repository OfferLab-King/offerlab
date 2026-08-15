import { describe, expect, it } from "vitest";

import {
  benefitsFor,
  isActiveMembership,
  MEMBERSHIP_PRICING,
  membershipPlanLabel,
  type MembershipSummary,
} from "./membership";

function summary(overrides: Partial<MembershipSummary> = {}): MembershipSummary {
  return {
    active: false,
    periodEnd: null,
    plan: "free",
    source: null,
    status: null,
    ...overrides,
  };
}

describe("membership domain", () => {
  it("exposes the pricing constants and plan labels", () => {
    expect(MEMBERSHIP_PRICING.membershipMonthlyPence).toBe(900);
    expect(MEMBERSHIP_PRICING.membershipSeasonPence).toBe(3900);
    expect(membershipPlanLabel.free).toBe("Free");
    expect(membershipPlanLabel.membership).toBe("Membership");
  });

  it("treats only active, in-period membership as active", () => {
    expect(isActiveMembership(summary({ plan: "membership", status: "active" }))).toBe(true);
    expect(isActiveMembership(summary({ plan: "membership", status: "cancelled" }))).toBe(false);
    expect(isActiveMembership(summary({ plan: "membership", status: "expired" }))).toBe(false);
    expect(isActiveMembership(summary())).toBe(false);
    expect(
      isActiveMembership(
        summary({
          plan: "membership",
          status: "active",
          periodEnd: new Date(Date.now() - 1000),
        }),
      ),
    ).toBe(false);
  });

  it("grants premium benefits only to active members", () => {
    expect(benefitsFor(summary({ plan: "membership", status: "active" }))).toEqual({
      earlyAccess: true,
      reviewCapacityMultiplier: 2,
    });
    expect(benefitsFor(summary())).toEqual({
      earlyAccess: false,
      reviewCapacityMultiplier: 1,
    });
    expect(benefitsFor(summary({ plan: "membership", status: "cancelled" }))).toEqual({
      earlyAccess: false,
      reviewCapacityMultiplier: 1,
    });
  });
});
