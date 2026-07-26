import Link from "next/link";
import { recruitmentStages } from "../../../../../modules/applications/domain/application";
import { requireMember } from "../../../../../modules/identity-access/application/authorization";
import { industries } from "../../../../../modules/taxonomy/domain/industries";
import { opportunityTypes } from "../../../../../modules/taxonomy/domain/opportunity-types";
import { MemberApplicationsHeader } from "../../../applications/member-applications-header";
import { LearnNavigation } from "../../learn-navigation";
import { submitReportAction } from "../actions";

export const runtime = "nodejs";

export default async function ShareIntelligencePage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  await requireMember();
  const query = await searchParams;
  return (
    <main className="applications-shell intelligence-share-page">
      <MemberApplicationsHeader />
      <LearnNavigation active="intelligence" />
      <div className="intelligence-back-link">
        <Link href="/member/learn/intelligence">← Recruitment Intelligence</Link>
      </div>
      <header className="applications-heading">
        <div>
          <p className="eyebrow">Help another candidate</p>
          <h1>Share a recruitment experience</h1>
          <p className="intro">
            Describe the process at a useful level. Your identity is never displayed, and nothing
            appears until an administrator reviews it.
          </p>
        </div>
      </header>
      {query.result === "invalid" && (
        <p className="error-summary" role="alert">
          Check every required field and confirm the confidentiality statement.
        </p>
      )}
      <aside className="intelligence-safety-note">
        <strong>Do not include</strong>
        <p>
          Exact private questions, copied test content, confidential documents, assessor names,
          candidate names, contact details or anything covered by a confidentiality agreement.
        </p>
      </aside>
      <form action={submitReportAction} className="intelligence-report-form">
        <fieldset>
          <legend>Employer and opportunity</legend>
          <div className="form-grid">
            <label>
              Employer
              <input maxLength={160} name="companyName" required />
            </label>
            <label>
              Role or programme
              <input maxLength={160} name="roleTitle" required />
            </label>
            <label>
              Location (optional)
              <input maxLength={120} name="location" />
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
          </div>
        </fieldset>
        <fieldset>
          <legend>When and where in the process</legend>
          <div className="form-grid">
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
          </div>
        </fieldset>
        <fieldset>
          <legend>What another candidate should know</legend>
          <label>
            Format summary
            <span className="hint">
              For example: timed group exercise followed by a presentation.
            </span>
            <input maxLength={200} name="formatSummary" required />
          </label>
          <label>
            General themes—not exact questions
            <textarea maxLength={1000} name="themes" rows={5} required />
          </label>
          <label>
            Skills assessed
            <span className="hint">Separate up to 10 skills with commas.</span>
            <input maxLength={500} name="assessedSkills" required />
          </label>
          <label>
            Your reflection
            <textarea maxLength={1500} name="reflection" rows={5} required />
          </label>
          <label>
            What would help someone prepare?
            <textarea maxLength={1500} name="preparationAdvice" rows={5} required />
          </label>
          <label>
            Outcome context (optional)
            <textarea maxLength={500} name="outcome" rows={3} />
          </label>
        </fieldset>
        <label className="intelligence-confirmation">
          <input name="confidentialityConfirmed" required type="checkbox" value="yes" />
          <span>
            I confirm this report is my experience, contains no restricted or confidential material,
            and does not identify another person. I understand OfferLab may edit or reject it for
            clarity, safety or usefulness.
          </span>
        </label>
        <div className="form-actions">
          <button type="submit">Submit for moderation</button>
          <Link href="/member/learn/intelligence">Cancel</Link>
        </div>
      </form>
    </main>
  );
}
