import { requireMember } from "../../../modules/identity-access/application/authorization";
import { readOnboardingProfile } from "../../../modules/member-profile/application/onboarding";
import type { OnboardingAnswers } from "../../../modules/member-profile/domain/onboarding";
import { MemberApplicationsHeader } from "../applications/member-applications-header";
import { PageHeader } from "../../components/page-header";
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
      <PageHeader
        eyebrow="Profile"
        intro="A short, structured profile helps OfferLab understand your goals. Required answers are marked clearly."
        title={profile?.completedAt ? "Update your profile" : "Tell us where you’re heading"}
      />
      <section className="card">
        <OnboardingForm
          initial={profile?.answers ?? empty}
          initiallyCompleted={Boolean(profile?.completedAt)}
        />
      </section>
    </main>
  );
}
