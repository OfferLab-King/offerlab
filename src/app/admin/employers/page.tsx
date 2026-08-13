import { requireAdministrator } from "../../../modules/identity-access/application/authorization";
import {
  EMPLOYER_RESEARCH_CONFIDENCES,
  EMPLOYER_RESEARCH_STATUSES,
  EMPLOYER_RESEARCH_TIERS,
  parseEmployerResearchFilters,
} from "../../../modules/employer-research/application/employer-research-view";
import { readEmployerResearch } from "../../../modules/employer-research/application/employer-research";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tierLabel = {
  P0: "P0",
  P1: "P1",
  P2: "P2",
  P3: "P3",
} as const;

const researchStatusLabel: Readonly<Record<string, string>> = {
  not_researched: "Not researched",
  verified_platform: "Platform verified",
  verified_careers_url: "Careers URL verified",
  needs_re_verification: "Needs re-verification",
  blocked_review: "Blocked / review",
  verified_source: "Source verified",
};

export default async function EmployersResearchPage({
  searchParams,
}: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  const administrator = await requireAdministrator();
  const query = await searchParams;
  const filters = parseEmployerResearchFilters(query);
  const { rows, summary } = await readEmployerResearch(administrator.userId, filters);

  return (
    <main className="cms-page">
      <header className="cms-page-header">
        <div>
          <p className="eyebrow">Administrator operations</p>
          <h1>Employer research</h1>
          <p>
            The Top 1,000 sponsor-aware employer universe. Research records are separate from live
            crawler sources in /admin/job-sources; nothing here activates crawling.
          </p>
        </div>
      </header>

      <section className="cms-operations-section" aria-labelledby="employer-summary">
        <div className="cms-section-heading">
          <div>
            <h2 id="employer-summary">Universe summary</h2>
            <p>
              {summary.total} researched employers · P0 {summary.p0} · P1 {summary.p1} · P2{" "}
              {summary.p2} · P3 {summary.p3} · unresolved {summary.unresolved} · live sources{" "}
              {summary.withLiveSource} · with jobs {summary.withJobs} · sponsor entities{" "}
              {summary.sponsors}
            </p>
          </div>
        </div>
        <form className="cms-filter-row" method="get" action="/admin/employers">
          <label>
            Search
            <input
              defaultValue={filters.search ?? ""}
              name="q"
              placeholder="Employer, alias or sponsor entity"
            />
          </label>
          <label>
            Tier
            <select name="tier" defaultValue={filters.tier ?? ""}>
              <option value="">All tiers</option>
              {EMPLOYER_RESEARCH_TIERS.map((tier) => (
                <option key={tier} value={tier}>
                  {tier}
                </option>
              ))}
            </select>
          </label>
          <label>
            Confidence
            <select name="confidence" defaultValue={filters.identityConfidence ?? ""}>
              <option value="">Any confidence</option>
              {EMPLOYER_RESEARCH_CONFIDENCES.map((confidence) => (
                <option key={confidence} value={confidence}>
                  {confidence}
                </option>
              ))}
            </select>
          </label>
          <label>
            Research status
            <select name="research" defaultValue={filters.researchStatus ?? ""}>
              <option value="">Any status</option>
              {EMPLOYER_RESEARCH_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {researchStatusLabel[status] ?? status}
                </option>
              ))}
            </select>
          </label>
          <label className="cms-check-filter">
            <input name="live" type="checkbox" value="1" defaultChecked={filters.hasLiveSource} />
            Has live source
          </label>
          <label className="cms-check-filter">
            <input name="jobs" type="checkbox" value="1" defaultChecked={filters.hasJobs} />
            Has jobs
          </label>
          <label className="cms-check-filter">
            <input
              name="unresolved"
              type="checkbox"
              value="1"
              defaultChecked={filters.unresolved}
            />
            Unresolved identity
          </label>
          <button type="submit">Apply filters</button>
        </form>
      </section>

      <section className="cms-operations-section" aria-labelledby="employer-table">
        <div className="cms-section-heading">
          <div>
            <h2 id="employer-table">Research employers ({rows.length})</h2>
          </div>
        </div>
        <div className="cms-table-scroll">
          <table className="cms-data-table cms-employer-table">
            <thead>
              <tr>
                <th>Employer</th>
                <th>Tier</th>
                <th>Value</th>
                <th>Industry</th>
                <th>Size</th>
                <th>Ownership</th>
                <th>Sponsor</th>
                <th>Identity</th>
                <th>Coverage</th>
                <th>ATS / platform</th>
                <th>Jobs</th>
                <th>Research</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.companyId ?? `unresolved-${row.name}`}>
                  <td>
                    <strong>{row.name}</strong>
                    {row.aliases.length > 0 && (
                      <span className="cms-employer-aliases">
                        {" "}
                        {row.aliases.slice(0, 3).join(" · ")}
                      </span>
                    )}
                    {row.companyId === null && <span className="status-badge">Unresolved</span>}
                  </td>
                  <td>
                    {row.tier ? (tierLabel[row.tier as keyof typeof tierLabel] ?? row.tier) : "–"}
                  </td>
                  <td>{row.employerValueScore ?? "–"}</td>
                  <td>{row.sector ?? "–"}</td>
                  <td>{row.employeeBand ?? "–"}</td>
                  <td>{row.ownership ?? "–"}</td>
                  <td>
                    {row.sponsorEntities > 0
                      ? `${row.sponsorEntities} entity${row.sponsorEntities === 1 ? "" : "s"}`
                      : "–"}
                  </td>
                  <td>{row.identityConfidence ?? "–"}</td>
                  <td>
                    {row.liveSources > 0 ? `${row.liveSources} live` : "–"}
                    {row.sourceCandidates > 0
                      ? ` · ${row.sourceCandidates} candidate${row.sourceCandidates === 1 ? "" : "s"}`
                      : ""}
                  </td>
                  <td>{row.atsProviders ?? "–"}</td>
                  <td>{row.currentJobs > 0 ? row.currentJobs : "–"}</td>
                  <td>
                    {row.researchStatus
                      ? (researchStatusLabel[row.researchStatus] ?? row.researchStatus)
                      : "–"}
                    {row.researchDate ? ` · ${row.researchDate.toISOString().slice(0, 10)}` : ""}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={12} className="hint">
                    No employers match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="hint">
          <a href="/admin/employers">Clear filters</a>
        </p>
      </section>
    </main>
  );
}
