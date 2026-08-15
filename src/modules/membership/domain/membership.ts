/**
 * Membership plans, pricing and benefits.
 *
 * Pricing is a product decision owned by the founder; these constants are the
 * single place to change it and are surfaced on the public plans page.
 */

export type MembershipPlan = "free" | "membership";

export type MembershipStatus = "active" | "cancelled" | "expired";

export type MembershipSource = "manual" | "stripe" | "test";

export type MembershipRecord = Readonly<{
  userId: string;
  plan: MembershipPlan;
  status: MembershipStatus;
  periodStart: Date;
  periodEnd: Date | null;
  source: MembershipSource;
  createdAt: Date;
  updatedAt: Date;
}>;

export type MembershipSummary = Readonly<{
  plan: MembershipPlan;
  status: MembershipStatus | null;
  periodEnd: Date | null;
  source: MembershipSource | null;
  active: boolean;
}>;

export const MEMBERSHIP_PRICING = {
  membershipMonthlyPence: 900, // £9.00 per month
  membershipSeasonPence: 3900, // £39.00 for the recruitment season
} as const;

export const membershipPlanLabel: Readonly<Record<MembershipPlan, string>> = {
  free: "Free",
  membership: "Membership",
};

export function isActiveMembership(summary: MembershipSummary): boolean {
  if (summary.plan !== "membership" || summary.status !== "active") return false;
  if (summary.periodEnd && summary.periodEnd.getTime() <= Date.now()) return false;
  return true;
}

export function formatPence(pence: number): string {
  return new Intl.NumberFormat("en-GB", { currency: "GBP", style: "currency" }).format(pence / 100);
}

/**
 * Premium review-capacity multiplier applied to the free member ceilings for
 * career-document reviews (free daily/monthly limits are defined in the
 * career-documents module).
 */
export const MEMBERSHIP_REVIEW_CAPACITY_MULTIPLIER = 2;

export type MembershipBenefits = Readonly<{
  reviewCapacityMultiplier: number;
  earlyAccess: boolean;
}>;

export function benefitsFor(summary: MembershipSummary): MembershipBenefits {
  if (!isActiveMembership(summary)) {
    return { earlyAccess: false, reviewCapacityMultiplier: 1 };
  }
  return {
    earlyAccess: true,
    reviewCapacityMultiplier: MEMBERSHIP_REVIEW_CAPACITY_MULTIPLIER,
  };
}
