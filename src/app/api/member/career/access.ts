import { NextResponse } from "next/server";
import { currentMemberAccess } from "../../../../modules/identity-access/application/authorization";
import { readOnboardingProfile } from "../../../../modules/member-profile/application/onboarding";

export const genericCareerError = {
  message: "We could not complete that request. Please try again.",
};

export async function careerApiOwner(): Promise<
  Readonly<{ ownerId: string }> | Readonly<{ response: NextResponse }>
> {
  const access = await currentMemberAccess();
  if (access.status !== "eligible") {
    return {
      response: NextResponse.json(genericCareerError, {
        status: access.status === "unauthenticated" ? 401 : 403,
      }),
    };
  }
  const profile = await readOnboardingProfile(access.authorization.userId);
  if (!profile?.completedAt) {
    return {
      response: NextResponse.json(
        { message: "Complete onboarding before using application tools." },
        { status: 403 },
      ),
    };
  }
  return { ownerId: access.authorization.userId };
}
