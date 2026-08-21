import Link from "next/link";
import { redirect } from "next/navigation";

import { readAnswerBankSummary } from "../../modules/answer-bank/application/answer-bank";
import {
  readApplications,
  recommendationApplicationContext,
} from "../../modules/applications/application/applications";
import { readCareerDocuments } from "../../modules/career-documents/application/career-documents";
import { requireMember } from "../../modules/identity-access/application/authorization";
import { readOnboardingProfile } from "../../modules/member-profile/application/onboarding";
import { readDashboardRecommendations } from "../../modules/recommendations/application/recommendations";
import { recruitmentStages } from "../../modules/applications/domain/application";
import { listSavedEmployersForMember } from "../../modules/job-catalog/application/saved-employers";
import { RecommendationList } from "./recommendation-list";
import { formatDate } from "../jobs/job-display";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function MemberPage() {
  const authorization = await requireMember();
  const profile = await readOnboardingProfile(authorization.userId);
  if (!profile?.completedAt) redirect("/member/onboarding");
  const [applications, savedEmployers, bank, cvDocuments, coverLetterDocuments] = await Promise.all(
    [
      readApplications(authorization.userId),
      listSavedEmployersForMember(authorization.userId),
      readAnswerBankSummary(authorization.userId),
      readCareerDocuments(authorization.userId, "cv"),
      readCareerDocuments(authorization.userId, "cover_letter"),
    ],
  );
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
  const nextDeadline = applications
    .map((app) => app.nextStageDeadline ?? app.applicationDeadline)
    .filter((date): date is NonNullable<typeof date> => Boolean(date))
    .sort(
      (a, b) =>
        new Date(a as unknown as string).getTime() - new Date(b as unknown as string).getTime(),
    )[0];

  return (
    <main className="applications-shell workspace-shell">
      <section className="workspace-hero">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1>Your preparation workspace</h1>
          <p className="intro">
            Applications, documents and evidence — in one private place. Direct, not guided.
          </p>
        </div>
        <div className="workspace-hero-actions">
          <Link className="button-link" href="/member/applications/new">
            Add application
          </Link>
          <Link className="button-link button-secondary" href="/member/learn/answer-bank">
            Open Answer Bank
          </Link>
        </div>
      </section>

      {applications.length === 0 ? (
        <section className="card empty-state workspace-empty">
          <h2>Add your first application</h2>
          <p>
            Track its company, role and stage. OfferLab will show the next useful resource for that
            stage — nothing compulsory.
          </p>
          <Link className="button-link" href="/member/applications/new">
            Add application
          </Link>
        </section>
      ) : (
        <div className="workspace-grid">
          <div className="workspace-main">
            <section aria-labelledby="applications-title" className="workspace-section">
              <div className="workspace-section-header">
                <div>
                  <h2 id="applications-title">Applications</h2>
                  <p className="hint">
                    {applications.length} active ·{" "}
                    {nextDeadline ? `next deadline ${formatDate(nextDeadline)}` : "no deadline set"}
                  </p>
                </div>
                <Link
                  className="button-link button-secondary compact-button"
                  href="/member/applications"
                >
                  View all
                </Link>
              </div>
              <ul className="workspace-application-list">
                {applications.slice(0, 5).map((application) => {
                  const relevantDate =
                    application.nextStageDeadline ?? application.applicationDeadline;
                  return (
                    <li className="workspace-application-row" key={application.id}>
                      <div className="workspace-application-meta">
                        <p className="workspace-application-company">{application.company}</p>
                        <h3 className="workspace-application-role">
                          <Link href={`/member/applications/${application.id}`}>
                            {application.role}
                          </Link>
                        </h3>
                        <p className="hint">
                          {recruitmentStages[application.stage]}
                          {application.industry ? ` · ${application.industry}` : ""}
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
              {applications.length > 5 && (
                <p className="hint workspace-more">
                  + {applications.length - 5} more in{" "}
                  <Link href="/member/applications">Applications</Link>
                </p>
              )}
            </section>

            <section aria-labelledby="documents-title" className="workspace-section card">
              <div className="workspace-section-header">
                <h2 id="documents-title">Documents</h2>
                <div className="workspace-document-actions">
                  <Link className="button-link button-secondary compact-button" href="/member/cvs">
                    CVs · {cvDocuments.length}
                  </Link>
                  <Link
                    className="button-link button-secondary compact-button"
                    href="/member/cover-letters"
                  >
                    Cover letters · {coverLetterDocuments.length}
                  </Link>
                </div>
              </div>
              <p className="hint">
                Keep a strong base, then create a truthful targeted version for each role. Latest
                version is the current one.
              </p>
              <div className="workspace-document-grid">
                <div>
                  <p className="eyebrow">CVs</p>
                  <p>
                    <strong>{cvDocuments.length}</strong> CV{cvDocuments.length === 1 ? "" : "s"}
                    {cvDocuments[0]?.title
                      ? ` · latest “${cvDocuments[0].title.slice(0, 32)}”`
                      : ""}
                  </p>
                </div>
                <div>
                  <p className="eyebrow">Cover letters</p>
                  <p>
                    <strong>{coverLetterDocuments.length}</strong> letter
                    {coverLetterDocuments.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              {(cvDocuments.length === 0 || coverLetterDocuments.length === 0) && (
                <p className="hint">
                  No documents yet. Upload a PDF/DOCX on the documents pages — AI review never
                  starts automatically.
                </p>
              )}
            </section>

            <section aria-labelledby="next-actions-title" className="workspace-section">
              <div className="workspace-section-header">
                <div>
                  <h2 id="next-actions-title">Recommended next actions</h2>
                  <p className="hint">Up to ten pending actions across your active applications.</p>
                </div>
                <span className="hint">
                  {applications.length} active application{applications.length === 1 ? "" : "s"}
                </span>
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
          </div>

          <aside className="workspace-side">
            <section aria-labelledby="evidence-title" className="card workspace-side-card">
              <h2 id="evidence-title">Evidence</h2>
              <p className="hint">Reusable stories and answers you own.</p>
              <dl className="workspace-metric-grid">
                <div>
                  <dt>{bank.readyAnswers} / 14</dt>
                  <dd>answers prepared</dd>
                </div>
                <div>
                  <dt>{bank.stories}</dt>
                  <dd>stories saved</dd>
                </div>
                <div>
                  <dt>{bank.competenciesCovered} / 10</dt>
                  <dd>competencies</dd>
                </div>
              </dl>
              <p className="hint workspace-next-action">
                Next: <strong>{bank.nextAction}</strong>
              </p>
              <Link className="button-link" href="/member/learn/answer-bank">
                Open Answer Bank
              </Link>
            </section>

            <section aria-labelledby="saved-employers-title" className="card workspace-side-card">
              <div className="workspace-section-header">
                <h2 id="saved-employers-title">Saved employers</h2>
                {savedEmployers.length > 0 && (
                  <Link className="hint" href="/member/saved-jobs">
                    Saved jobs →
                  </Link>
                )}
              </div>
              {savedEmployers.length === 0 ? (
                <>
                  <p className="hint">Follow employers to see their current roles here.</p>
                  <Link className="button-link button-secondary compact-button" href="/employers">
                    Explore employers
                  </Link>
                </>
              ) : (
                <ul className="workspace-saved-list">
                  {savedEmployers.slice(0, 4).map((employer) => (
                    <li key={employer.companyId}>
                      <Link href={`/employers/${employer.slug}`}>{employer.name}</Link>
                      <span className="hint">
                        {employer.current_jobs > 0
                          ? `${employer.current_jobs} role${employer.current_jobs === 1 ? "" : "s"}`
                          : "No current roles"}
                        {employer.has_sponsor ? " · sponsor" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card workspace-side-card workspace-tip">
              <p className="eyebrow">How workspace works</p>
              <p className="hint">
                This is a direct workspace, not a course. Add what you need, work in any order.
                Recommendations and plans are optional.
              </p>
            </section>
          </aside>
        </div>
      )}
    </main>
  );
}
