import { withApplicationUser } from "../../../infrastructure/database/runtime-connections";
import {
  benefitsFor,
  isActiveMembership,
  type MembershipBenefits,
  type MembershipPlan,
  type MembershipSummary,
} from "../domain/membership";
import {
  clearMembershipForOwner,
  readAllMembershipsForAdmin as readAllMembershipsForAdminFromDatabase,
  readMembershipForOwner,
  upsertMembershipForOwner,
} from "../infrastructure/membership-repository";

export async function readMembershipSummary(owner: string): Promise<MembershipSummary> {
  return withApplicationUser(owner, async (database) => {
    const record = await readMembershipForOwner(database, owner);
    if (!record) {
      return { active: false, periodEnd: null, plan: "free", source: null, status: null };
    }
    return {
      active: isActiveMembership({
        active: record.status === "active",
        periodEnd: record.periodEnd,
        plan: "membership",
        source: record.source,
        status: record.status,
      }),
      periodEnd: record.periodEnd,
      plan: "membership",
      source: record.source,
      status: record.status,
    };
  });
}

export async function readMembershipBenefits(owner: string): Promise<MembershipBenefits> {
  return benefitsFor(await readMembershipSummary(owner));
}

/**
 * Self-serve activation used by local development and tests (source = test).
 * Production activation goes through the privileged membership CLI so the
 * payment provider decision stays explicit; the self-serve path is refused in
 * staging and production so a deployed environment can never grant paid
 * entitlements through the member-facing form.
 */
export async function activateTestMembership(owner: string): Promise<MembershipSummary> {
  const appEnvironment = process.env.APP_ENV;
  if (appEnvironment === "production" || appEnvironment === "staging") {
    throw new Error("membership_self_serve_unavailable_in_deployed_environments");
  }
  return withApplicationUser(owner, async (database) => {
    const record = await upsertMembershipForOwner(database, owner, {
      periodEnd: null,
      source: "test",
      status: "active",
    });
    return {
      active: true,
      periodEnd: record.periodEnd,
      plan: "membership",
      source: record.source,
      status: record.status,
    };
  });
}

export async function cancelMembershipForOwner(owner: string): Promise<MembershipSummary> {
  return withApplicationUser(owner, async (database) => {
    const record = await upsertMembershipForOwner(database, owner, {
      periodEnd: null,
      source: "manual",
      status: "cancelled",
    });
    return {
      active: false,
      periodEnd: record.periodEnd,
      plan: "membership",
      source: record.source,
      status: record.status,
    };
  });
}

export async function revokeMembershipForOwner(owner: string): Promise<void> {
  await withApplicationUser(owner, (database) => clearMembershipForOwner(database, owner));
}

export type AdminMembershipView = Readonly<{
  userId: string;
  email: string;
  plan: string;
  status: string;
  periodStart: Date;
  periodEnd: Date | null;
  source: string;
  updatedAt: Date;
}>;

export async function readAllMembershipsForAdmin(
  administratorUserId: string,
): Promise<readonly AdminMembershipView[]> {
  return withApplicationUser(administratorUserId, (database) =>
    readAllMembershipsForAdminFromDatabase(database),
  );
}

export type { MembershipPlan };
