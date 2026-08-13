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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SourceDiscoveryPage({
  searchParams,
}: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  const administrator = await requireAdministrator();
  const query = await searchParams;
  const filters = parseDiscoveryQueueFilters(query);
  const { coverage, queue, totals } = await readSourceDiscovery(administrator.userId, filters);

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
                    <a href={candidate.candidateUrl} target="_blank" rel="noreferrer">
                      {candidate.candidateUrl.slice(0, 60)}
                    </a>
                  </td>
                  <td>{candidate.platformHint ?? "–"}</td>
                  <td>{discoveryStatusLabels[candidate.status] ?? candidate.status}</td>
                  <td>{candidate.confidence ?? "–"}</td>
                  <td>{candidate.discoveryMethod ?? "–"}</td>
                  <td>
                    {candidate.atsVerificationStatus ?? "–"}
                    {candidate.verifiedAt
                      ? ` · ${candidate.verifiedAt.toISOString().slice(0, 10)}`
                      : ""}
                  </td>
                  <td>{candidate.liveSources > 0 ? candidate.liveSources : "–"}</td>
                  <td>
                    {candidate.status === "verified" || candidate.verifiedAt !== null ? (
                      <form action={promoteVerifiedCandidate}>
                        <input type="hidden" name="candidateId" value={candidate.candidateId} />
                        <button type="submit" className="button-link">
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
