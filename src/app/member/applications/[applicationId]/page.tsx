import { notFound, redirect } from "next/navigation";

import { readApplication } from "../../../../modules/applications/application/applications";
import { isApplicationId } from "../../../../modules/applications/domain/application";
import { requireMember } from "../../../../modules/identity-access/application/authorization";
import { readOnboardingProfile } from "../../../../modules/member-profile/application/onboarding";
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
  return (
    <main className="applications-shell">
      <MemberApplicationsHeader />
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
