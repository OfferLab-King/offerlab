import Link from "next/link";
import { recruitmentStages } from "../../../../modules/applications/domain/application";
import { requireMember } from "../../../../modules/identity-access/application/authorization";
import {
  readIntelligenceReports,
  readMyIntelligenceReports,
} from "../../../../modules/recruitment-intelligence/application/reports";
import { parseReportFilters } from "../../../../modules/recruitment-intelligence/domain/report";
import { industries } from "../../../../modules/taxonomy/domain/industries";
import { IntelligenceReportCard } from "../../../components/intelligence-report";
import { LearnNavigation } from "../learn-navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function IntelligencePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { userId } = await requireMember();
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw))
    if (typeof value === "string") params.set(key, value);
  const filters = parseReportFilters(params);
  const [reports, mine] = await Promise.all([
    readIntelligenceReports(userId, filters),
    readMyIntelligenceReports(userId),
  ]);
  const hasFilters = Boolean(filters.query || filters.stage || filters.industry || filters.cycle);
  return (
    <main className="applications-shell intelligence-library-page">
      <LearnNavigation active="intelligence" />
      <section className="applications-heading intelligence-heading">
        <div>
          <p className="eyebrow">Current, moderated candidate experience</p>
          <h1>Recruitment Intelligence</h1>
          <p className="intro">
            Find recent reports by employer, role, stage and cycle. Every report is reviewed for
            usefulness, anonymity and confidentiality before publication.
          </p>
        </div>
        <Link className="button-link" href="/member/learn/intelligence/share">
          Share an experience
        </Link>
      </section>
      {raw.result === "submitted" && (
        <p className="success-summary" role="status">
          Report submitted for moderation. Your identity will not appear on the published report.
        </p>
      )}
      <form className="intelligence-filters" method="get" role="search">
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
        <label>
          Industry
          <select defaultValue={filters.industry ?? ""} name="industry">
            <option value="">All industries</option>
            {Object.entries(industries).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Cycle
          <input defaultValue={filters.cycle ?? ""} name="cycle" placeholder="2026/27" />
        </label>
        <div className="intelligence-filter-actions">
          <button type="submit">Search reports</button>
          {hasFilters && <Link href="/member/learn/intelligence">Clear</Link>}
        </div>
      </form>
      <section className="learn-section" aria-labelledby="published-intelligence">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Moderated reports</p>
            <h2 id="published-intelligence">
              {reports.length} {reports.length === 1 ? "experience" : "experiences"}
            </h2>
          </div>
        </div>
        {reports.length ? (
          <div className="intelligence-grid">
            {reports.map((report) => (
              <IntelligenceReportCard
                href={`/member/learn/intelligence/${report.slug}`}
                key={report.id}
                report={report}
              />
            ))}
          </div>
        ) : (
          <section className="card empty-state intelligence-empty-state">
            <h2>No exact report yet</h2>
            <p>
              Try a broader employer or stage search. If you attend this process, you can help the
              next candidate by submitting a structured, confidential report.
            </p>
            <Link href="/member/learn/intelligence/share">Share an experience</Link>
          </section>
        )}
      </section>
      {mine.length > 0 && (
        <section className="learn-section intelligence-submissions" aria-labelledby="your-reports">
          <h2 id="your-reports">Your submissions</h2>
          <ul>
            {mine.map((report) => (
              <li key={report.id}>
                <span>
                  <strong>{report.companyName}</strong> · {report.roleTitle}
                </span>
                <span className="status-badge">{report.moderationState}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
