import Link from "next/link";
import { redirect } from "next/navigation";

import { readApplications } from "../../../modules/applications/application/applications";
import { recruitmentStages } from "../../../modules/applications/domain/application";
import { requireMember } from "../../../modules/identity-access/application/authorization";
import { readOnboardingProfile } from "../../../modules/member-profile/application/onboarding";
import { opportunityTypes } from "../../../modules/taxonomy/domain/opportunity-types";
import { industries } from "../../../modules/taxonomy/domain/industries";
import { MemberApplicationsHeader } from "./member-applications-header";

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
    <main className="applications-shell">
      <MemberApplicationsHeader />
      <section className="applications-heading">
        <div>
          <p className="eyebrow">Application tracker</p>
          <h1>{archived ? "Archived applications" : "Your applications"}</h1>
          <p className="intro">
            Keep each graduate opportunity and its next step in one private place.
          </p>
        </div>
        <Link className="button-link" href="/member/applications/new">
          Add application
        </Link>
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
          <h2>{archived ? "No archived applications" : "Add your first application"}</h2>
          <p>
            {archived
              ? "Applications you archive will remain available here."
              : "Track an application now. Stage-based preparation recommendations will be introduced in the next increment."}
          </p>
          {!archived && (
            <Link className="button-link" href="/member/applications/new">
              Add application
            </Link>
          )}
        </section>
      ) : (
        <ul className="application-list">
          {applications.map((application) => {
            const relevantDate = application.nextStageDeadline ?? application.applicationDeadline;
            return (
              <li className="application-card" key={application.id}>
                <div>
                  <p className="application-company">{application.company}</p>
                  <h2>{application.role}</h2>
                  <p className="application-meta">
                    {opportunityTypes[application.opportunityType]} ·{" "}
                    {recruitmentStages[application.stage]}
                    {application.industry ? ` · ${industries[application.industry]}` : ""}
                  </p>
                  {relevantDate && (
                    <p className="application-date">
                      {application.nextStageDeadline ? "Next-stage deadline" : "Deadline"}:{" "}
                      {relevantDate}
                    </p>
                  )}
                </div>
                <a
                  aria-label={`Open ${application.company} ${application.role}`}
                  className="button-link button-secondary"
                  href={`/member/applications/${application.id}`}
                >
                  Open
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
