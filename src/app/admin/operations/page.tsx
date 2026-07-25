import Link from "next/link";
import { requireAdministrator } from "../../../modules/identity-access/application/authorization";
import {
  readServiceOfferingsForAdmin,
  readServiceRequestsForAdmin,
} from "../../../modules/practice-services/application/services";
import { readIntelligenceReportsForAdmin } from "../../../modules/recruitment-intelligence/application/reports";
import { recruitmentStageLabel } from "../../../modules/taxonomy/domain/display-labels";
import {
  moderateReportAction,
  updateServiceOfferingAction,
  updateServiceRequestAction,
} from "./actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function OperationsPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  const administrator = await requireAdministrator();
  const [reports, requests, offerings, query] = await Promise.all([
    readIntelligenceReportsForAdmin(administrator.userId),
    readServiceRequestsForAdmin(administrator.userId),
    readServiceOfferingsForAdmin(administrator.userId),
    searchParams,
  ]);
  return (
    <main className="applications-shell">
      <p className="eyebrow">Administrator operations</p>
      <h1>Moderation &amp; Pilot Requests</h1>
      <nav>
        <Link href="/admin">Admin home</Link> · <Link href="/admin/content">Content</Link>
      </nav>
      {query.result === "saved" && (
        <p className="success-summary" role="status">
          Update saved.
        </p>
      )}
      {query.result === "error" && (
        <p className="error-summary" role="alert">
          That update could not be saved. Reload and try again.
        </p>
      )}
      <section className="learn-section" aria-labelledby="report-moderation">
        <h2 id="report-moderation">Recruitment intelligence</h2>
        <p>
          Check for confidentiality, identifying information, usefulness and cycle relevance before
          publishing.
        </p>
        <div className="item-list">
          {reports.map((report) => (
            <article className="card compact-card" key={report.id}>
              <span className="status-badge">{report.moderationState}</span>
              <h3>{report.formatSummary}</h3>
              <p>
                {recruitmentStageLabel(report.recruitmentStage)} · {report.recruitmentCycle} ·{" "}
                {report.approximateDate}
              </p>
              <p>
                <strong>Themes:</strong> {report.themes}
              </p>
              <p>
                <strong>Assessed skills:</strong> {report.assessedSkills.join(", ")}
              </p>
              <p>
                <strong>Reflection:</strong> {report.reflection}
              </p>
              <form action={moderateReportAction} className="form-actions">
                <input name="id" type="hidden" value={report.id} />
                <input name="version" type="hidden" value={report.version} />
                <label>
                  Confidence
                  <select name="confidence" defaultValue={report.moderationConfidence ?? "medium"}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </label>
                <button name="state" value="published" type="submit">
                  Publish
                </button>
                <button className="button-secondary" name="state" value="rejected" type="submit">
                  Reject
                </button>
              </form>
            </article>
          ))}
          {!reports.length && <p>No reports to moderate.</p>}
        </div>
      </section>
      <section className="learn-section" aria-labelledby="pilot-requests">
        <h2 id="pilot-requests">Practice and feedback requests</h2>
        <div className="resource-grid">
          {offerings.map((offering) => (
            <article className="card compact-card" key={offering.id}>
              <h3>{offering.title}</h3>
              <form action={updateServiceOfferingAction} className="form-actions">
                <input name="id" type="hidden" value={offering.id} />
                <input name="version" type="hidden" value={offering.version} />
                <label>
                  Availability
                  <select name="availability" defaultValue={offering.availability}>
                    <option value="interest">Collecting interest</option>
                    <option value="open">Open</option>
                    <option value="paused">Paused</option>
                  </select>
                </label>
                <button type="submit">Update availability</button>
              </form>
            </article>
          ))}
        </div>
        <div className="item-list">
          {requests.map((request) => (
            <article className="card compact-card" key={request.id}>
              <span className="status-badge">{request.status}</span>
              <h3>{request.offering_title}</h3>
              <p>
                {request.offering_type.replaceAll("_", " ")} · requested{" "}
                {new Date(request.created_at).toLocaleDateString("en-GB")}
              </p>
              <form action={updateServiceRequestAction} className="form-actions">
                <input name="id" type="hidden" value={request.id} />
                <input name="version" type="hidden" value={request.version} />
                <button name="status" value="confirmed" type="submit">
                  Confirm
                </button>
                <button name="status" value="completed" type="submit">
                  Complete
                </button>
                <button className="button-secondary" name="status" value="cancelled" type="submit">
                  Cancel
                </button>
              </form>
            </article>
          ))}
          {!requests.length && <p>No pilot requests yet.</p>}
        </div>
      </section>
    </main>
  );
}
