import { requireAdministrator } from "../../../modules/identity-access/application/authorization";
import { readJobCatalogAdmin } from "../../../modules/job-catalog/application/admin";
import {
  opportunityTypes,
  opportunityTypeLabels,
  jobSectors,
  jobSubsectors,
} from "../../../modules/job-catalog/domain/taxonomy";
import {
  eligibilityReasonLabels,
  eligibilityStatusLabels,
} from "../../../modules/job-catalog/domain/eligibility";
import {
  overrideClassification,
  overrideEligibility,
  overridePublication,
  recordReview,
  updateCrawlPermission,
  updateSourcePause,
} from "./actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const statusLabels = {
  failing: "Failing",
  healthy: "Healthy",
  paused: "Paused",
  warning: "Warning",
} as const;

const robotsLabels = {
  allowed: "Allowed",
  blocked: "Blocked",
  not_checked: "Not checked",
  unknown: "Unknown",
} as const;

const termsLabels = {
  allowed: "Allowed",
  blocked: "Blocked",
  not_reviewed: "Not reviewed",
  unknown: "Unknown",
} as const;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function JobSourcesPage() {
  await requireAdministrator();
  const view = await readJobCatalogAdmin();

  return (
    <main className="cms-page admin-jobs-page">
      <header className="cms-page-header">
        <div>
          <p className="eyebrow">Administrator operations</p>
          <h1>Job sources</h1>
          <p>
            Sources are only crawled when marked &ldquo;Crawling allowed&rdquo; and a review is
            recorded. Verify each employer&apos;s official careers site, ATS and terms before
            enabling. Run crawls from the server with <code> pnpm jobs:crawl:due</code>.
          </p>
        </div>
      </header>

      <section className="cms-operations-section" aria-labelledby="sources">
        <div className="cms-section-heading">
          <div>
            <h2 id="sources">Source registry and permission review</h2>
            <p>Permission, review provenance and crawl health for each employer source.</p>
          </div>
        </div>
        <ul className="cms-job-source-list">
          {view.companies.map((company) => (
            <li className="cms-operation-card cms-job-source" key={company.id}>
              <div className="cms-job-source-head">
                <h3>{company.name}</h3>
                <span className="status-badge">
                  {statusLabels[company.crawl_status as keyof typeof statusLabels] ??
                    company.crawl_status}
                </span>
              </div>
              <p>
                {company.source_type} · {company.ats_provider ?? "no ATS"} · every{" "}
                {company.crawl_frequency_minutes} minutes
              </p>
              <dl className="cms-job-source-facts">
                <div>
                  <dt>Last checked</dt>
                  <dd>
                    {company.last_checked_at ? company.last_checked_at.toISOString() : "never"}
                  </dd>
                </div>
                <div>
                  <dt>Last success</dt>
                  <dd>
                    {company.last_successful_check_at
                      ? company.last_successful_check_at.toISOString()
                      : "never"}
                  </dd>
                </div>
                <div>
                  <dt>Next check</dt>
                  <dd>{company.next_check_at ? company.next_check_at.toISOString() : "due"}</dd>
                </div>
                <div>
                  <dt>Consecutive failures</dt>
                  <dd>{company.consecutive_failures}</dd>
                </div>
                <div>
                  <dt>Review date</dt>
                  <dd>
                    {company.review_date
                      ? company.review_date.toISOString().slice(0, 10)
                      : "not reviewed"}
                  </dd>
                </div>
                <div>
                  <dt>Robots</dt>
                  <dd>
                    {robotsLabels[company.robots_result as keyof typeof robotsLabels] ??
                      company.robots_result}
                  </dd>
                </div>
                <div>
                  <dt>Terms</dt>
                  <dd>
                    {termsLabels[company.terms_result as keyof typeof termsLabels] ??
                      company.terms_result}
                  </dd>
                </div>
              </dl>
              <form action={updateCrawlPermission} className="cms-job-source-form">
                <input name="companyId" type="hidden" value={company.id} />
                <label>
                  Crawl permission
                  <select defaultValue={company.crawl_allowed} name="crawlAllowed">
                    <option value="allowed">Crawling allowed</option>
                    <option value="unknown">Permission unknown</option>
                    <option value="blocked">Blocked</option>
                  </select>
                </label>
                <button type="submit">Update permission</button>
              </form>
              <form action={updateSourcePause} className="cms-job-source-form">
                <input name="companyId" type="hidden" value={company.id} />
                <input
                  name="paused"
                  type="hidden"
                  value={company.crawl_status === "paused" ? "false" : "true"}
                />
                <button className="button-link secondary" type="submit">
                  {company.crawl_status === "paused" ? "Resume source" : "Pause source"}
                </button>
              </form>
              <details className="cms-review-details">
                <summary>Record source review</summary>
                <form action={recordReview} className="cms-review-form">
                  <input name="companyId" type="hidden" value={company.id} />
                  <label>
                    Review date
                    <input defaultValue={today()} name="reviewDate" type="date" />
                  </label>
                  <label>
                    Robots.txt result
                    <select defaultValue={company.robots_result} name="robotsResult">
                      <option value="allowed">Allowed</option>
                      <option value="blocked">Blocked</option>
                      <option value="unknown">Unknown</option>
                      <option value="not_checked">Not checked</option>
                    </select>
                  </label>
                  <label>
                    Terms result
                    <select defaultValue={company.terms_result} name="termsResult">
                      <option value="allowed">Allowed</option>
                      <option value="blocked">Blocked</option>
                      <option value="unknown">Unknown</option>
                      <option value="not_reviewed">Not reviewed</option>
                    </select>
                  </label>
                  <label>
                    Evidence / reference URL
                    <input
                      defaultValue={company.evidence_url ?? ""}
                      name="evidenceUrl"
                      type="url"
                    />
                  </label>
                  <label>
                    Review notes
                    <textarea
                      defaultValue={company.review_notes}
                      maxLength={2000}
                      name="reviewNotes"
                      rows={3}
                    />
                  </label>
                  <button type="submit">Save review</button>
                </form>
              </details>
            </li>
          ))}
        </ul>
      </section>

      <section className="cms-operations-section" aria-labelledby="eligibility-queue">
        <div className="cms-section-heading">
          <div>
            <h2 id="eligibility-queue">Eligibility review queue</h2>
            <p>
              Jobs awaiting an eligibility decision. Needs-review and ineligible roles are never
              published automatically.
            </p>
          </div>
        </div>
        {view.eligibilityQueue.length === 0 ? (
          <p className="hint">No jobs waiting for an eligibility decision.</p>
        ) : (
          <ul className="cms-review-list">
            {view.eligibilityQueue.map((job) => (
              <li className="cms-operation-card" key={job.id}>
                <div className="cms-job-source-head">
                  <h3>{job.title}</h3>
                  <span className="status-badge">
                    {
                      eligibilityStatusLabels[
                        job.eligibility_status as keyof typeof eligibilityStatusLabels
                      ]
                    }
                  </span>
                </div>
                <p>
                  {job.company_name} · {job.opportunity_type}
                </p>
                <ul className="cms-reason-list">
                  {job.eligibility_reasons.map((reason) => (
                    <li key={reason}>
                      {eligibilityReasonLabels[reason as keyof typeof eligibilityReasonLabels] ??
                        reason}
                    </li>
                  ))}
                </ul>
                {job.eligibility_evidence && (
                  <p className="cms-review-evidence">&ldquo;{job.eligibility_evidence}&rdquo;</p>
                )}
                <form action={overrideEligibility} className="cms-job-source-form">
                  <input name="jobId" type="hidden" value={job.id} />
                  <label>
                    Eligibility decision
                    <select defaultValue={job.eligibility_status} name="eligibilityStatus">
                      <option value="eligible">Eligible</option>
                      <option value="needs_review">Needs review</option>
                      <option value="ineligible">Ineligible</option>
                    </select>
                  </label>
                  <button type="submit">Save decision</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="cms-operations-section" aria-labelledby="classification-queue">
        <div className="cms-section-heading">
          <div>
            <h2 id="classification-queue">Classification review queue</h2>
            <p>
              Published eligible roles without a confident sector, subsector or opportunity type.
            </p>
          </div>
        </div>
        {view.classificationQueue.length === 0 ? (
          <p className="hint">No roles waiting for classification.</p>
        ) : (
          <ul className="cms-review-list">
            {view.classificationQueue.map((job) => (
              <li className="cms-operation-card" key={job.id}>
                <div className="cms-job-source-head">
                  <h3>{job.title}</h3>
                  <span className="status-badge">{job.company_name}</span>
                </div>
                <form action={overrideClassification} className="cms-job-source-form">
                  <input name="jobId" type="hidden" value={job.id} />
                  <label>
                    Sector
                    <select defaultValue={job.sector_key ?? ""} name="sectorKey">
                      <option value="">Unclassified</option>
                      {jobSectors.map((sector) => (
                        <option key={sector.key} value={sector.key}>
                          {sector.displayName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Subsector
                    <select defaultValue={job.subsector_key ?? ""} name="subsectorKey">
                      <option value="">Unclassified</option>
                      {jobSubsectors.map((subsector) => (
                        <option key={subsector.key} value={subsector.key}>
                          {subsector.displayName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Opportunity type
                    <select defaultValue={job.opportunity_type} name="opportunityType">
                      {opportunityTypes.map((type) => (
                        <option key={type} value={type}>
                          {opportunityTypeLabels[type]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="submit">Save classification</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="cms-operations-section" aria-labelledby="publication">
        <div className="cms-section-heading">
          <div>
            <h2 id="publication">Publication overrides</h2>
            <p>Publish, suppress or hold a role. All overrides are attributed and audited.</p>
          </div>
        </div>
        <ul className="cms-review-list">
          {[...view.eligibilityQueue, ...view.classificationQueue]
            .filter((job, index, all) => all.findIndex((other) => other.id === job.id) === index)
            .slice(0, 20)
            .map((job) => (
              <li className="cms-operation-card" key={job.id}>
                <h3>{job.title}</h3>
                <p>{job.company_name}</p>
                <form action={overridePublication} className="cms-job-source-form">
                  <input name="jobId" type="hidden" value={job.id} />
                  <label>
                    Publication status
                    <select defaultValue="draft" name="publicationStatus">
                      <option value="published">Published</option>
                      <option value="draft">Draft</option>
                      <option value="suppressed">Suppressed</option>
                    </select>
                  </label>
                  <button type="submit">Set status</button>
                </form>
              </li>
            ))}
        </ul>
      </section>

      <section className="cms-operations-section" aria-labelledby="runs">
        <div className="cms-section-heading">
          <div>
            <h2 id="runs">Recent ingestion runs</h2>
            <p>Latest per-source crawl outcomes.</p>
          </div>
        </div>
        <ul className="cms-run-list">
          {view.recentRuns.map((run) => (
            <li key={run.started_at.toISOString() + run.company_id}>
              <span className="status-badge">{run.status}</span>
              <span>{run.company_name}</span>
              <span>
                discovered {run.jobs_discovered} · new {run.jobs_new} · updated {run.jobs_updated} ·
                unchanged {run.jobs_unchanged} · deactivated {run.jobs_deactivated}
              </span>
              <span>
                {run.started_at.toISOString()} · {run.duration_ms ?? "-"}ms · errors{" "}
                {run.error_count}
              </span>
              {run.error_summary && <span className="cms-run-error">{run.error_summary}</span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="cms-operations-section" aria-labelledby="events">
        <div className="cms-section-heading">
          <div>
            <h2 id="events">Recent source events</h2>
            <p>Audit trail of crawler decisions.</p>
          </div>
        </div>
        <ul className="cms-event-list">
          {view.recentEvents.map((event) => (
            <li key={event.occurred_at.toISOString() + event.company_id + event.kind}>
              <span className="status-badge">{event.kind}</span>
              <span>{event.company_name}</span>
              <span>{event.occurred_at.toISOString()}</span>
              {event.message && <span className="cms-run-error">{event.message}</span>}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
