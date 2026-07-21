import Link from "next/link";
import { redirect } from "next/navigation";

import {
  readApplications,
  recommendationApplicationContext,
} from "../../modules/applications/application/applications";
import { requireMember } from "../../modules/identity-access/application/authorization";
import { readOnboardingProfile } from "../../modules/member-profile/application/onboarding";
import { readDashboardRecommendations } from "../../modules/recommendations/application/recommendations";
import { MemberApplicationsHeader } from "./applications/member-applications-header";
import { RecommendationList } from "./recommendation-list";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function MemberPage() {
  const authorization = await requireMember();
  const profile = await readOnboardingProfile(authorization.userId);
  if (!profile?.completedAt) redirect("/member/onboarding");
  const applications = await readApplications(authorization.userId);
  const recommendationContexts = applications.map(recommendationApplicationContext);
  const recommendations = await readDashboardRecommendations(
    authorization.userId,
    recommendationContexts,
  );
  const applicationLinks = Object.fromEntries(
    applications.map((application) => [
      application.id,
      {
        href: `/member/applications/${application.id}`,
        label: `${application.company} — ${application.role}`,
      },
    ]),
  );

  return (
    <main className="applications-shell dashboard-shell">
      <MemberApplicationsHeader />
      <section className="applications-heading">
        <div>
          <p className="eyebrow">Member home</p>
          <h1>Your next actions</h1>
          <p className="intro">
            A focused set of actions based on each application’s current stage and deadlines.
          </p>
        </div>
        <Link className="button-link" href="/member/applications">
          View applications
        </Link>
      </section>

      {applications.length === 0 ? (
        <section className="card empty-state">
          <h2>Add your first application</h2>
          <p>Add its current stage so OfferLab can show practical next actions.</p>
          <Link className="button-link" href="/member/applications/new">
            Add application
          </Link>
        </section>
      ) : (
        <section aria-labelledby="next-actions-title" className="dashboard-section">
          <div className="section-heading">
            <div>
              <h2 id="next-actions-title">Recommended next actions</h2>
              <p>Up to ten pending actions across your active applications.</p>
            </div>
            <p className="application-count">
              {applications.length} active application{applications.length === 1 ? "" : "s"}
            </p>
          </div>
          <RecommendationList
            applicationLinks={applicationLinks}
            key={recommendations
              .map(
                ({ identity, state, stateVersion }) =>
                  `${identity.applicationId}:${identity.key}:${identity.ruleVersion}:${state}:${stateVersion ?? "none"}`,
              )
              .join("|")}
            recommendations={recommendations}
            showApplicationLinks
          />
        </section>
      )}
    </main>
  );
}
