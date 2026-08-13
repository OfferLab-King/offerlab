import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdministrator } from "../../../../modules/identity-access/application/authorization";
import { readEmployerDetailForAdmin } from "../../../../modules/employer-research/application/employer-research";
import { employerIndustryLabel } from "../../../../modules/job-catalog/domain/employer-directory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EmployerDetailParams = Promise<{ id: string }>;

const tierLabel = { P0: "P0", P1: "P1", P2: "P2", P3: "P3" } as const;

const researchStatusLabel: Readonly<Record<string, string>> = {
  not_researched: "Not researched",
  verified_platform: "Platform verified",
  verified_careers_url: "Careers URL verified",
  needs_re_verification: "Needs re-verification",
  blocked_review: "Blocked / review",
  verified_source: "Source verified",
};

const candidateStatusLabel: Readonly<Record<string, string>> = {
  not_researched: "Not researched",
  researching: "Researching",
  candidate_found: "Candidate URL",
  platform_identified: "Platform identified",
  endpoint_identified: "Endpoint identified",
  verified: "Verified",
  failed: "Failed",
  blocked: "Blocked",
  unsupported: "Unsupported",
  promoted: "Promoted",
};

const sourceStatusLabel: Readonly<Record<string, string>> = {
  active: "Active",
  paused: "Paused",
  archived: "Archived",
};

function dateOnly(value: Date | null | undefined): string {
  if (!value) return "–";
  return value.toISOString().slice(0, 10);
}

export default async function EmployerDetailPage({
  params,
}: Readonly<{ params: EmployerDetailParams }>) {
  const administrator = await requireAdministrator();
  const { id } = await params;
  const detail = await readEmployerDetailForAdmin(administrator.userId, id);
  if (!detail) notFound();

  const snapshot = detail.snapshot;
  return (
    <main className="cms-page">
      <header className="cms-page-header">
        <div>
          <p className="eyebrow">Administrator operations</p>
          <h1>{detail.name}</h1>
          <p>
            Employer research detail. Live source operations stay in{" "}
            <Link href="/admin/job-sources">Job sources</Link>.
          </p>
        </div>
      </header>

      <section className="cms-operations-section" aria-labelledby="identity-heading">
        <div className="cms-section-heading">
          <div>
            <h2 id="identity-heading">Identity</h2>
          </div>
        </div>
        <dl className="cms-detail-grid">
          <div>
            <dt>Slug</dt>
            <dd>
              <code>{detail.slug}</code>
            </dd>
          </div>
          <div>
            <dt>Employer industry</dt>
            <dd>{employerIndustryLabel(detail.employerIndustryKey) ?? "–"}</dd>
          </div>
          <div>
            <dt>Subindustry</dt>
            <dd>{detail.employerSubindustryKey ?? "–"}</dd>
          </div>
          <div>
            <dt>Website</dt>
            <dd>
              {detail.websiteUrl ? (
                <a href={detail.websiteUrl} rel="noreferrer" target="_blank">
                  {detail.websiteUrl}
                </a>
              ) : (
                "–"
              )}
            </dd>
          </div>
          <div>
            <dt>Careers URL</dt>
            <dd>
              {detail.careersUrl ? (
                <a href={detail.careersUrl} rel="noreferrer" target="_blank">
                  {detail.careersUrl}
                </a>
              ) : (
                "–"
              )}
            </dd>
          </div>
          <div>
            <dt>Active</dt>
            <dd>{detail.active ? "Yes" : "No"}</dd>
          </div>
        </dl>
        {detail.aliases.length > 0 && (
          <>
            <h3 className="cms-detail-subheading">Aliases</h3>
            <ul className="cms-detail-list">
              {detail.aliases.map((alias) => (
                <li key={`${alias.alias}-${alias.aliasType}`}>
                  <code>{alias.alias}</code> <span className="hint">({alias.aliasType})</span>
                </li>
              ))}
            </ul>
          </>
        )}
        {detail.description && <p className="hint">{detail.description}</p>}
      </section>

      <section className="cms-operations-section" aria-labelledby="sponsor-heading">
        <div className="cms-section-heading">
          <div>
            <h2 id="sponsor-heading">Sponsorship</h2>
            <p>
              {detail.sponsors.length} Home Office legal entit
              {detail.sponsors.length === 1 ? "y" : "ies"}
            </p>
          </div>
        </div>
        {detail.sponsors.length === 0 ? (
          <p className="hint">No sponsor entities recorded.</p>
        ) : (
          <div className="cms-table-scroll">
            <table className="cms-data-table">
              <thead>
                <tr>
                  <th>Legal entity</th>
                  <th>Town / city</th>
                  <th>Routes</th>
                  <th>Snapshot</th>
                  <th>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {detail.sponsors.map((sponsor) => (
                  <tr key={sponsor.id}>
                    <td>
                      <strong>{sponsor.legalName}</strong>
                      {!sponsor.activeInSnapshot && <span className="status-badge">inactive</span>}
                    </td>
                    <td>{sponsor.townCity ?? "–"}</td>
                    <td>{sponsor.routes.join(", ") || "–"}</td>
                    <td>{dateOnly(sponsor.sourceSnapshotDate)}</td>
                    <td>{sponsor.identityConfidence ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="cms-operations-section" aria-labelledby="research-heading">
        <div className="cms-section-heading">
          <div>
            <h2 id="research-heading">Research (internal)</h2>
            {snapshot && (
              <p>
                {snapshot.datasetVersion} · {dateOnly(snapshot.researchDate)} ·{" "}
                {researchStatusLabel[snapshot.researchStatus] ?? snapshot.researchStatus}
              </p>
            )}
          </div>
        </div>
        {!snapshot ? (
          <p className="hint">No research snapshot recorded.</p>
        ) : (
          <>
            <dl className="cms-detail-grid">
              <div>
                <dt>Tier / rank</dt>
                <dd>
                  {tierLabel[snapshot.priorityTier as keyof typeof tierLabel] ??
                    snapshot.priorityTier}{" "}
                  · {snapshot.internalRank}
                </dd>
              </div>
              <div>
                <dt>Employer value</dt>
                <dd>{snapshot.employerValueScore ?? "–"}</dd>
              </div>
              <div>
                <dt>Crawler readiness</dt>
                <dd>{snapshot.crawlerReadinessScore ?? "–"}</dd>
              </div>
              <div>
                <dt>Crawler priority</dt>
                <dd>{snapshot.crawlerPriorityScore ?? "–"}</dd>
              </div>
              <div>
                <dt>Sponsorship score</dt>
                <dd>{snapshot.sponsorshipScore ?? "–"}</dd>
              </div>
              <div>
                <dt>Early-career score</dt>
                <dd>{snapshot.earlyCareerScore ?? "–"}</dd>
              </div>
              <div>
                <dt>Sector / subsector</dt>
                <dd>{[snapshot.sector, snapshot.subsector].filter(Boolean).join(" · ") || "–"}</dd>
              </div>
              <div>
                <dt>ATS (research)</dt>
                <dd>{snapshot.atsPlatform ?? "–"}</dd>
              </div>
              <div>
                <dt>Employees</dt>
                <dd>
                  {snapshot.employeeBand ?? "–"}
                  {snapshot.employeeScope ? ` (${snapshot.employeeScope})` : ""}
                </dd>
              </div>
              <div>
                <dt>Ownership</dt>
                <dd>
                  {snapshot.ownershipType ?? "–"}
                  {snapshot.ticker
                    ? ` · ${snapshot.ticker}${snapshot.exchange ? ` / ${snapshot.exchange}` : ""}`
                    : ""}
                </dd>
              </div>
              <div>
                <dt>Identity confidence</dt>
                <dd>{snapshot.identityConfidence ?? "–"}</dd>
              </div>
              <div>
                <dt>Crawler wave</dt>
                <dd>{snapshot.crawlerWave ?? "–"}</dd>
              </div>
            </dl>
            {snapshot.evidenceUrls.length > 0 && (
              <>
                <h3 className="cms-detail-subheading">Evidence</h3>
                <ul className="cms-detail-list">
                  {snapshot.evidenceUrls.map((url) => (
                    <li key={url}>
                      <a href={url} rel="noreferrer" target="_blank">
                        {url}
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {snapshot.notes && <p className="hint">{snapshot.notes}</p>}
          </>
        )}
      </section>

      <section className="cms-operations-section" aria-labelledby="candidate-heading">
        <div className="cms-section-heading">
          <div>
            <h2 id="candidate-heading">Source discovery candidates</h2>
            <p>
              {detail.candidates.length} candidate{detail.candidates.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        {detail.candidates.length === 0 ? (
          <p className="hint">
            No discovery candidates. Run{" "}
            <code>pnpm jobs:discover-source --company={detail.slug}</code>.
          </p>
        ) : (
          <div className="cms-table-scroll">
            <table className="cms-data-table">
              <thead>
                <tr>
                  <th>URL</th>
                  <th>Platform</th>
                  <th>Status</th>
                  <th>Confidence</th>
                  <th>Method</th>
                  <th>Verified</th>
                </tr>
              </thead>
              <tbody>
                {detail.candidates.map((candidate) => (
                  <tr key={candidate.id}>
                    <td>
                      {candidate.candidateUrl ? (
                        <a href={candidate.candidateUrl} rel="noreferrer" target="_blank">
                          {candidate.candidateUrl.slice(0, 60)}
                        </a>
                      ) : (
                        "–"
                      )}
                    </td>
                    <td>{candidate.platformHint ?? "–"}</td>
                    <td>{candidateStatusLabel[candidate.status] ?? candidate.status}</td>
                    <td>{candidate.confidence ?? "–"}</td>
                    <td>{candidate.discoveryMethod ?? "–"}</td>
                    <td>
                      {candidate.atsVerificationStatus ?? "–"}
                      {candidate.verifiedAt ? ` · ${dateOnly(candidate.verifiedAt)}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="cms-operations-section" aria-labelledby="live-heading">
        <div className="cms-section-heading">
          <div>
            <h2 id="live-heading">Live sources</h2>
            <p>
              {detail.liveSources.length} source{detail.liveSources.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        {detail.liveSources.length === 0 ? (
          <p className="hint">
            No live sources. Operations live in{" "}
            <Link href="/admin/job-sources">/admin/job-sources</Link>.
          </p>
        ) : (
          <div className="cms-table-scroll">
            <table className="cms-data-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Type</th>
                  <th>Channel</th>
                  <th>Mode</th>
                  <th>Landing / endpoint</th>
                  <th>Failures</th>
                  <th>Next check</th>
                </tr>
              </thead>
              <tbody>
                {detail.liveSources.map((source) => (
                  <tr key={source.id}>
                    <td>
                      <strong>{source.name}</strong>
                      <span className="cms-employer-aliases"> {source.slug}</span>
                    </td>
                    <td>{sourceStatusLabel[source.status] ?? source.status}</td>
                    <td>{source.sourceType}</td>
                    <td>{source.channel}</td>
                    <td>{source.needsBrowser ? "Browser" : "HTTP"}</td>
                    <td>
                      {source.landingHealthStatus} / {source.endpointHealthStatus}
                    </td>
                    <td>{source.consecutiveFailures}</td>
                    <td>{dateOnly(source.nextCheckAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
