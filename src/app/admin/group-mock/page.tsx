import Link from "next/link";

import { requireAdministrator } from "../../../modules/identity-access/application/authorization";
import { readGroupMockAdmin } from "../../../modules/practice-services/application/group-mock";
import { createGroupMockSessionAction, updateGroupMockSessionAction } from "./actions";
import { BookingList, SessionEditor } from "./editors";
import {
  groupMockExerciseTypes,
  groupMockProblemTypes,
  groupMockSectors,
} from "../../../modules/practice-services/domain/group-mock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function GroupMockAdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    fields?: string;
    problem?: string;
    q?: string;
    result?: string;
    sector?: string;
  }>;
}) {
  const administrator = await requireAdministrator();
  const [{ materials, sessions }, query] = await Promise.all([
    readGroupMockAdmin(administrator.userId),
    searchParams,
  ]);
  const success = query.result?.endsWith("-saved");
  const search = query.q?.trim().toLowerCase() ?? "";
  const visibleMaterials = materials.filter(
    (material) =>
      (!search ||
        `${material.title} ${material.summary} ${material.stable_key}`
          .toLowerCase()
          .includes(search)) &&
      (!query.sector || material.sector === query.sector) &&
      (!query.problem || material.problem_type === query.problem),
  );
  const fieldLabels: Record<string, string> = {
    accessMode: "access and payment details",
    capacity: "capacity",
    debriefQuestions: "debrief questions (enter at least two, one per line)",
    deliverable: "required group deliverable (at least 10 characters)",
    endsAt: "end date and time",
    form: "the form",
    informationPack: "information pack (at least 20 characters)",
    materialId: "published exercise material",
    meetingProvider: "meeting provider and URL",
    meetingUrl: "meeting provider and URL",
    minimumParticipants: "minimum participants",
    observerRubric: "observer rubric (at least 20 characters)",
    originalityConfirmed: "originality confirmation",
    participantInstructions: "participant instructions (at least 20 characters)",
    paymentUrl: "payment URL",
    pricePence: "price",
    scenario: "scenario (at least 20 characters)",
    stableKey: "internal key (lowercase letters, numbers and underscores only)",
    startsAt: "start date and time",
    title: "title",
  };
  const invalidFields = (query.fields ?? "")
    .split(",")
    .filter(Boolean)
    .map((field) => fieldLabels[field] ?? field);
  return (
    <main className="cms-page group-mock-admin-page">
      <header className="cms-page-header">
        <div>
          <p className="eyebrow">Practice operations</p>
          <h1>Group Mock</h1>
          <p>
            Create original exercises, schedule fixed rooms and manage seats without exposing member
            identities.
          </p>
        </div>
        <Link className="button-secondary button-link" href="/member/learn/practice">
          View member lobby
        </Link>
      </header>
      {success && (
        <p className="success-summary" role="status">
          Group Mock update saved.
        </p>
      )}
      {query.result === "booking-capacity" && (
        <p className="error-summary" role="alert">
          The seat could not be confirmed: the room is already at full capacity. Free a seat first
          or increase the session capacity.
        </p>
      )}
      {query.result?.startsWith("invalid-") && (
        <p className="error-summary" role="alert">
          The update was not saved. Check{" "}
          {invalidFields.length ? invalidFields.join(", ") : "the required fields"}.
        </p>
      )}
      <section className="cms-operations-section" id="materials">
        <div className="cms-section-heading">
          <div>
            <p className="eyebrow">Exercise library</p>
            <h2>Original practice materials</h2>
            <p>Structured packs are separate from employer assessments and member content.</p>
          </div>
          <Link className="button-link" href="/admin/group-mock/materials/new">
            Create case
          </Link>
        </div>
        <form className="group-mock-library-filters">
          <label>
            Search cases
            <input defaultValue={query.q ?? ""} name="q" placeholder="Title, summary or key" />
          </label>
          <label>
            Industry
            <select defaultValue={query.sector ?? ""} name="sector">
              <option value="">All industries</option>
              {Object.entries(groupMockSectors).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Problem
            <select defaultValue={query.problem ?? ""} name="problem">
              <option value="">All problems</option>
              {Object.entries(groupMockProblemTypes).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Apply filters</button>
          <Link className="button-secondary button-link" href="/admin/group-mock#materials">
            Clear
          </Link>
        </form>
        <p className="cms-result-count">
          Showing {visibleMaterials.length} of {materials.length} cases
        </p>
        <div className="group-mock-case-admin-list">
          {visibleMaterials.map((material) => (
            <article className="group-mock-case-admin-row" key={material.id}>
              <div>
                <div className="group-mock-card-badges">
                  <span className="status-badge">{material.publication_state}</span>
                  <span>{groupMockSectors[material.sector]}</span>
                  <span>{groupMockProblemTypes[material.problem_type]}</span>
                </div>
                <h3>{material.title}</h3>
                <p>{material.summary}</p>
                <small>
                  {groupMockExerciseTypes[material.exercise_type]} · {material.recommended_minutes}{" "}
                  minutes · group of {material.recommended_group_size}
                </small>
              </div>
              <Link
                className="button-secondary button-link"
                href={`/admin/group-mock/materials/${material.id}`}
              >
                Edit
              </Link>
            </article>
          ))}
          {!visibleMaterials.length && (
            <p className="cms-empty-inline">No cases match these filters.</p>
          )}
        </div>
      </section>
      <section className="cms-operations-section" id="sessions">
        <div className="cms-section-heading">
          <div>
            <p className="eyebrow">Room operations</p>
            <h2>Scheduled sessions</h2>
            <p>All dates are entered and displayed in Europe/London time.</p>
          </div>
        </div>
        <details className="group-mock-admin-details group-mock-create-details">
          <summary>Create scheduled room</summary>
          <SessionEditor action={createGroupMockSessionAction} materials={materials} />
        </details>
        <div className="group-mock-admin-list">
          {sessions.map((session) => (
            <details className="group-mock-admin-details" key={session.id}>
              <summary>
                <span>{session.title}</span>
                <span className="status-badge">
                  {session.state} · {session.bookings.length}/{session.capacity}
                </span>
              </summary>
              <SessionEditor
                action={updateGroupMockSessionAction}
                materials={materials}
                session={session}
              />
              <BookingList session={session} />
            </details>
          ))}
          {!sessions.length && <p className="cms-empty-inline">No rooms scheduled yet.</p>}
        </div>
      </section>
    </main>
  );
}
