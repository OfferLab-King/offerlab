import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  jobSectorLabel,
  jobSubsectorLabel,
  remoteTypeLabels,
} from "../../../modules/job-catalog/domain/taxonomy";
import { employerIndustryLabel } from "../../../modules/job-catalog/domain/employer-directory";
import { escapeJsonLd } from "../../../modules/job-catalog/domain/publication";
import {
  readEmployerActiveJobs,
  readEmployerProfile,
} from "../../../modules/job-catalog/application/catalog";
import { JobCard } from "../../jobs/job-card";
import { EmployerMark } from "../../jobs/employer-mark";
import { SiteHeader } from "../../components/site-header";
import { currentMemberAccess } from "../../../modules/identity-access/application/authorization";
import { isEmployerSavedForMember } from "../../../modules/job-catalog/application/saved-employers";
import { saveEmployer, unsaveEmployer } from "./actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EmployerParams = Promise<{ slug: string }>;

function employerMetaDescription(employer: { description: string | null; name: string }): string {
  if (employer.description) return employer.description;
  return `${employer.name} employer profile on OfferLab, with roles sourced from the employer's official careers sources plus official website and careers links.`;
}

export async function generateMetadata({ params }: { params: EmployerParams }): Promise<Metadata> {
  const { slug } = await params;
  const employer = await readEmployerProfile(slug);
  if (!employer) {
    return { robots: { index: false, follow: false }, title: "Employer not found | OfferLab" };
  }
  if (!employer.indexable) {
    return {
      alternates: { canonical: `/employers/${employer.slug}` },
      robots: { index: false, follow: true },
      title: `${employer.name} | OfferLab`,
    };
  }
  return {
    alternates: { canonical: `/employers/${employer.slug}` },
    description: employerMetaDescription(employer),
    title: `${employer.name} | UK Employer Profile and Jobs | OfferLab`,
  };
}

export default async function EmployerProfilePage({ params }: { params: EmployerParams }) {
  const { slug } = await params;
  const [employer, access] = await Promise.all([readEmployerProfile(slug), currentMemberAccess()]);
  if (!employer) notFound();
  const memberId = access.status === "eligible" ? access.authorization.userId : null;
  const [jobs, saved] = await Promise.all([
    readEmployerActiveJobs(employer.id),
    memberId !== null && employer.id
      ? isEmployerSavedForMember(memberId, employer.id)
      : Promise.resolve(false),
  ]);
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
  const opportunityTypes = [
    ...new Set(jobs.flatMap((job) => (job.opportunity_type ? [job.opportunity_type] : []))),
  ];
  const opportunityLabels: Readonly<Record<string, string>> = {
    graduate_scheme: "Graduate programmes",
    graduate_job: "Graduate jobs",
    internship: "Internships",
    industrial_placement: "Industrial placements",
    work_experience: "Work experience",
    apprenticeship: "Apprenticeships",
    degree_apprenticeship: "Degree apprenticeships",
    training_contract: "Training contracts",
    vacation_scheme: "Vacation schemes",
    immediate_start: "Immediate-start roles",
    entry_level: "Entry-level roles",
    postgraduate_opportunity: "Postgraduate opportunities",
    other_early_career: "Early-career roles",
    unknown: "",
  };
  const opportunities = opportunityTypes
    .map((key) => opportunityLabels[key] ?? "")
    .filter((label): label is string => label.length > 0);
  const profile = employer.publicProfile;
  const industryLabel = employerIndustryLabel(profile?.employer_industry_key ?? null);

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
  const structuredData = employer.indexable
    ? [
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          logo: employer.logo_url ?? undefined,
          name: employer.name,
          url: employer.website_url ?? employer.careers_url ?? undefined,
        },
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Employers",
              item: new URL("/employers", base).toString(),
            },
            {
              "@type": "ListItem",
              position: 2,
              name: employer.name,
              item: new URL(`/employers/${employer.slug}`, base).toString(),
            },
          ],
        },
      ]
    : null;

  return (
    <main className="employer-profile-page">
      <SiteHeader />

      <div className="employer-profile">
        <nav aria-label="Breadcrumb" className="seo-breadcrumb">
          <ol>
            <li>
              <Link href="/employers">Employers</Link>
            </li>
            <li aria-current="page">{employer.name}</li>
          </ol>
        </nav>

        {structuredData && (
          <script
            dangerouslySetInnerHTML={{ __html: escapeJsonLd(structuredData) }}
            type="application/ld+json"
          />
        )}

        <header className="employer-profile-card">
          <div className="employer-profile-mark">
            <EmployerMark companyName={employer.name} logoUrl={employer.logo_url} />
          </div>
          <div className="employer-profile-heading">
            {industryLabel && <p className="employer-profile-industry">{industryLabel}</p>}
            <h1>{employer.name}</h1>
            {employer.description && (
              <p className="employer-profile-description">{employer.description}</p>
            )}
          </div>
        </header>

        {profile && (
          <section className="employer-profile-facts" aria-labelledby="employer-facts">
            <h2 id="employer-facts">Quick facts</h2>
            <dl>
              {industryLabel && (
                <div>
                  <dt>Industry</dt>
                  <dd>{industryLabel}</dd>
                </div>
              )}
              {profile.employee_band && (
                <div>
                  <dt>Company size</dt>
                  <dd>
                    {profile.employee_band}
                    {profile.employee_scope ? ` (${profile.employee_scope})` : ""}
                  </dd>
                </div>
              )}
              {profile.ownership_type && (
                <div>
                  <dt>Ownership</dt>
                  <dd>{profile.ownership_type}</dd>
                </div>
              )}
              {profile.ticker && (
                <div>
                  <dt>Listed as</dt>
                  <dd>
                    {profile.ticker}
                    {profile.exchange ? ` · ${profile.exchange}` : ""}
                  </dd>
                </div>
              )}
              {profile.has_sponsor && (
                <div>
                  <dt>UK licensed sponsor</dt>
                  <dd>
                    On the Home Office sponsor register
                    {profile.sponsor_snapshot_date
                      ? ` · verified ${profile.sponsor_snapshot_date.toISOString().slice(0, 10)}`
                      : ""}
                  </dd>
                </div>
              )}
              {profile.facts_as_of && (
                <div>
                  <dt>Profile facts as of</dt>
                  <dd>{profile.facts_as_of.toISOString().slice(0, 10)}</dd>
                </div>
              )}
            </dl>
            <p className="employer-profile-facts-note">
              Sponsorship availability varies by role and candidate; employer-level evidence does
              not guarantee sponsorship for a specific vacancy.
            </p>
          </section>
        )}

        {opportunities.length > 0 && (
          <section className="employer-profile-opportunities" aria-labelledby="employer-opps">
            <h2 id="employer-opps">Opportunities</h2>
            <p>Current OfferLab roles include: {opportunities.join(", ").toLowerCase()}.</p>
          </section>
        )}

        <dl className="employer-profile-stats">
          <div className="employer-profile-stat">
            <dt>Current roles</dt>
            <dd>{employer.active_jobs}</dd>
          </div>
          {employer.imported_jobs > 0 && (
            <div className="employer-profile-stat">
              <dt>Roles tracked</dt>
              <dd>{employer.imported_jobs}</dd>
            </div>
          )}
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
          {memberId !== null ? (
            <form action={saved ? unsaveEmployer : saveEmployer}>
              <input type="hidden" name="companyId" value={employer.id} />
              <button className="button-link" type="submit">
                {saved ? "Remove from saved employers" : "Save employer"}
              </button>
            </form>
          ) : (
            <Link className="button-link secondary" href="/sign-in">
              Sign in to save employers
            </Link>
          )}
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
              {employer.imported_jobs > 0 && (
                <>
                  {" "}
                  OfferLab has previously tracked {employer.imported_jobs}{" "}
                  {employer.imported_jobs === 1 ? "role" : "roles"} from those sources.
                </>
              )}
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
