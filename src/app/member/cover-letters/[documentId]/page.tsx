import { notFound, redirect } from "next/navigation";
import {
  readCareerDocumentConfiguration,
  readCareerDocumentWorkspace,
  readCareerJobTargets,
} from "../../../../modules/career-documents/application/career-documents";
import { requireMember } from "../../../../modules/identity-access/application/authorization";
import { readMembershipSummary } from "../../../../modules/membership/application/membership";
import { isActiveMembership } from "../../../../modules/membership/domain/membership";
import { readOnboardingProfile } from "../../../../modules/member-profile/application/onboarding";
import { CareerDocumentNavigation } from "../../career-document-navigation";
import { CareerDocumentWorkspace } from "../../career-document-workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CoverLetterWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ documentId: string }>;
  searchParams: Promise<{
    uploadWarning?: string | string[];
    version?: string | string[];
  }>;
}) {
  const { userId } = await requireMember();
  if (!(await readOnboardingProfile(userId))?.completedAt) redirect("/member/onboarding");
  const { documentId } = await params;
  const query = await searchParams;
  const requestedVersion = query.version;
  const [workspace, jobTargets, membership] = await Promise.all([
    readCareerDocumentWorkspace(
      userId,
      documentId,
      typeof requestedVersion === "string" ? requestedVersion : null,
    ),
    readCareerJobTargets(userId),
    readMembershipSummary(userId),
  ]);
  if (!workspace || workspace.document.kind !== "cover_letter") notFound();
  return (
    <main className="applications-shell career-document-detail-shell">
      <CareerDocumentNavigation active="cover_letter" />
      <section className="applications-heading">
        <div>
          <p className="eyebrow">Cover-letter workspace</p>
          <h1>{workspace.document.title}</h1>
          <p className="intro">
            Keep each company- and role-specific version separate and recoverable.
          </p>
        </div>
      </section>
      {query.uploadWarning === "features-omitted" && (
        <p className="extraction-warning" role="status">
          Some complex document features may not be represented in the extracted text. Compare it
          with your original file before editing.
        </p>
      )}
      <CareerDocumentWorkspace
        configuration={readCareerDocumentConfiguration()}
        document={workspace.document}
        jobTargets={jobTargets}
        key={workspace.selectedVersion.id}
        membershipActive={isActiveMembership(membership)}
        reviews={workspace.reviews}
        selectedVersion={workspace.selectedVersion}
        versionSummaries={workspace.versionSummaries}
      />
    </main>
  );
}
