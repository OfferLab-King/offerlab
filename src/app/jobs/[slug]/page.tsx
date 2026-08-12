import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { isPubliclyVisible, escapeJsonLd } from "../../../modules/job-catalog/domain/publication";
import { isJobIndexable } from "../../../modules/job-catalog/domain/job-indexability";
import { currentMemberAccess } from "../../../modules/identity-access/application/authorization";
import { isJobSavedForMember } from "../../../modules/job-catalog/application/saved-jobs";
import { readJobDetail, readRelatedJobs } from "../../../modules/job-catalog/application/catalog";
import {
  employmentTypeLabels,
  jobSectorLabel,
  jobSubsectorLabel,
  opportunityTypeLabels,
  remoteTypeLabels,
  visaSponsorshipLabels,
} from "../../../modules/job-catalog/domain/taxonomy";
import { formatDate, formatRelativeTime, formatSalary, isDeadlinePassed } from "../job-display";
import { SiteHeader } from "../../components/site-header";
import { JobCard } from "../job-card";
import { EmployerMark } from "../employer-mark";
import { ApplyTrackingLink } from "./apply-tracking";
import { SaveJobButton } from "./save-job-button";
import { buildJobDetailMetadata } from "./job-detail-metadata";
import { buildJobStructuredData } from "./job-structured-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JobDetailParams = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: JobDetailParams }): Promise<Metadata> {
  const { slug } = await params;
  const job = await readJobDetail(slug);
  return buildJobDetailMetadata(job, new Date());
}

export default async function JobDetailPage({ params }: { params: JobDetailParams }) {
  const { slug } = await params;
  const job = await readJobDetail(slug);
  const now = new Date();
  if (!job || !isPubliclyVisible(job, now)) notFound();
  const indexable = isJobIndexable(job, now);

  const access = await currentMemberAccess();
  const memberSaved =
    access.status === "eligible"
      ? await isJobSavedForMember(access.authorization.userId, job.id)
      : false;
  const deadlinePassed = isDeadlinePassed(job.application_deadline, now);
  const salary = formatSalary(
    job.salary_min === null ? null : Number(job.salary_min),
    job.salary_max === null ? null : Number(job.salary_max),
    job.salary_currency,
    job.salary_period,
  );
  const enriched = job.enrichment_version !== null && job.enrichment_model !== null;
  const fresh = job.last_successful_check_at
    ? (now.getTime() - new Date(job.last_successful_check_at).getTime()) / 3_600_000 < 24
    : false;
  const subsectorLabel = jobSubsectorLabel(job.subsector_key);
  const sectorLabel = jobSectorLabel(job.sector_key);
  const related = await readRelatedJobs(job);

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
  const structuredData = indexable ? buildJobStructuredData(job, now, base) : null;

  return (
    <main className="public-jobs-page job-detail-page">
      <SiteHeader />

      {structuredData && (
        <script
          dangerouslySetInnerHTML={{ __html: escapeJsonLd(structuredData) }}
          type="application/ld+json"
        />
      )}

      <article className="job-detail">
        <nav aria-label="Breadcrumb" className="seo-breadcrumb">
          <ol>
            <li>
              <Link href="/jobs">Jobs</Link>
            </li>
            <li aria-current="page">{job.normalized_title ?? job.title}</li>
          </ol>
        </nav>

        <header className="job-detail-header">
          <div className="job-detail-heading-row">
            <EmployerMark companyName={job.company_name} logoUrl={job.company_logo_url} />
            <div className="job-detail-heading-text">
              <p className="eyebrow">Source: {job.company_name} Careers</p>
              <h1>{job.normalized_title ?? job.title}</h1>
            </div>
          </div>
          <p className="job-detail-location">{job.location_text || "Location not specified"}</p>
          <div className="job-detail-actions">
            <ApplyTrackingLink applicationUrl={job.application_url} />
            <SaveJobButton initiallySaved={memberSaved} jobId={job.id} />
          </div>
          <p className="job-detail-apply-note">
            Application is completed on the employer&apos;s official website.
          </p>
          <p className="job-detail-employer-profile-link">
            <Link href={`/employers/${job.company_slug}` as never}>
              {job.company_name} employer profile on OfferLab
            </Link>
          </p>
        </header>

        <dl className="job-detail-facts">
          {job.opportunity_type && job.opportunity_type !== "unknown" && (
            <div>
              <dt>Opportunity type</dt>
              <dd>
                {opportunityTypeLabels[
                  job.opportunity_type as keyof typeof opportunityTypeLabels
                ] ?? job.opportunity_type}
              </dd>
            </div>
          )}
          {sectorLabel && job.sector_key && (
            <div>
              <dt>Sector</dt>
              <dd>
                <Link
                  href={`/employers?sector=${job.sector_key}#sector-${job.sector_key}` as never}
                >
                  {sectorLabel}
                </Link>
              </dd>
            </div>
          )}
          {subsectorLabel && job.sector_key && (
            <div>
              <dt>Subsector</dt>
              <dd>
                <Link
                  href={
                    `/employers?sector=${job.sector_key}&subsector=${job.subsector_key}#sector-${job.sector_key}` as never
                  }
                >
                  {subsectorLabel}
                </Link>
              </dd>
            </div>
          )}
          {job.employment_type && (
            <div>
              <dt>Employment type</dt>
              <dd>
                {employmentTypeLabels[job.employment_type as keyof typeof employmentTypeLabels] ??
                  job.employment_type}
              </dd>
            </div>
          )}
          {job.remote_type && job.remote_type !== "unknown" && (
            <div>
              <dt>Work mode</dt>
              <dd>
                {remoteTypeLabels[job.remote_type as keyof typeof remoteTypeLabels] ??
                  job.remote_type}
              </dd>
            </div>
          )}
          {salary && (
            <div>
              <dt>Salary</dt>
              <dd>{salary}</dd>
            </div>
          )}
          {job.application_deadline && (
            <div>
              <dt>Application deadline</dt>
              <dd className={deadlinePassed ? "job-deadline-passed" : undefined}>
                {deadlinePassed ? "Closed" : formatDate(job.application_deadline)}
              </dd>
            </div>
          )}
          {job.posted_at && (
            <div>
              <dt>Posted</dt>
              <dd>{formatDate(job.posted_at)}</dd>
            </div>
          )}
          <div>
            <dt>First seen</dt>
            <dd>{formatDate(job.first_seen_at)}</dd>
          </div>
          <div>
            <dt>Last checked</dt>
            <dd>{formatRelativeTime(job.last_seen_at, now)}</dd>
          </div>
          <div>
            <dt>Freshness</dt>
            <dd>
              {fresh
                ? "Verified from employer careers site today"
                : "Source check is older than 24 hours"}
            </dd>
          </div>
        </dl>

        {job.description_summary && (
          <section
            className="job-detail-section job-detail-summary"
            aria-labelledby="offerlab-summary"
          >
            <h2 id="offerlab-summary">OfferLab summary</h2>
            <p>{job.description_summary}</p>
            {enriched && (
              <p className="job-detail-ai-note">
                AI-generated summary from the employer&apos;s posting. Facts such as location and
                deadline come from the posting itself, not from OfferLab.
              </p>
            )}
          </section>
        )}

        {job.responsibilities.length > 0 && (
          <section className="job-detail-section" aria-labelledby="responsibilities">
            <h2 id="responsibilities">Key responsibilities</h2>
            <ul>
              {job.responsibilities.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        )}

        {job.requirements.length > 0 && (
          <section className="job-detail-section" aria-labelledby="requirements">
            <h2 id="requirements">Essential requirements</h2>
            <ul>
              {job.requirements.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        )}

        {job.preferred_skills.length > 0 && (
          <section className="job-detail-section" aria-labelledby="preferred">
            <h2 id="preferred">Preferred requirements</h2>
            <ul>
              {job.preferred_skills.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        )}

        {job.skills.length > 0 && (
          <section className="job-detail-section" aria-labelledby="skills">
            <h2 id="skills">Skills</h2>
            <ul className="job-detail-tags">
              {job.skills.map((skill) => (
                <li key={skill}>{skill}</li>
              ))}
            </ul>
          </section>
        )}

        {job.degree_requirements.length > 0 && (
          <section className="job-detail-section" aria-labelledby="qualifications">
            <h2 id="qualifications">Qualifications</h2>
            <ul>
              {job.degree_requirements.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        )}

        {job.experience_requirements && (
          <section className="job-detail-section" aria-labelledby="experience">
            <h2 id="experience">Experience required</h2>
            <p>{job.experience_requirements}</p>
          </section>
        )}

        <section className="job-detail-section" aria-labelledby="sponsorship">
          <h2 id="sponsorship">Visa sponsorship</h2>
          {job.visa_sponsorship_status === "unknown" ? (
            <p>Not specified in the posting.</p>
          ) : (
            <>
              <p>
                {
                  visaSponsorshipLabels[
                    job.visa_sponsorship_status as keyof typeof visaSponsorshipLabels
                  ]
                }
              </p>
              {job.visa_sponsorship_evidence && (
                <blockquote className="job-detail-evidence">
                  &ldquo;{job.visa_sponsorship_evidence}&rdquo;
                </blockquote>
              )}
            </>
          )}
        </section>

        {related.sameEmployer.length > 0 && (
          <section
            className="job-detail-section job-detail-related"
            aria-labelledby="related-employer"
          >
            <h2 id="related-employer">More roles at {job.company_name}</h2>
            <div className="public-jobs-results">
              {related.sameEmployer.map((item) => (
                <JobCard job={item} key={item.id} now={now} showSave={false} />
              ))}
            </div>
          </section>
        )}

        {related.similar.length > 0 && (
          <section
            className="job-detail-section job-detail-related"
            aria-labelledby="related-similar"
          >
            <h2 id="related-similar">Similar current roles</h2>
            <div className="public-jobs-results">
              {related.similar.map((item) => (
                <JobCard job={item} key={item.id} now={now} showSave={false} />
              ))}
            </div>
          </section>
        )}

        <footer className="job-detail-footer">
          <p>
            Source: <Link href={job.company_careers_url as never}>{job.company_name} Careers</Link>.
            OfferLab is not the employer and has no partnership with {job.company_name}. Role
            details are taken from the public posting.
          </p>
          <p>
            First seen {formatDate(job.first_seen_at)} · Last verified{" "}
            {formatRelativeTime(job.last_seen_at, now)}
          </p>
          <p>
            <ApplyTrackingLink
              applicationUrl={job.application_url}
              label="Apply on employer website"
            />
          </p>
        </footer>
      </article>
    </main>
  );
}
