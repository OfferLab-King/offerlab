import { requireMember } from "../../../modules/identity-access/application/authorization";
import { readOnboardingProfile } from "../../../modules/member-profile/application/onboarding";
import type { OnboardingAnswers } from "../../../modules/member-profile/domain/onboarding";
import { MemberApplicationsHeader } from "../applications/member-applications-header";
import { OnboardingForm } from "./onboarding-form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const empty: OnboardingAnswers = {
  confidence: null,
  educationStage: null,
  industries: [],
  opportunityTypes: [],
  preparationPriorities: [],
  supportNeeds: [],
  targetCompanies: [],
  targetFunctions: [],
  targetIndustries: [],
  preferredLocations: [],
};

export default async function OnboardingPage() {
  const authorization = await requireMember();
  const profile = await readOnboardingProfile(authorization.userId);
  return (
    <main className="onboarding-shell">
      <MemberApplicationsHeader />
      <section className="card onboarding-card">
        <p className="eyebrow">Member onboarding</p>
        <h1>{profile?.completedAt ? "Update your profile" : "Tell us where you’re heading"}</h1>
        <p className="intro">
          A short, structured profile helps OfferLab understand your graduate recruitment goals.
          Required answers are marked clearly.
        </p>
        <OnboardingForm
          initial={profile?.answers ?? empty}
          initiallyCompleted={Boolean(profile?.completedAt)}
        />
      </section>
    </main>
  );
}
