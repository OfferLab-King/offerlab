import Link from "next/link";

import {
  jobSectorLabel,
  opportunityTypeLabels,
  remoteTypeLabels,
  visaSponsorshipLabels,
} from "../../modules/job-catalog/domain/taxonomy";
import type { JobCardRow } from "../../modules/job-catalog/application/catalog";
import { formatDate, formatRelativeTime, formatSalary, isDeadlinePassed } from "./job-display";
import { EmployerMark } from "./employer-mark";
import { JobSaveButton } from "./job-save-button";

export function JobCard({
  job,
  now,
  showSave = true,
}: Readonly<{ job: JobCardRow; now: Date; showSave?: boolean }>) {
  const salary = formatSalary(
    job.salary_min === null ? null : Number(job.salary_min),
    job.salary_max === null ? null : Number(job.salary_max),
    job.salary_currency,
    job.salary_period,
  );
  const deadlinePassed = isDeadlinePassed(job.application_deadline, now);
  const firstSeen = new Date(job.first_seen_at);
  const isNew = firstSeen.getTime() > now.getTime() - 7 * 86_400_000;
  const closingSoon =
    !deadlinePassed &&
    job.application_deadline !== null &&
    new Date(job.application_deadline).getTime() < now.getTime() + 14 * 86_400_000;
  const sponsorshipKnown =
    job.visa_sponsorship_status !== "unknown" && job.visa_sponsorship_status !== "unlikely";
  const workLabel =
    job.remote_type && job.remote_type !== "unknown"
      ? remoteTypeLabels[job.remote_type as keyof typeof remoteTypeLabels]
      : null;
  const typeLabel =
    job.opportunity_type && job.opportunity_type !== "unknown"
      ? opportunityTypeLabels[job.opportunity_type as keyof typeof opportunityTypeLabels]
      : null;
  const sectorLabel = jobSectorLabel(job.sector_key);

  return (
    <article className="job-card">
      <EmployerMark companyName={job.company_name} logoUrl={job.company_logo_url} />
      <div className="job-card-main">
        <div className="job-card-heading-text">
          <p className="job-card-company">
            <Link href={`/employers/${job.company_slug}` as never}>{job.company_name}</Link>
          </p>
          <h2 className="job-card-title">
            <Link href={`/jobs/${job.slug}`}>{job.normalized_title ?? job.title}</Link>
          </h2>
          {job.location_text && <p className="job-card-location">{job.location_text}</p>}
        </div>

        <div className="job-card-details">
          <div className="job-card-meta">
            {typeLabel && <span className="job-tag">{typeLabel}</span>}
            {workLabel && <span className="job-tag">{workLabel}</span>}
            {sectorLabel && <span className="job-tag">{sectorLabel}</span>}
          </div>
          <div className="job-card-facts">
            {salary && (
              <span className="job-fact">
                <span className="job-fact-label">Salary</span>
                {salary}
              </span>
            )}
            {job.application_deadline && (
              <span className="job-fact">
                <span className="job-fact-label">Deadline</span>
                {deadlinePassed ? "Closed" : formatDate(job.application_deadline)}
              </span>
            )}
            {sponsorshipKnown && (
              <span className="job-fact">
                <span className="job-fact-label">Visa</span>
                {
                  visaSponsorshipLabels[
                    job.visa_sponsorship_status as keyof typeof visaSponsorshipLabels
                  ]
                }
              </span>
            )}
            <span className="job-fact">
              <span className="job-fact-label">Posted</span>
              {job.posted_at
                ? formatDate(job.posted_at)
                : formatRelativeTime(job.first_seen_at, now)}
            </span>
          </div>
        </div>
      </div>

      <div className="job-card-side">
        <div className="job-card-flags">
          {isNew && <span className="job-flag job-flag-new">New</span>}
          {closingSoon && <span className="job-flag job-flag-closing">Closing soon</span>}
        </div>
        {showSave && <JobSaveButton jobId={job.id} />}
        <Link className="job-card-view" href={`/jobs/${job.slug}`}>
          <span>View role</span>
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}
