import { redirect } from "next/navigation";

import { requireMember } from "../../modules/identity-access/application/authorization";
import { readOnboardingProfile } from "../../modules/member-profile/application/onboarding";
import { SignOutButton } from "../components/sign-out-button";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function MemberPage() {
  const authorization = await requireMember();
  const profile = await readOnboardingProfile(authorization.userId);
  if (!profile?.completedAt) redirect("/member/onboarding");
  return (
    <main>
      <section className="card">
        <p className="eyebrow">Onboarding complete</p>
        <h1>You’re ready for what comes next</h1>
        <p>
          Your OfferLab profile is saved. Application tracking is the next product stage and is not
          available yet.
        </p>
        <p>
          <a href="/member/onboarding">Review or update your onboarding profile</a>
        </p>
        <p>
          <a href="/admin">Administration</a>
        </p>
        <SignOutButton />
      </section>
    </main>
  );
}
