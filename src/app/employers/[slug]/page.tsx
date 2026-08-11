import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  jobSectorLabel,
  jobSubsectorLabel,
  remoteTypeLabels,
} from "../../../modules/job-catalog/domain/taxonomy";
import {
  readEmployerActiveJobs,
  readEmployerProfile,
} from "../../../modules/job-catalog/application/catalog";
import { JobCard } from "../../jobs/job-card";
import { EmployerMark } from "../../jobs/employer-mark";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EmployerParams = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: EmployerParams }): Promise<Metadata> {
  const { slug } = await params;
  const employer = await readEmployerProfile(slug);
  if (!employer) return { title: "Employer not found | OfferLab" };
  return {
    alternates: { canonical: `/employers/${employer.slug}` },
    description: employer.description
      ? `${employer.description} Browse open roles at ${employer.name}.`
      : `Browse open roles at ${employer.name}, sourced from their official careers site.`,
    title: `${employer.name} Jobs | OfferLab`,
  };
}

export default async function EmployerProfilePage({ params }: { params: EmployerParams }) {
  const { slug } = await params;
  const employer = await readEmployerProfile(slug);
  if (!employer) notFound();
  const jobs = await readEmployerActiveJobs(employer.id);
  const now = new Date();

  const sectors = [...new Set(jobs.flatMap((job) => (job.sector_key ? [job.sector_key] : [])))];
  const subsectors = [
    ...new Set(jobs.flatMap((job) => (job.subsector_key ? [job.subsector_key] : []))),
  ];
  const locations = [
    ...new Set(
      jobs.flatMap((job) => {
        const list = job.location_text ? [job.location_text] : [];
        if (job.remote_type && job.remote_type !== "unknown") {
          list.push(
            remoteTypeLabels[job.remote_type as keyof typeof remoteTypeLabels] ?? job.remote_type,
          );
        }
        return list;
      }),
    ),
  ];

  return (
    <main className="employer-profile-page">
      <div className="catalogue-topbar">
        <Link className="brand" href="/">
          OfferLab
        </Link>
        <nav aria-label="Public">
          <Link href="/jobs">Jobs</Link>
          <Link href="/employers">Employers &amp; sectors</Link>
          <Link href="/sign-in">Sign in</Link>
        </nav>
      </div>

      <div className="employer-profile">
        <header className="employer-profile-card">
          <div className="employer-profile-mark">
            <EmployerMark companyName={employer.name} logoUrl={employer.logo_url} />
          </div>
          <div className="employer-profile-heading">
            {employer.industry && <p className="employer-profile-industry">{employer.industry}</p>}
            <h1>{employer.name}</h1>
            {employer.description && (
              <p className="employer-profile-description">{employer.description}</p>
            )}
          </div>
        </header>

        <dl className="employer-profile-stats">
          <div className="employer-profile-stat">
            <dt>Active roles</dt>
            <dd>{employer.active_jobs}</dd>
          </div>
          {sectors.length > 0 && (
            <div className="employer-profile-stat">
              <dt>Sectors</dt>
              <dd>
                {sectors
                  .map((key) => jobSectorLabel(key))
                  .filter(Boolean)
                  .join(", ")}
              </dd>
            </div>
          )}
          {subsectors.length > 0 && (
            <div className="employer-profile-stat">
              <dt>Areas</dt>
              <dd>
                {subsectors
                  .map((key) => jobSubsectorLabel(key))
                  .filter(Boolean)
                  .join(", ")}
              </dd>
            </div>
          )}
          {locations.length > 0 && (
            <div className="employer-profile-stat">
              <dt>Locations</dt>
              <dd>{locations.slice(0, 8).join(", ")}</dd>
            </div>
          )}
        </dl>

        <div className="employer-profile-links">
          {employer.website_url && (
            <a
              className="button-link secondary"
              href={employer.website_url}
              rel="nofollow noopener noreferrer"
              target="_blank"
            >
              Visit employer website
            </a>
          )}
          {employer.careers_url && (
            <a
              className="button-link secondary"
              href={employer.careers_url}
              rel="nofollow noopener noreferrer"
              target="_blank"
            >
              Official careers page
            </a>
          )}
          <Link
            className="button-link secondary"
            href={`/jobs?employers=${employer.slug}` as never}
          >
            View all {employer.name} jobs
          </Link>
        </div>

        <section className="employer-profile-jobs" aria-labelledby="employer-jobs">
          <h2 id="employer-jobs">Open roles</h2>
          {jobs.length === 0 ? (
            <p className="employer-profile-empty">
              {employer.name} has no roles currently listed through their official careers sources.
            </p>
          ) : (
            <div className="public-jobs-results">
              {jobs.map((job) => (
                <JobCard job={job} key={job.id} now={now} />
              ))}
            </div>
          )}
        </section>

        <footer className="employer-profile-note">
          <p>
            Source: {employer.name} Careers. OfferLab is not the employer and has no partnership
            with {employer.name}. Applications happen on the employer&apos;s official website.
          </p>
        </footer>
      </div>
    </main>
  );
}
