import { recruitmentStages } from "../../../../modules/applications/domain/application";
import { requireMember } from "../../../../modules/identity-access/application/authorization";
import { readIntelligenceReports } from "../../../../modules/recruitment-intelligence/application/reports";
import { industries } from "../../../../modules/taxonomy/domain/industries";
import { opportunityTypes } from "../../../../modules/taxonomy/domain/opportunity-types";
import { recruitmentStageLabel } from "../../../../modules/taxonomy/domain/display-labels";
import { MemberApplicationsHeader } from "../../applications/member-applications-header";
import { LearnNavigation } from "../learn-navigation";
import { submitReportAction } from "./actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function IntelligencePage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  const { userId } = await requireMember();
  const [reports, query] = await Promise.all([readIntelligenceReports(userId), searchParams]);
  const published = reports.filter((report) => report.moderationState === "published");
  const mine = reports.filter((report) => report.mine);
  return (
    <main className="applications-shell">
      <MemberApplicationsHeader />
      <LearnNavigation active="intelligence" />
      <section className="applications-heading">
        <div>
          <p className="eyebrow">Community intelligence</p>
          <h1>Recruitment Intelligence</h1>
          <p className="intro">
            Learn from cycle-dated, moderated candidate reports about formats, themes and assessed
            skills. Reports are directional—not guaranteed previews of an employer process.
          </p>
        </div>
      </section>
      {query.result === "submitted" && (
        <p className="success-summary" role="status">
          Report submitted for moderation. Thank you for keeping it useful and confidential.
        </p>
      )}
      {query.result === "invalid" && (
        <p className="error-summary" role="alert">
          We could not submit that report. Check every required field and try again.
        </p>
      )}
      <section className="learn-section" aria-labelledby="published-intelligence">
        <p className="eyebrow">Moderated reports</p>
        <h2 id="published-intelligence">What candidates encountered</h2>
        {published.length ? (
          <div className="resource-grid">
            {published.map((report) => (
              <article className="card compact-card" key={report.id}>
                <div className="resource-card-meta">
                  <span>{recruitmentStageLabel(report.recruitmentStage)}</span>
                  <span>{report.recruitmentCycle} cycle</span>
                  <span>{report.moderationConfidence} confidence</span>
                </div>
                <h3>{report.formatSummary}</h3>
                <p>{report.themes}</p>
                <p>
                  <strong>Skills assessed:</strong> {report.assessedSkills.join(", ")}
                </p>
                <p>
                  <strong>Candidate reflection:</strong> {report.reflection}
                </p>
                <small>Approximate date: {report.approximateDate}</small>
              </article>
            ))}
          </div>
        ) : (
          <p>No reports have completed moderation yet.</p>
        )}
      </section>
      <details className="card guided-form intelligence-submission">
        <summary>Share a recent experience</summary>
        <form action={submitReportAction}>
          <p>
            Do not share exact private questions, employer-confidential material, names, contact
            details or identifying information. Describe the format and skills at a useful level.
          </p>
          <label>
            Recruitment cycle
            <input
              name="recruitmentCycle"
              placeholder="2026/27"
              pattern="[0-9]{4}/[0-9]{2}"
              required
            />
          </label>
          <label>
            Approximate date
            <input name="approximateDate" type="date" required />
          </label>
          <label>
            Recruitment stage
            <select name="recruitmentStage" required defaultValue="">
              <option disabled value="">
                Choose a stage
              </option>
              {Object.entries(recruitmentStages).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Opportunity type (optional)
            <select name="opportunityType" defaultValue="">
              <option value="">Not specified</option>
              {Object.entries(opportunityTypes).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Industry (optional)
            <select name="industry" defaultValue="">
              <option value="">Not specified</option>
              {Object.entries(industries).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Format summary
            <input name="formatSummary" maxLength={200} required />
          </label>
          <label>
            Themes (not exact questions)
            <textarea name="themes" maxLength={1000} rows={5} required />
          </label>
          <label>
            Skills assessed (comma-separated)
            <input name="assessedSkills" maxLength={500} required />
          </label>
          <label>
            What would help another candidate prepare?
            <textarea name="reflection" maxLength={1500} rows={5} required />
          </label>
          <button type="submit">Submit for moderation</button>
        </form>
      </details>
      {mine.length > 0 && (
        <section className="learn-section" aria-labelledby="your-reports">
          <h2 id="your-reports">Your reports</h2>
          <ul>
            {mine.map((report) => (
              <li key={report.id}>
                {report.formatSummary} — {report.moderationState}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
