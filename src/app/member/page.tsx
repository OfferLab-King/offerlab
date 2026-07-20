import { redirect } from "next/navigation";

import { requireMember } from "../../modules/identity-access/application/authorization";
import { readOnboardingProfile } from "../../modules/member-profile/application/onboarding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function MemberPage() {
  const authorization = await requireMember();
  const profile = await readOnboardingProfile(authorization.userId);
  if (!profile?.completedAt) redirect("/member/onboarding");
  redirect("/member/applications");
}
