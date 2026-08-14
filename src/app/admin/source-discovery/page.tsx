import { requireAdministrator } from "../../../modules/identity-access/application/authorization";
import {
  DISCOVERY_PLATFORMS,
  DISCOVERY_STATUSES,
  DISCOVERY_TIERS,
  discoveryStatusLabels,
  parseDiscoveryQueueFilters,
  platformDisplayName,
} from "../../../modules/employer-research/application/source-discovery-view";
import { readSourceDiscovery } from "../../../modules/employer-research/application/employer-research";
import { promoteVerifiedCandidate } from "./actions";
import { formatAdminDate } from "../format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function statusTint(status: string): string {
  if (status === "verified" || status === "promoted") return "status-badge--positive";
  if (status === "failed" || status === "blocked") return "status-badge--negative";
  if (status === "unsupported") return "status-badge--warn";
  return "";
}

export default async function SourceDiscoveryPage({
  searchParams,
}: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  const administrator = await requireAdministrator();
  const query = await searchParams;
  const filters = parseDiscoveryQueueFilters(query);
  const { coverage, queue, totals, stats } = await readSourceDiscovery(
    administrator.userId,
    filters,
  );

  return (
    <main className="cms-page">
      <header className="cms-page-header">
        <div>
          <p className="eyebrow">Administrator operations</p>
          <h1>Source discovery</h1>
          <p>
            Research universe grouped by ATS/platform. Discovery runs via{" "}
            <code>pnpm jobs:discover-source</code>; promoted candidates become paused sources in
            /admin/job-sources and are never activated automatically.
          </p>
        </div>
      </header>

      <section className="cms-operations-section" aria-labelledby="capability-heading">
        <div className="cms-section-heading">
          <div>
            <h2 id="capability-heading">Universe and crawler capability</h2>
          </div>
        </div>
        <dl className="cms-detail-grid">
          <div>
            <dt>Employers with careers URL</dt>
            <dd>{stats.employersWithCareersUrl}</dd>
          </div>
          <div>
            <dt>Verified candidates</dt>
            <dd>{stats.verifiedCandidates}</dd>
          </div>
          <div>
            <dt>Platform-identified candidates</dt>
            <dd>{stats.platformIdentifiedCandidates}</dd>
          </div>
          <div>
            <dt>Employers with live source</dt>
            <dd>{stats.employersWithLiveSource}</dd>
          </div>
          <div>
            <dt>Employers with jobs</dt>
            <dd>{stats.employersWithJobs}</dd>
          </div>
          <div>
            <dt>Live sources</dt>
            <dd>{stats.liveSources}</dd>
          </div>
          <div>
            <dt>Browser sources</dt>
            <dd>{stats.browserSources}</dd>
          </div>
          <div>
            <dt>HTTP sources</dt>
            <dd>{stats.httpSources}</dd>
          </div>
        </dl>
        {stats.sourcesByType.length > 0 && (
          <div className="cms-table-scroll">
            <table className="cms-data-table">
              <thead>
                <tr>
                  <th>Source type</th>
                  <th>Mode</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                {stats.sourcesByType.map((entry) => (
                  <tr key={`${entry.sourceType}-${entry.needsBrowser}`}>
                    <td>{entry.sourceType}</td>
                    <td>{entry.needsBrowser ? "Browser" : "HTTP"}</td>
                    <td>{entry.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {stats.jobsByAts.length > 0 && (
          <>
            <h3 className="cms-detail-subheading">Jobs by ATS provider</h3>
            <div className="cms-table-scroll">
              <table className="cms-data-table">
                <thead>
                  <tr>
                    <th>ATS provider</th>
                    <th>Jobs</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.jobsByAts.map((row) => (
                    <tr key={row.atsProvider ?? "unknown"}>
                      <td>{row.atsProvider ?? "Not recorded"}</td>
                      <td>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="cms-operations-section" aria-labelledby="coverage-heading">
        <div className="cms-section-heading">
          <div>
            <h2 id="coverage-heading">Platform coverage</h2>
            <p>
              {totals.employers} researched employers · {totals.verified} with verified candidates ·{" "}
              {totals.live} with live sources
            </p>
          </div>
        </div>
        <div className="cms-table-scroll">
          <table className="cms-data-table">
            <thead>
              <tr>
                <th>Platform</th>
                <th>Employers</th>
                <th>P0</th>
                <th>P1</th>
                <th>P2</th>
                <th>P3</th>
                <th>Verified</th>
                <th>Live</th>
              </tr>
            </thead>
            <tbody>
              {coverage.map((row) => (
                <tr key={row.platform}>
                  <td>
                    <strong>{platformDisplayName(row.platform)}</strong>
                  </td>
                  <td>{row.employers}</td>
                  <td>{row.p0}</td>
                  <td>{row.p1}</td>
                  <td>{row.p2}</td>
                  <td>{row.p3}</td>
                  <td>{row.verified}</td>
                  <td>{row.live}</td>
                </tr>
              ))}
              <tr>
                <td>
                  <strong>Total</strong>
                </td>
                <td>{totals.employers}</td>
                <td>{totals.p0}</td>
                <td>{totals.p1}</td>
                <td>{totals.p2}</td>
                <td>{totals.p3}</td>
                <td>{totals.verified}</td>
                <td>{totals.live}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="cms-operations-section" aria-labelledby="queue-heading">
        <div className="cms-section-heading">
          <div>
            <h2 id="queue-heading">Discovery queue ({queue.length})</h2>
          </div>
        </div>
        <form className="cms-filter-row" method="get" action="/admin/source-discovery">
          <label>
            Search
            <input defaultValue={filters.search ?? ""} name="q" placeholder="Employer" />
          </label>
          <label>
            Tier
            <select name="tier" defaultValue={filters.tier ?? ""}>
              <option value="">All tiers</option>
              {DISCOVERY_TIERS.map((tier) => (
                <option key={tier} value={tier}>
                  {tier}
                </option>
              ))}
            </select>
          </label>
          <label>
            Platform
            <select name="platform" defaultValue={filters.platform ?? ""}>
              <option value="">All platforms</option>
              {DISCOVERY_PLATFORMS.map((platform) => (
                <option key={platform} value={platform}>
                  {platformDisplayName(platform)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select name="status" defaultValue={filters.status ?? ""}>
              <option value="">Any status</option>
              {DISCOVERY_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {discoveryStatusLabels[status] ?? status}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Apply filters</button>
        </form>
        <div className="cms-table-scroll">
          <table className="cms-data-table">
            <thead>
              <tr>
                <th>Employer</th>
                <th>Tier</th>
                <th>Priority</th>
                <th>Candidate URL</th>
                <th>Platform</th>
                <th>Status</th>
                <th>Confidence</th>
                <th>Method</th>
                <th>Verification</th>
                <th>Live sources</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((candidate) => (
                <tr key={candidate.candidateId}>
                  <td>
                    <strong>{candidate.companyName}</strong>
                    <span className="cms-employer-aliases"> {candidate.companySlug}</span>
                  </td>
                  <td>{candidate.tier ?? "–"}</td>
                  <td>{candidate.crawlerPriorityScore ?? "–"}</td>
                  <td>
                    <a
                      href={candidate.candidateUrl}
                      target="_blank"
                      rel="noreferrer"
                      title={candidate.candidateUrl}
                    >
                      {candidate.candidateUrl.slice(0, 60)}
                    </a>
                  </td>
                  <td>{candidate.platformHint ?? "–"}</td>
                  <td>
                    <span className={`status-badge ${statusTint(candidate.status)}`}>
                      {discoveryStatusLabels[candidate.status] ?? candidate.status}
                    </span>
                  </td>
                  <td>{candidate.confidence ?? "–"}</td>
                  <td>{candidate.discoveryMethod ?? "–"}</td>
                  <td>
                    {candidate.atsVerificationStatus ?? "–"}
                    {candidate.verifiedAt ? ` · ${formatAdminDate(candidate.verifiedAt)}` : ""}
                  </td>
                  <td>{candidate.liveSources > 0 ? candidate.liveSources : "–"}</td>
                  <td>
                    {candidate.status === "verified" || candidate.verifiedAt !== null ? (
                      <form action={promoteVerifiedCandidate}>
                        <input type="hidden" name="candidateId" value={candidate.candidateId} />
                        <button
                          type="submit"
                          className="button-link"
                          title="Creates a paused source in Job sources; never activates crawling automatically."
                        >
                          Promote (paused)
                        </button>
                      </form>
                    ) : (
                      <span className="hint">–</span>
                    )}
                  </td>
                </tr>
              ))}
              {queue.length === 0 && (
                <tr>
                  <td colSpan={11} className="hint">
                    No discovery candidates match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="hint">
          <a href="/admin/source-discovery">Clear filters</a>
        </p>
      </section>
    </main>
  );
}
