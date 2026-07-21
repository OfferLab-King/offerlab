import { notFound, redirect } from "next/navigation";

import {
  readApplication,
  recommendationApplicationContext,
} from "../../../../modules/applications/application/applications";
import { isApplicationId } from "../../../../modules/applications/domain/application";
import { requireMember } from "../../../../modules/identity-access/application/authorization";
import { readOnboardingProfile } from "../../../../modules/member-profile/application/onboarding";
import { readApplicationRecommendations } from "../../../../modules/recommendations/application/recommendations";
import { RecommendationList } from "../../recommendation-list";
import { ApplicationForm } from "../application-form";
import { MemberApplicationsHeader } from "../member-applications-header";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = Readonly<{ params: Promise<{ applicationId: string }> }>;

export default async function ApplicationDetailPage({ params }: Props) {
  const authorization = await requireMember();
  const profile = await readOnboardingProfile(authorization.userId);
  if (!profile?.completedAt) redirect("/member/onboarding");
  const { applicationId } = await params;
  if (!isApplicationId(applicationId)) notFound();
  const application = await readApplication(authorization.userId, applicationId);
  if (!application) notFound();
  const recommendations = await readApplicationRecommendations(
    authorization.userId,
    recommendationApplicationContext(application),
  );
  return (
    <main className="applications-shell">
      <MemberApplicationsHeader />
      <section aria-labelledby="application-recommendations-title" className="dashboard-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Recommended preparation</p>
            <h2 id="application-recommendations-title">Next actions</h2>
            <p className="intro">
              For {application.company} — {application.role}
            </p>
          </div>
        </div>
        {application.archivedAt ? (
          <p className="status">
            Archived applications do not have active recommendations. Restore this application to
            recalculate its current next actions.
          </p>
        ) : (
          <RecommendationList
            key={recommendations
              .map(
                ({ identity, state, stateVersion }) =>
                  `${identity.key}:${identity.ruleVersion}:${state}:${stateVersion ?? "none"}`,
              )
              .join("|")}
            recommendations={recommendations}
            showSecondary
          />
        )}
      </section>
      <section className="card application-form-card">
        <p className="eyebrow">
          {application.archivedAt ? "Archived application" : "Application details"}
        </p>
        <h1>{application.archivedAt ? "Archived application" : "Edit application"}</h1>
        <p className="intro">
          Changes are protected against overwriting a newer edit made elsewhere.
        </p>
        <ApplicationForm
          applicationId={application.id}
          archived={Boolean(application.archivedAt)}
          initial={application}
          version={application.version}
        />
      </section>
    </main>
  );
}
