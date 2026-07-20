import { NextResponse } from "next/server";

import { currentMemberAccess } from "../../../../modules/identity-access/application/authorization";
import { readOnboardingProfile } from "../../../../modules/member-profile/application/onboarding";

export const genericApplicationError = {
  message: "We could not complete that request. Please try again.",
};

export async function applicationApiOwner(): Promise<
  Readonly<{ ownerId: string }> | Readonly<{ response: NextResponse }>
> {
  const access = await currentMemberAccess();
  if (access.status !== "eligible") {
    return {
      response: NextResponse.json(genericApplicationError, {
        status: access.status === "unauthenticated" ? 401 : 403,
      }),
    };
  }
  const profile = await readOnboardingProfile(access.authorization.userId);
  if (!profile?.completedAt) {
    return {
      response: NextResponse.json(
        { message: "Complete onboarding before tracking applications." },
        { status: 403 },
      ),
    };
  }
  return { ownerId: access.authorization.userId };
}
