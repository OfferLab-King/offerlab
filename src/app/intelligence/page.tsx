import type { Metadata } from "next";
import Link from "next/link";
import { recruitmentStages } from "../../modules/applications/domain/application";
import { readPublicIntelligenceReports } from "../../modules/recruitment-intelligence/application/reports";
import { parseReportFilters } from "../../modules/recruitment-intelligence/domain/report";
import { IntelligenceReportCard } from "../components/intelligence-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const baseMetadata: Metadata = {
  title: "Graduate Recruitment and Interview Experiences | OfferLab",
  description:
    "Search moderated, cycle-dated candidate experiences for graduate interviews, online tests and assessment centres.",
  alternates: { canonical: "/intelligence" },
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw))
    if (typeof value === "string") params.set(key, value);
  const filters = parseReportFilters(params);
  const filtered =
    filters.query !== "" || filters.stage !== undefined || filters.cycle !== undefined ||
    filters.industry !== undefined;
  return filtered ? { ...baseMetadata, robots: { index: false, follow: true } } : baseMetadata;
}

export default async function PublicIntelligencePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw))
    if (typeof value === "string") params.set(key, value);
  const filters = parseReportFilters(params);
  const reports = await readPublicIntelligenceReports(filters);
  return (
    <main className="public-intelligence-page">
      <nav aria-label="Public" className="public-intelligence-nav">
        <Link className="brand" href="/">
          OfferLab
        </Link>
        <div>
          <Link href="/sign-in">Sign in</Link>
          <Link className="button-link" href="/register">
            Join OfferLab
          </Link>
        </div>
      </nav>
      <header className="public-intelligence-hero">
        <p className="eyebrow">Graduate recruitment intelligence</p>
        <h1>Find out what recent candidate processes involved</h1>
        <p className="intro">
          Search moderated experiences from interviews, online tests, technical interviews and
          assessment centres. Every report is dated and checked before publication.
        </p>
      </header>
      <form className="intelligence-public-search" method="get" role="search">
        <label>
          Employer or role
          <input defaultValue={filters.query} name="q" placeholder="e.g. EY audit" type="search" />
        </label>
        <label>
          Stage
          <select defaultValue={filters.stage ?? ""} name="stage">
            <option value="">All stages</option>
            {Object.entries(recruitmentStages).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Search experiences</button>
      </form>
      <section className="public-intelligence-results" aria-labelledby="experience-results">
        {reports.length ? (
          <>
            <div>
              <p className="eyebrow">Current reports</p>
              <h2 id="experience-results">
                {reports.length} moderated {reports.length === 1 ? "experience" : "experiences"}
              </h2>
            </div>
            <div className="intelligence-grid">
              {reports.map((report) => (
                <IntelligenceReportCard
                  href={`/intelligence/${report.slug}`}
                  key={report.id}
                  report={report}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="card empty-state">
            <h2>No report matches your search yet</h2>
            <p>
              OfferLab publishes only useful, confidential and clearly dated reports. Clear the
              search, or join to explore preparation resources while the intelligence library
              grows.
            </p>
            <Link className="button-link" href="/register">
              Create free account
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
