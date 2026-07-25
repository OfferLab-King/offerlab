import { requireMember } from "../../../../modules/identity-access/application/authorization";
import { readServiceOfferings } from "../../../../modules/practice-services/application/services";
import { MemberApplicationsHeader } from "../../applications/member-applications-header";
import { LearnNavigation } from "../learn-navigation";
import { cancelServiceAction, requestServiceAction } from "./actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function PracticePage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  const { userId } = await requireMember();
  const [offerings, query] = await Promise.all([readServiceOfferings(userId), searchParams]);
  return (
    <main className="applications-shell">
      <MemberApplicationsHeader />
      <LearnNavigation active="practice" />
      <section className="applications-heading">
        <div>
          <p className="eyebrow">Practise with people</p>
          <h1>Practice &amp; Feedback</h1>
          <p className="intro">
            Register for small, manually operated pilots. There is no automatic matching or payment:
            the OfferLab team confirms availability before anything is booked.
          </p>
        </div>
      </section>
      {query.result === "requested" && (
        <p className="success-summary" role="status">
          Request received. We will confirm availability separately.
        </p>
      )}
      {query.result === "cancelled" && (
        <p className="success-summary" role="status">
          Your request has been cancelled.
        </p>
      )}
      {query.result === "error" && (
        <p className="error-summary" role="alert">
          We could not update that request. Reload and try again.
        </p>
      )}
      <div className="resource-grid service-grid">
        {offerings.map((offering) => (
          <article className="card direct-tool-card" key={offering.id}>
            <span className="availability-label">
              {offering.availability === "interest" ? "Pilot interest" : offering.availability}
            </span>
            <h2>{offering.title}</h2>
            <p>{offering.summary}</p>
            <p>
              {offering.deliveryMode === "asynchronous" ? "Asynchronous review" : "Online session"}
              {offering.turnaroundDays
                ? ` · target response within ${offering.turnaroundDays} days`
                : ""}
            </p>
            {offering.requestStatus && offering.requestStatus !== "cancelled" ? (
              <div>
                <p>
                  <strong>Status:</strong> {offering.requestStatus}
                </p>
                {(["requested", "confirmed"] as const).includes(
                  offering.requestStatus as "requested" | "confirmed",
                ) && (
                  <form action={cancelServiceAction}>
                    <input name="requestId" type="hidden" value={offering.requestId!} />
                    <input name="version" type="hidden" value={offering.requestVersion!} />
                    <button className="button-secondary" type="submit">
                      Cancel request
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <form action={requestServiceAction}>
                <input name="offeringId" type="hidden" value={offering.id} />
                <button type="submit">
                  {offering.offeringType === "group_mock"
                    ? "Register interest"
                    : "Request this pilot"}
                </button>
              </form>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}
