import { requireAdministrator } from "../../../modules/identity-access/application/authorization";
import {
  readServiceOfferingsForAdmin,
  readServiceRequestsForAdmin,
} from "../../../modules/practice-services/application/services";
import { updateServiceOfferingAction, updateServiceRequestAction } from "./actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function OperationsPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  const administrator = await requireAdministrator();
  const [requests, offerings, query] = await Promise.all([
    readServiceRequestsForAdmin(administrator.userId),
    readServiceOfferingsForAdmin(administrator.userId),
    searchParams,
  ]);
  return (
    <main className="cms-page admin-operations-page">
      <header className="cms-page-header">
        <div>
          <p className="eyebrow">Administrator operations</p>
          <h1>Moderation and pilot requests</h1>
          <p>Review submissions and manage the availability of manually operated services.</p>
        </div>
      </header>
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
      <section className="cms-operations-section" aria-labelledby="pilot-requests">
        <div className="cms-section-heading">
          <div>
            <h2 id="pilot-requests">Practice and feedback requests</h2>
            <p>Open, pause or collect interest for each manually managed service.</p>
          </div>
        </div>
        <div className="cms-offering-grid">
          {offerings.map((offering) => (
            <article className="cms-operation-card" key={offering.id}>
              <h3>{offering.title}</h3>
              <form action={updateServiceOfferingAction} className="cms-operation-form">
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
        <div className="cms-request-list">
          {requests.map((request) => (
            <article className="cms-operation-card" key={request.id}>
              <span className="status-badge">{request.status}</span>
              <h3>{request.offering_title}</h3>
              <p>
                {request.offering_type.replaceAll("_", " ")} · requested{" "}
                {new Date(request.created_at).toLocaleDateString("en-GB")}
              </p>
              <form
                action={updateServiceRequestAction}
                className="form-actions cms-operation-actions"
              >
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
          {!requests.length && <p className="cms-empty-inline">No pilot requests yet.</p>}
        </div>
      </section>
    </main>
  );
}
