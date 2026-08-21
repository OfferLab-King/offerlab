import { requireMember } from "../../../../modules/identity-access/application/authorization";
import Link from "next/link";
import { readGroupMockLobby } from "../../../../modules/practice-services/application/group-mock";
import {
  groupMockDifficulties,
  groupMockExerciseTypes,
  groupMockSectors,
} from "../../../../modules/practice-services/domain/group-mock";
import { readServiceOfferings } from "../../../../modules/practice-services/application/services";
import { LearnNavigation } from "../learn-navigation";
import {
  cancelGroupMockAction,
  cancelServiceAction,
  requestServiceAction,
  reserveGroupMockAction,
} from "./actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function PracticePage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  const { userId } = await requireMember();
  const [offerings, sessions, query] = await Promise.all([
    readServiceOfferings(userId),
    readGroupMockLobby(userId),
    searchParams,
  ]);
  const messages: Record<string, string> = {
    "payment-pending": "Your seat is held while OfferLab confirms the external payment.",
    reserved: "Your seat is confirmed.",
    "seat-cancelled": "Your seat was cancelled and the first waitlisted member was promoted.",
    waitlisted: "The room is full, so you have joined the waitlist.",
  };
  return (
    <main className="applications-shell">
      <LearnNavigation active="practice" />
      <section className="applications-heading">
        <div>
          <p className="eyebrow">Practise with people</p>
          <h1>Practice &amp; Feedback</h1>
          <p className="intro">
            Reserve a place in a structured, fixed-length group exercise using original OfferLab
            material. Rooms are scheduled and facilitated by OfferLab; members never receive shared
            host credentials.
          </p>
        </div>
      </section>
      {query.result && messages[query.result] && (
        <p className="success-summary" role="status">
          {messages[query.result]}
        </p>
      )}
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
      <section className="group-mock-lobby" aria-labelledby="group-mock-heading">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Group Mock rooms</p>
            <h2 id="group-mock-heading">Choose a practice room</h2>
            <p>Verified members aged 18 or over can reserve one seat per room.</p>
          </div>
          <div className="form-actions">
            <Link className="button-secondary button-link" href="/member/learn/practice/cases">
              Browse 100 practice cases
            </Link>
            <span className="group-mock-safety-label">No recording</span>
          </div>
        </div>
        <div className="group-mock-room-grid">
          {sessions.map((session) => {
            const activeBooking =
              session.bookingStatus && session.bookingStatus !== "cancelled"
                ? session.bookingStatus
                : null;
            const roomReady = session.confirmedCount >= session.minimumParticipants;
            return (
              <article className="group-mock-room" key={session.id}>
                <div className="group-mock-room-topline">
                  <span className={`room-state room-state-${roomReady ? "ready" : "filling"}`}>
                    {session.state === "completed" ? "Completed" : roomReady ? "Ready" : "Filling"}
                  </span>
                  <span>
                    {session.confirmedCount} of {session.capacity} seats
                  </span>
                </div>
                <div>
                  <p className="eyebrow">{groupMockSectors[session.sector]}</p>
                  <h3>{session.title}</h3>
                  <p>{session.materialSummary}</p>
                </div>
                <dl className="group-mock-room-facts">
                  <div>
                    <dt>Starts</dt>
                    <dd>
                      {new Date(session.startsAt).toLocaleString("en-GB", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Europe/London",
                      })}
                    </dd>
                  </div>
                  <div>
                    <dt>Exercise</dt>
                    <dd>{groupMockExerciseTypes[session.exerciseType]}</dd>
                  </div>
                  <div>
                    <dt>Level</dt>
                    <dd>{groupMockDifficulties[session.difficulty]}</dd>
                  </div>
                  <div>
                    <dt>Access</dt>
                    <dd>
                      {session.accessMode === "member_included"
                        ? "Included with membership"
                        : `£${((session.pricePence ?? 0) / 100).toFixed(2)} · external payment`}
                    </dd>
                  </div>
                </dl>
                {activeBooking ? (
                  <div className="group-mock-booking-state">
                    <p>
                      <strong>Your status:</strong> {activeBooking.replaceAll("_", " ")}
                    </p>
                    {activeBooking === "payment_pending" && session.paymentUrl && (
                      <a
                        className="button-link"
                        href={session.paymentUrl}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        Pay securely
                      </a>
                    )}
                    {(activeBooking === "confirmed" || activeBooking === "attended") && (
                      <a className="button-link" href={`/member/learn/practice/${session.id}`}>
                        View session material
                      </a>
                    )}
                    {session.joinUrl && (
                      <a
                        className="button-link"
                        href={session.joinUrl}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        Enter meeting
                      </a>
                    )}
                    {(["payment_pending", "confirmed", "waitlisted"] as const).includes(
                      activeBooking as "payment_pending" | "confirmed" | "waitlisted",
                    ) && (
                      <form action={cancelGroupMockAction}>
                        <input name="bookingId" type="hidden" value={session.bookingId!} />
                        <input name="version" type="hidden" value={session.bookingVersion!} />
                        <button className="button-secondary" type="submit">
                          Cancel seat
                        </button>
                      </form>
                    )}
                  </div>
                ) : session.state === "open" ? (
                  <form action={reserveGroupMockAction} className="group-mock-reserve-form">
                    <input name="sessionId" type="hidden" value={session.id} />
                    <label className="checkbox-label">
                      <input name="ageConfirmed" required type="checkbox" value="yes" />
                      <span>I confirm I am 18 or over.</span>
                    </label>
                    <label className="checkbox-label">
                      <input name="rulesConfirmed" required type="checkbox" value="yes" />
                      <span>
                        I will not record, share contact details or distribute the exercise
                        material.
                      </span>
                    </label>
                    <button type="submit">
                      {session.confirmedCount >= session.capacity
                        ? "Join waitlist"
                        : "Reserve seat"}
                    </button>
                  </form>
                ) : (
                  <p className="group-mock-closed">Reservations are closed.</p>
                )}
              </article>
            );
          })}
          {!sessions.length && (
            <div className="card empty-state">
              <h3>No rooms are scheduled yet</h3>
              <p>New session dates will appear here after OfferLab publishes them.</p>
            </div>
          )}
        </div>
      </section>
      <section aria-labelledby="feedback-pilots-heading">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Additional support</p>
            <h2 id="feedback-pilots-heading">Feedback services</h2>
          </div>
        </div>
        <div className="resource-grid service-grid">
          {offerings
            .filter((offering) => offering.offeringType !== "group_mock")
            .map((offering) => (
              <article className="card direct-tool-card" key={offering.id}>
                <span className="availability-label">
                  {offering.availability === "interest"
                    ? "Register interest"
                    : offering.availability}
                </span>
                <h2>{offering.title}</h2>
                <p>{offering.summary}</p>
                <p>
                  {offering.deliveryMode === "asynchronous"
                    ? "Asynchronous review"
                    : "Online session"}
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
                        : "Request this service"}
                    </button>
                  </form>
                )}
              </article>
            ))}
        </div>
      </section>
    </main>
  );
}
