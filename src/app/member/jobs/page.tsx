import { redirect } from "next/navigation";

import { readCareerJobTargets } from "../../../modules/career-documents/application/career-documents";
import { requireMember } from "../../../modules/identity-access/application/authorization";
import { readOnboardingProfile } from "../../../modules/member-profile/application/onboarding";
import { MemberApplicationsHeader } from "../applications/member-applications-header";
import { JobSearchWorkspace, type JobTargetView } from "./job-search-workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const { userId } = await requireMember();
  if (!(await readOnboardingProfile(userId))?.completedAt) redirect("/member/onboarding");

  const targets = await readCareerJobTargets(userId);
  const initialTargets: readonly JobTargetView[] = targets.map((target) => ({
    applyUrl: target.applyUrl,
    companyName: target.companyName,
    description: target.description,
    employmentType: target.employmentType,
    fetchedAt: target.fetchedAt?.toISOString() ?? null,
    id: target.id,
    location: target.location,
    provider: target.provider,
    providerJobId: target.providerJobId,
    publishedAt: target.publishedAt?.toISOString() ?? null,
    roleTitle: target.roleTitle,
    sourcePublisher: target.sourcePublisher,
    sourceUrl: target.sourceUrl,
    updatedAt: target.updatedAt.toISOString(),
  }));

  return (
    <main className="applications-shell">
      <MemberApplicationsHeader />
      <section className="applications-heading">
        <div>
          <p className="eyebrow">Job discovery</p>
          <h1>Find a role worth tailoring for</h1>
          <p className="intro">
            Search UK vacancies or save a role manually, then reuse its job description when you
            create a targeted CV or cover letter.
          </p>
        </div>
      </section>
      <JobSearchWorkspace initialTargets={initialTargets} />
    </main>
  );
}
