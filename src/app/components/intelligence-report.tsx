import Link from "next/link";
import type { IntelligenceReport } from "../../modules/recruitment-intelligence/infrastructure/report-repository";
import { industries } from "../../modules/taxonomy/domain/industries";
import { opportunityTypes } from "../../modules/taxonomy/domain/opportunity-types";
import { recruitmentStageLabel } from "../../modules/taxonomy/domain/display-labels";

export function intelligenceReportTitle(report: IntelligenceReport): string {
  return `${report.companyName} ${report.roleTitle} — ${recruitmentStageLabel(report.recruitmentStage)}`;
}

export function IntelligenceProvenance({ report }: { report: IntelligenceReport }) {
  return (
    <span className={`intelligence-provenance is-${report.sourceKind}`}>
      {report.sourceKind === "member"
        ? "Community member report"
        : "Coach-curated from anonymised candidate feedback"}
    </span>
  );
}

export function IntelligenceReportCard({
  href,
  report,
}: {
  href: string;
  report: IntelligenceReport;
}) {
  return (
    <article className="intelligence-card">
      <div className="intelligence-card-topline">
        <IntelligenceProvenance report={report} />
        <span>{report.recruitmentCycle} cycle</span>
      </div>
      <h2>
        <Link href={href as never}>{report.companyName}</Link>
      </h2>
      <p className="intelligence-role">{report.roleTitle}</p>
      <div className="resource-card-meta">
        <span>{recruitmentStageLabel(report.recruitmentStage)}</span>
        {report.location && <span>{report.location}</span>}
        {report.moderationConfidence && <span>{report.moderationConfidence} confidence</span>}
      </div>
      <p>{report.formatSummary}</p>
      <Link className="intelligence-card-link" href={href as never}>
        Read experience
      </Link>
    </article>
  );
}

export function IntelligenceReportDetail({
  preview = false,
  report,
}: {
  preview?: boolean;
  report: IntelligenceReport;
}) {
  return (
    <article className="intelligence-detail">
      <header className="intelligence-detail-header">
        <IntelligenceProvenance report={report} />
        <p className="eyebrow">
          {recruitmentStageLabel(report.recruitmentStage)} · {report.recruitmentCycle} cycle
        </p>
        <h1>{intelligenceReportTitle(report)}</h1>
        <p className="intro">{report.formatSummary}</p>
        <dl className="intelligence-facts">
          <div>
            <dt>Experience date</dt>
            <dd>{report.approximateDate}</dd>
          </div>
          {report.location && (
            <div>
              <dt>Location</dt>
              <dd>{report.location}</dd>
            </div>
          )}
          {report.opportunityType && (
            <div>
              <dt>Opportunity</dt>
              <dd>{opportunityTypes[report.opportunityType as keyof typeof opportunityTypes]}</dd>
            </div>
          )}
          {report.industry && (
            <div>
              <dt>Industry</dt>
              <dd>{industries[report.industry as keyof typeof industries]}</dd>
            </div>
          )}
          <div>
            <dt>Moderation</dt>
            <dd>{report.moderationConfidence ?? "Pending"} confidence</dd>
          </div>
        </dl>
      </header>
      <section>
        <h2>What the process involved</h2>
        <p>{report.themes}</p>
      </section>
      {preview ? (
        <section className="intelligence-preview-gate">
          <p className="eyebrow">Member report</p>
          <h2>See assessed skills, reflection and preparation advice</h2>
          <p>
            Join OfferLab to read the complete moderated report and explore current experiences by
            employer, role, stage and recruitment cycle.
          </p>
          <div className="form-actions">
            <Link className="button-link" href="/register">
              Create free account
            </Link>
            <Link href="/sign-in">Sign in</Link>
          </div>
        </section>
      ) : (
        <>
          <section>
            <h2>Skills candidates felt were assessed</h2>
            <ul className="intelligence-skill-list">
              {report.assessedSkills.map((skill) => (
                <li key={skill}>{skill}</li>
              ))}
            </ul>
          </section>
          <section>
            <h2>Candidate reflection</h2>
            <p>{report.reflection}</p>
          </section>
          <section className="intelligence-advice">
            <h2>What may help you prepare</h2>
            <p>{report.preparationAdvice}</p>
          </section>
          {report.outcome && (
            <section>
              <h2>Optional outcome context</h2>
              <p>{report.outcome}</p>
            </section>
          )}
        </>
      )}
      <footer className="intelligence-notice">
        <strong>Use as directional evidence, not a guaranteed preview.</strong>
        <p>
          Employer processes change. Reports exclude exact restricted questions, confidential
          documents, personal names and copyrighted assessment material.
        </p>
      </footer>
    </article>
  );
}
