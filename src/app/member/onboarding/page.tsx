import Link from "next/link";

import { requireMember } from "../../../modules/identity-access/application/authorization";
import { readOnboardingProfile } from "../../../modules/member-profile/application/onboarding";
import type { OnboardingAnswers } from "../../../modules/member-profile/domain/onboarding";
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
  const industries = profile?.answers?.industries ?? [];
  const hasIndustries = industries.length > 0;
  const jobsHref = hasIndustries
    ? `/jobs?industries=${industries.map((value) => value.replaceAll("_", "-")).join(",")}`
    : "/jobs";
  const employersHref = hasIndustries
    ? `/employers?industry=${industries[0]?.replaceAll("_", "-")}`
    : "/employers";
  return (
    <main className="onboarding-shell">
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
      {profile?.completedAt ? (
        <section className="card" style={{ marginTop: "var(--space-3)" }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Your profile in action</h2>
          <p className="hint" style={{ marginTop: "0.5rem" }}>
            Jobs, employers and recommendations use your industries and opportunity types — no extra
            setup needed.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1rem" }}>
            <Link className="button-link button-secondary" href={jobsHref as never}>
              View jobs{hasIndustries ? ` for ${industries.length} industries` : ""} →
            </Link>
            <Link className="button-link button-secondary" href={employersHref as never}>
              Explore employers →
            </Link>
            <Link className="button-link button-secondary" href="/member">
              Back to workspace
            </Link>
          </div>
        </section>
      ) : null}
    </main>
  );
}
