import Link from "next/link";
import { requireAdministrator } from "../../../modules/identity-access/application/authorization";
import { readIntelligenceReportsForAdmin } from "../../../modules/recruitment-intelligence/application/reports";
import { recruitmentStageLabel } from "../../../modules/taxonomy/domain/display-labels";
import { moderateIntelligenceAction } from "./actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminIntelligencePage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  const administrator = await requireAdministrator();
  const [reports, query] = await Promise.all([
    readIntelligenceReportsForAdmin(administrator.userId),
    searchParams,
  ]);
  const pending = reports.filter((report) => report.moderationState === "pending").length;
  const published = reports.filter((report) => report.moderationState === "published").length;
  return (
    <main className="cms-page">
      <header className="cms-page-header">
        <div>
          <p className="eyebrow">Recruitment Intelligence</p>
          <h1>Experience reports</h1>
          <p>Create coach-curated reports and moderate confidential member contributions.</p>
        </div>
        <Link className="button-link" href="/admin/intelligence/new">
          Create report
        </Link>
      </header>
      {query.result === "saved" && <p className="success-summary">Report status updated.</p>}
      {query.result === "error" && (
        <p className="error-summary">The report could not be updated.</p>
      )}
      <section className="cms-summary-grid" aria-label="Report summary">
        <div>
          <strong>{reports.length}</strong>
          <span>Total</span>
        </div>
        <div>
          <strong>{pending}</strong>
          <span>Awaiting review</span>
        </div>
        <div>
          <strong>{published}</strong>
          <span>Published</span>
        </div>
        <div>
          <strong>
            {reports.filter((report) => report.sourceKind === "coach_curated").length}
          </strong>
          <span>Coach-curated</span>
        </div>
      </section>
      <div className="cms-content-list cms-intelligence-list">
        {reports.map((report) => (
          <article className="cms-content-row" key={report.id}>
            <div className="cms-content-row-main">
              <div className="cms-content-badges">
                <span className="status-badge">{report.moderationState}</span>
                <span className="cms-meta-badge">
                  {report.sourceKind === "member" ? "Member submission" : "Coach-curated"}
                </span>
                <span className="cms-meta-badge">{report.recruitmentCycle}</span>
              </div>
              <h2>{report.companyName}</h2>
              <p>
                {report.roleTitle} · {recruitmentStageLabel(report.recruitmentStage)} ·{" "}
                {report.approximateDate}
              </p>
              <p>{report.formatSummary}</p>
            </div>
            <div className="cms-intelligence-row-actions">
              <Link
                className="button-secondary button-link"
                href={`/admin/intelligence/${report.id}`}
              >
                Edit
              </Link>
              <form action={moderateIntelligenceAction} className="cms-inline-moderation">
                <input name="id" type="hidden" value={report.id} />
                <input name="version" type="hidden" value={report.version} />
                <select
                  aria-label={`Confidence for ${report.companyName}`}
                  defaultValue={report.moderationConfidence ?? "medium"}
                  name="confidence"
                >
                  <option value="low">Low confidence</option>
                  <option value="medium">Medium confidence</option>
                  <option value="high">High confidence</option>
                </select>
                <button name="state" type="submit" value="published">
                  Publish
                </button>
                <button className="button-secondary" name="state" type="submit" value="rejected">
                  Reject
                </button>
              </form>
              {report.moderationState === "published" && (
                <Link href={`/intelligence/${report.slug}`}>Public preview</Link>
              )}
            </div>
          </article>
        ))}
        {!reports.length && (
          <section className="card empty-state">
            <h2>Create the first report</h2>
            <p>
              Start with authorised, anonymised coaching feedback and label it honestly as
              coach-curated.
            </p>
            <Link href="/admin/intelligence/new">Create report</Link>
          </section>
        )}
      </div>
    </main>
  );
}
