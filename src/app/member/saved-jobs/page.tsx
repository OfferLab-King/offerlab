import Link from "next/link";
import { notFound } from "next/navigation";

import { requireMember } from "../../../modules/identity-access/application/authorization";
import { isJobCatalogEnabled } from "../../../modules/job-catalog/application/config";
import { listSavedJobsForMember } from "../../../modules/job-catalog/application/saved-jobs";
import { formatDate, isDeadlinePassed } from "../../jobs/job-display";
import { MemberApplicationsHeader } from "../applications/member-applications-header";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SavedJobsPage() {
  if (!isJobCatalogEnabled()) notFound();
  const authorization = await requireMember();
  const jobs = await listSavedJobsForMember(authorization.userId);
  const now = new Date();

  return (
    <main className="applications-shell">
      <MemberApplicationsHeader />
      <header className="applications-heading">
        <div>
          <p className="eyebrow">Member workspace</p>
          <h1>Saved jobs</h1>
          <p>
            Roles you saved from the OfferLab job catalogue. Applications always happen on the
            employer&apos;s official website.
          </p>
        </div>
      </header>
      {jobs.length === 0 ? (
        <section className="job-catalog-empty">
          <h2>No saved roles yet</h2>
          <p>
            Browse the job catalogue and save roles you are interested in. Saved roles stay in your
            workspace so you can return to them.
          </p>
          <Link className="button-link" href="/jobs">
            Browse jobs
          </Link>
        </section>
      ) : (
        <ul className="saved-jobs-list">
          {jobs.map((job) => {
            const deadlinePassed = isDeadlinePassed(job.application_deadline, now);
            return (
              <li className="saved-job-row" key={job.id}>
                <div>
                  <h2>
                    <Link href={`/jobs/${job.slug}`}>{job.normalized_title ?? job.title}</Link>
                  </h2>
                  <p>
                    {job.company_name}
                    {job.location_text ? ` · ${job.location_text}` : ""}
                    {job.application_deadline
                      ? ` · Deadline ${deadlinePassed ? "closed" : formatDate(job.application_deadline)}`
                      : ""}
                  </p>
                </div>
                <div className="saved-job-row-actions">
                  {!job.active && (
                    <span className="job-card-freshness">No longer listed as open</span>
                  )}
                  <Link className="button-link secondary" href={`/jobs/${job.slug}`}>
                    View role
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
