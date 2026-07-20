import { requireMember } from "../../../modules/identity-access/application/authorization";
import { readOnboardingProfile } from "../../../modules/member-profile/application/onboarding";
import type { OnboardingAnswers } from "../../../modules/member-profile/domain/onboarding";
import { SignOutButton } from "../../components/sign-out-button";
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
};

export default async function OnboardingPage() {
  const authorization = await requireMember();
  const profile = await readOnboardingProfile(authorization.userId);
  return (
    <main className="onboarding-shell">
      <header className="member-header">
        <a className="brand" href="/member">
          OfferLab
        </a>
        <SignOutButton />
      </header>
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
