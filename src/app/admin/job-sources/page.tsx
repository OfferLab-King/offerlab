import { requireAdministrator } from "../../../modules/identity-access/application/authorization";
import { readJobCatalogAdmin } from "../../../modules/job-catalog/application/admin";
import type {
  LatestSourceRunResult,
  SourceOperationalState,
} from "../../../modules/job-catalog/domain/source-operational-state";
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
  requestSourceRun,
  updateSourcePause,
  updateSourceUrls,
} from "./actions";
import { formatAdminDateTime } from "../format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const statusLabels = {
  active: "Active",
  archived: "Archived",
  paused: "Paused",
} as const;

const statusTint = {
  active: "status-badge--positive",
  archived: "",
  paused: "status-badge--warn",
} as const;

function tintForHealth(health: string | null): string {
  if (health === "healthy") return "status-badge--positive";
  if (health === "unhealthy") return "status-badge--negative";
  return "status-badge--warn";
}

function LatestResult({ latest }: { latest: LatestSourceRunResult }) {
  if (latest.kind === "succeeded") {
    return (
      <p>
        Last run succeeded · discovered {latest.jobsDiscovered} · new {latest.jobsNew} · updated{" "}
        {latest.jobsUpdated} · deactivated {latest.jobsDeactivated} ·{" "}
        {formatAdminDateTime(latest.finishedAt)}
      </p>
    );
  }
  return (
    <p className="cms-run-error">
      Last run failed · {latest.errorCode ?? "unknown"} · {formatAdminDateTime(latest.finishedAt)}
    </p>
  );
}

function SourceState({ state, sourceId }: { state: SourceOperationalState; sourceId: string }) {
  switch (state.kind) {
    case "queued":
      return (
        <>
          <span className="status-badge">Queued</span>
          <p className="hint">Run requested · the worker will pick it up.</p>
        </>
      );
    case "running":
      return (
        <>
          <span className="status-badge">Running</span>
          <p className="hint">Crawl started at {formatAdminDateTime(state.startedAt)}.</p>
        </>
      );
    case "paused":
      return <p className="hint">Paused · crawls are disabled until the source is resumed.</p>;
    case "archived":
      return <p className="hint">Archived · crawls are disabled.</p>;
    case "ready":
      return (
        <>
          <form action={requestSourceRun} className="cms-job-source-form">
            <input name="sourceId" type="hidden" value={sourceId} />
            <button type="submit">Run now</button>
          </form>
          {state.latest ? (
            <LatestResult latest={state.latest} />
          ) : (
            <p className="hint">Never run.</p>
          )}
        </>
      );
  }
}

export default async function JobSourcesPage() {
  const administrator = await requireAdministrator();
  const view = await readJobCatalogAdmin(administrator.userId);

  return (
    <main className="cms-page admin-jobs-page">
      <header className="cms-page-header">
        <div>
          <p className="eyebrow">Administrator operations</p>
          <h1>Job sources</h1>
          <p>
            Maintain each employer&apos;s official early-career and professional sources, inspect
            URL health, or request an immediate run. Network crawling never runs inside the web
            request.
          </p>
        </div>
      </header>

      <section className="cms-operations-section" aria-labelledby="sources">
        <div className="cms-section-heading">
          <div>
            <h2 id="sources">Employer source registry</h2>
            <p>Independent schedule, health and controls for every official employer source.</p>
            <p className="hint">
              Run now records a durable crawl request; crawling happens outside the web process.
              Local development: start the worker with <code>pnpm dev:jobs</code>. Production: the
              installed worker service handles the same queue.
            </p>
          </div>
        </div>
        <ul className="cms-job-source-list">
          {view.sources.map((company) => (
            <li className="cms-operation-card cms-job-source" key={company.id}>
              <div className="cms-job-source-head">
                <h3>
                  {company.company_name} · {company.source_name}
                </h3>
                <span
                  className={`status-badge ${
                    statusTint[company.status as keyof typeof statusTint] ?? ""
                  }`}
                >
                  {statusLabels[company.status as keyof typeof statusLabels] ?? company.status}
                </span>
              </div>
              <p>
                {company.channel.replaceAll("_", " ")} · {company.source_type} · every{" "}
                {company.crawl_frequency_minutes} minutes
              </p>
              <dl className="cms-job-source-facts">
                <div>
                  <dt>Last checked</dt>
                  <dd>{formatAdminDateTime(company.last_checked_at)}</dd>
                </div>
                <div>
                  <dt>Last success</dt>
                  <dd>{formatAdminDateTime(company.last_successful_check_at)}</dd>
                </div>
                <div>
                  <dt>Next check</dt>
                  <dd>
                    {company.next_check_at ? formatAdminDateTime(company.next_check_at) : "due"}
                  </dd>
                </div>
                <div>
                  <dt>Consecutive failures</dt>
                  <dd>{company.consecutive_failures}</dd>
                </div>
                <div>
                  <dt>Consecutive zero results</dt>
                  <dd>
                    {company.consecutive_zero_results}
                    {company.consecutive_zero_results > 0 && company.last_non_zero_result_at && (
                      <span className="hint">
                        {" "}
                        · last non-zero {formatAdminDateTime(company.last_non_zero_result_at)}
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Landing page</dt>
                  <dd>
                    <span
                      className={`status-badge ${tintForHealth(company.landing_health_status)}`}
                    >
                      {company.landing_health_status}
                    </span>
                    {company.landing_last_status_code
                      ? ` · ${company.landing_last_status_code}`
                      : ""}
                  </dd>
                </div>
                <div>
                  <dt>Crawl endpoint</dt>
                  <dd>
                    <span
                      className={`status-badge ${tintForHealth(company.endpoint_health_status)}`}
                    >
                      {company.endpoint_health_status}
                    </span>
                    {company.endpoint_last_status_code
                      ? ` · ${company.endpoint_last_status_code}`
                      : ""}
                  </dd>
                </div>
              </dl>
              <div className="cms-job-source-state">
                <SourceState sourceId={company.id} state={company.operationalState} />
                <form action={updateSourcePause} className="cms-job-source-form">
                  <input name="sourceId" type="hidden" value={company.id} />
                  <input
                    name="paused"
                    type="hidden"
                    value={company.status === "paused" ? "false" : "true"}
                  />
                  <button
                    className="button-link secondary"
                    type="submit"
                    disabled={company.status === "archived"}
                  >
                    {company.status === "paused" ? "Resume source" : "Pause source"}
                  </button>
                </form>
              </div>
              <details className="cms-review-details">
                <summary>Edit official source URLs</summary>
                <form action={updateSourceUrls} className="cms-review-form">
                  <input name="sourceId" type="hidden" value={company.id} />
                  <label>
                    Public careers page
                    <input
                      defaultValue={company.careers_url}
                      name="careersUrl"
                      type="url"
                      required
                    />
                  </label>
                  <label>
                    Machine-readable endpoint (optional)
                    <input
                      defaultValue={company.crawl_endpoint_url ?? ""}
                      name="crawlEndpointUrl"
                      type="url"
                    />
                  </label>
                  <label>
                    Connector configuration (JSON)
                    <textarea
                      defaultValue={JSON.stringify(company.configuration ?? {}, null, 2)}
                      name="configuration"
                      rows={4}
                    />
                  </label>
                  <button type="submit">Save URLs and configuration</button>
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
              <span
                className={`status-badge ${
                  run.status === "succeeded"
                    ? "status-badge--positive"
                    : run.status === "failed"
                      ? "status-badge--negative"
                      : ""
                }`}
              >
                {run.status}
              </span>
              <span>{run.company_name}</span>
              <span>
                discovered {run.jobs_discovered} · new {run.jobs_new} · updated {run.jobs_updated} ·
                unchanged {run.jobs_unchanged} · deactivated {run.jobs_deactivated}
              </span>
              <span>
                {formatAdminDateTime(run.started_at)} · {run.duration_ms ?? "-"}ms · errors{" "}
                {run.error_count}
              </span>{" "}
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
              <span>{formatAdminDateTime(event.occurred_at)}</span>
              {event.message && <span className="cms-run-error">{event.message}</span>}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
