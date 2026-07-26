import { recruitmentStages } from "../../../modules/applications/domain/application";
import type { IntelligenceReport } from "../../../modules/recruitment-intelligence/infrastructure/report-repository";
import { industries } from "../../../modules/taxonomy/domain/industries";
import { opportunityTypes } from "../../../modules/taxonomy/domain/opportunity-types";

export function IntelligenceEditor({
  action,
  report,
}: {
  action: (formData: FormData) => void | Promise<void>;
  report?: IntelligenceReport;
}) {
  return (
    <form action={action} className="cms-intelligence-editor">
      {report && (
        <>
          <input name="id" type="hidden" value={report.id} />
          <input name="version" type="hidden" value={report.version} />
        </>
      )}
      <section className="cms-editor-card">
        <div className="cms-section-heading">
          <div>
            <p className="eyebrow">Employer context</p>
            <h2>Name the report clearly</h2>
          </div>
        </div>
        <div className="form-grid">
          <label>
            Employer
            <input defaultValue={report?.companyName} maxLength={160} name="companyName" required />
          </label>
          <label>
            Role or programme
            <input defaultValue={report?.roleTitle} maxLength={160} name="roleTitle" required />
          </label>
          <label>
            Location (optional)
            <input defaultValue={report?.location ?? ""} maxLength={120} name="location" />
          </label>
          <label>
            Opportunity type (optional)
            <select defaultValue={report?.opportunityType ?? ""} name="opportunityType">
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
            <select defaultValue={report?.industry ?? ""} name="industry">
              <option value="">Not specified</option>
              {Object.entries(industries).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>
      <section className="cms-editor-card">
        <div className="cms-section-heading">
          <div>
            <p className="eyebrow">Process context</p>
            <h2>Date and recruitment stage</h2>
          </div>
        </div>
        <div className="form-grid">
          <label>
            Recruitment cycle
            <input
              defaultValue={report?.recruitmentCycle}
              name="recruitmentCycle"
              pattern="[0-9]{4}/[0-9]{2}"
              placeholder="2026/27"
              required
            />
          </label>
          <label>
            Approximate date
            <input
              defaultValue={report?.approximateDate}
              name="approximateDate"
              required
              type="date"
            />
          </label>
          <label>
            Stage
            <select defaultValue={report?.recruitmentStage ?? ""} name="recruitmentStage" required>
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
      </section>
      <section className="cms-editor-card">
        <div className="cms-section-heading">
          <div>
            <p className="eyebrow">Public report</p>
            <h2>Describe the experience without restricted details</h2>
          </div>
        </div>
        <label>
          Format summary
          <input
            defaultValue={report?.formatSummary}
            maxLength={200}
            name="formatSummary"
            required
          />
        </label>
        <label>
          General themes—not exact questions
          <textarea
            defaultValue={report?.themes}
            maxLength={1000}
            name="themes"
            required
            rows={5}
          />
        </label>
        <label>
          Skills assessed (comma-separated)
          <input
            defaultValue={report?.assessedSkills.join(", ")}
            maxLength={500}
            name="assessedSkills"
            required
          />
        </label>
        <label>
          Candidate reflection
          <textarea
            defaultValue={report?.reflection}
            maxLength={1500}
            name="reflection"
            required
            rows={5}
          />
        </label>
        <label>
          Practical preparation advice
          <textarea
            defaultValue={report?.preparationAdvice}
            maxLength={1500}
            name="preparationAdvice"
            required
            rows={5}
          />
        </label>
        <label>
          Outcome context (optional)
          <textarea defaultValue={report?.outcome ?? ""} maxLength={500} name="outcome" rows={3} />
        </label>
      </section>
      <label className="intelligence-confirmation cms-intelligence-confirmation">
        <input name="confidentialityConfirmed" required type="checkbox" value="yes" />
        <span>
          I confirm this material is authorised, anonymised and contains no exact restricted
          questions, copied assessments, employer-confidential information or identifying details.
        </span>
      </label>
      <div className="cms-sticky-actions">
        <div>
          <strong>{report ? "Save report changes" : "Create coach-curated report"}</strong>
          <p>
            {report
              ? "Published member views update after saving."
              : "The report starts pending and must be reviewed before publication."}
          </p>
        </div>
        <button type="submit">{report ? "Save report" : "Create report"}</button>
      </div>
    </form>
  );
}
