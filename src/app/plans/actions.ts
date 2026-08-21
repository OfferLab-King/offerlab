"use server";

import { revalidatePath } from "next/cache";

import { requireMember } from "../../modules/identity-access/application/authorization";
import {
  activateTestMembership,
  cancelMembershipForOwner,
} from "../../modules/membership/application/membership";

export async function activateTestMembershipAction(): Promise<void> {
  const authorization = await requireMember();
  await activateTestMembership(authorization.userId);
  revalidatePath("/plans");
}

export async function cancelMembershipAction(): Promise<void> {
  const authorization = await requireMember();
  await cancelMembershipForOwner(authorization.userId);
  revalidatePath("/plans");
}
