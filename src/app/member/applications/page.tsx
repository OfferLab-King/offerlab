import Link from "next/link";
import { redirect } from "next/navigation";

import { readApplications } from "../../../modules/applications/application/applications";
import { recruitmentStages } from "../../../modules/applications/domain/application";
import { requireMember } from "../../../modules/identity-access/application/authorization";
import { readOnboardingProfile } from "../../../modules/member-profile/application/onboarding";
import { opportunityTypes } from "../../../modules/taxonomy/domain/opportunity-types";
import { industries } from "../../../modules/taxonomy/domain/industries";
import { formatDate } from "../../jobs/job-display";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = Readonly<{ searchParams: Promise<{ view?: string }> }>;

export default async function ApplicationsPage({ searchParams }: Props) {
  const authorization = await requireMember();
  const profile = await readOnboardingProfile(authorization.userId);
  if (!profile?.completedAt) redirect("/member/onboarding");
  const archived = (await searchParams).view === "archived";
  const applications = await readApplications(authorization.userId, archived);

  return (
    <main className="applications-shell workspace-shell">
      <section className="workspace-hero compact-hero">
        <div>
          <p className="eyebrow">Application tracker</p>
          <h1>{archived ? "Archived" : "Your applications"}</h1>
          <p className="intro">Keep each opportunity and its next step private.</p>
        </div>
        <div className="workspace-hero-actions">
          <Link className="button-link" href="/member/applications/new">
            Add application
          </Link>
          <Link className="button-link button-secondary" href="/member">
            Back to workspace
          </Link>
        </div>
      </section>
      <nav aria-label="Application view" className="view-tabs">
        <Link aria-current={!archived ? "page" : undefined} href="/member/applications">
          Active
        </Link>
        <Link
          aria-current={archived ? "page" : undefined}
          href="/member/applications?view=archived"
        >
          Archived
        </Link>
      </nav>
      {applications.length === 0 ? (
        <section className="card empty-state">
          <h2>{archived ? "No archived applications" : "No active applications"}</h2>
          <p>
            {archived
              ? "Applications you archive will remain available here."
              : "Add its company, role and stage — no deadline required."}
          </p>
          {!archived && (
            <Link className="button-link" href="/member/applications/new">
              Add application
            </Link>
          )}
        </section>
      ) : (
        <ul className="workspace-application-list">
          {applications.map((application) => {
            const relevantDate = application.nextStageDeadline ?? application.applicationDeadline;
            return (
              <li className="workspace-application-row" key={application.id}>
                <div className="workspace-application-meta">
                  <p className="workspace-application-company">{application.company}</p>
                  <h3 className="workspace-application-role">
                    <Link href={`/member/applications/${application.id}`}>{application.role}</Link>
                  </h3>
                  <p className="hint">
                    {opportunityTypes[application.opportunityType]} ·{" "}
                    {recruitmentStages[application.stage]}
                    {application.industry ? ` · ${industries[application.industry]}` : ""}
                    {relevantDate ? ` · ${formatDate(relevantDate)}` : ""}
                  </p>
                </div>
                <span className="status-badge workspace-stage-badge">
                  {recruitmentStages[application.stage]}
                </span>
                <Link
                  aria-label={`Open ${application.company} ${application.role}`}
                  className="workspace-row-action"
                  href={`/member/applications/${application.id}`}
                >
                  Open →
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
