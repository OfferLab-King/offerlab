import {
  formatLondonDateTimeInput,
  groupMockDifficulties,
  groupMockExerciseTypes,
  groupMockProblemTypes,
  groupMockSectors,
} from "../../../modules/practice-services/domain/group-mock";
import type {
  GroupMockAdminSession,
  GroupMockMaterialAdmin,
  GroupMockMaterialAdminSummary,
} from "../../../modules/practice-services/infrastructure/group-mock-repository";
import { updateGroupMockBookingAction } from "./actions";

type FormAction = (formData: FormData) => void | Promise<void>;

export function MaterialEditor({
  action,
  material,
}: {
  action: FormAction;
  material?: GroupMockMaterialAdmin;
}) {
  return (
    <form action={action} className="cms-editor-card group-mock-admin-form">
      {material && (
        <>
          <input name="id" type="hidden" value={material.id} />
          <input name="version" type="hidden" value={material.version} />
        </>
      )}
      <div className="form-grid">
        <label>
          Internal key
          <input
            defaultValue={material?.stable_key ?? ""}
            name="stableKey"
            pattern="[a-z][a-z0-9_]{0,79}"
            required
          />
        </label>
        <label>
          Publication state
          <select defaultValue={material?.publication_state ?? "draft"} name="publicationState">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label className="field-full">
          Title
          <input defaultValue={material?.title ?? ""} maxLength={160} name="title" required />
        </label>
        <label className="field-full">
          Short summary
          <textarea
            defaultValue={material?.summary ?? ""}
            minLength={1}
            maxLength={500}
            name="summary"
            required
            rows={3}
          />
        </label>
        <label>
          Sector
          <select defaultValue={material?.sector ?? "professional_services"} name="sector">
            {Object.entries(groupMockSectors).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Exercise type
          <select defaultValue={material?.exercise_type ?? "prioritisation"} name="exerciseType">
            {Object.entries(groupMockExerciseTypes).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Problem type
          <select defaultValue={material?.problem_type ?? "revenue_growth"} name="problemType">
            {Object.entries(groupMockProblemTypes).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Difficulty
          <select defaultValue={material?.difficulty ?? "standard"} name="difficulty">
            {Object.entries(groupMockDifficulties).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Recommended group size
          <input
            defaultValue={material?.recommended_group_size ?? 5}
            max={8}
            min={3}
            name="recommendedGroupSize"
            required
            type="number"
          />
        </label>
        <label>
          Preparation minutes
          <input
            defaultValue={material?.preparation_minutes ?? 10}
            max={90}
            min={0}
            name="preparationMinutes"
            required
            type="number"
          />
        </label>
        <label>
          Discussion minutes
          <input
            defaultValue={material?.discussion_minutes ?? 40}
            max={120}
            min={15}
            name="discussionMinutes"
            required
            type="number"
          />
        </label>
        <label>
          Follow-up minutes
          <input
            defaultValue={material?.follow_up_minutes ?? 10}
            max={60}
            min={0}
            name="followUpMinutes"
            required
            type="number"
          />
        </label>
        <label className="field-full">
          Skills
          <span className="field-help">Enter 2–8 comma-separated capability tags.</span>
          <input
            defaultValue={
              material?.skills.join(", ") ?? "collaboration, structured_reasoning, communication"
            }
            name="skills"
            required
          />
        </label>
        {[
          ["scenario", "Candidate brief and context", material?.scenario, 8, 20, 10000],
          [
            "participantInstructions",
            "Working instructions",
            material?.participant_instructions,
            6,
            20,
            5000,
          ],
          [
            "informationPack",
            "Flexible case pack (Markdown)",
            material?.information_pack,
            12,
            20,
            30000,
          ],
          ["deliverable", "Required output", material?.deliverable, 5, 10, 3000],
          [
            "observerRubric",
            "Facilitator and observer guide",
            material?.observer_rubric,
            8,
            20,
            10000,
          ],
        ].map(([name, label, value, rows, minimum, maximum]) => (
          <label className="field-full" key={String(name)}>
            {label}
            <textarea
              defaultValue={String(value ?? "")}
              maxLength={Number(maximum)}
              minLength={Number(minimum)}
              name={String(name)}
              required
              rows={Number(rows)}
            />
          </label>
        ))}
        <label className="field-full">
          Debrief questions
          <span className="field-help">One question per line; include between 2 and 10.</span>
          <textarea
            defaultValue={material?.debrief_questions.join("\n") ?? ""}
            minLength={5}
            name="debriefQuestions"
            required
            rows={5}
          />
        </label>
      </div>
      <label className="intelligence-confirmation">
        <input name="originalityConfirmed" required type="checkbox" value="yes" />
        <span>
          I confirm this is original OfferLab material and contains no copied assessment, leaked
          question, employer-confidential information or identifying student data.
        </span>
      </label>
      <div className="form-actions">
        <button type="submit">{material ? "Save material" : "Create material"}</button>
      </div>
    </form>
  );
}

export function SessionEditor({
  action,
  materials,
  session,
}: {
  action: FormAction;
  materials: GroupMockMaterialAdminSummary[];
  session?: GroupMockAdminSession;
}) {
  const startDefault = session ? formatLondonDateTimeInput(session.starts_at) : "";
  const endDefault = session ? formatLondonDateTimeInput(session.ends_at) : "";
  return (
    <form action={action} className="cms-editor-card group-mock-admin-form">
      {session && (
        <>
          <input name="id" type="hidden" value={session.id} />
          <input name="version" type="hidden" value={session.version} />
        </>
      )}
      <div className="form-grid">
        <label className="field-full">
          Room title
          <input defaultValue={session?.title ?? ""} maxLength={160} name="title" required />
        </label>
        <label className="field-full">
          Published exercise material
          <select defaultValue={session?.material_id ?? ""} name="materialId" required>
            <option disabled value="">
              Choose material
            </option>
            {materials.map((material) => (
              <option key={material.id} value={material.id}>
                {material.title} ({material.publication_state})
              </option>
            ))}
          </select>
        </label>
        <label>
          Starts (Europe/London)
          <input defaultValue={startDefault} name="startsAt" required type="datetime-local" />
        </label>
        <label>
          Ends (Europe/London)
          <input defaultValue={endDefault} name="endsAt" required type="datetime-local" />
        </label>
        <label>
          Minimum participants
          <input
            defaultValue={session?.minimum_participants ?? 4}
            max={8}
            min={3}
            name="minimumParticipants"
            required
            type="number"
          />
        </label>
        <label>
          Capacity
          <input
            defaultValue={session?.capacity ?? 6}
            max={8}
            min={3}
            name="capacity"
            required
            type="number"
          />
        </label>
        <label>
          Access
          <select defaultValue={session?.access_mode ?? "member_included"} name="accessMode">
            <option value="member_included">Included with membership</option>
            <option value="manual_payment">Manual external payment</option>
          </select>
        </label>
        <label>
          Room state
          <select defaultValue={session?.state ?? "draft"} name="state">
            <option value="draft">Draft</option>
            <option value="open">Open for reservations</option>
            <option value="closed">Reservations closed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <label>
          Price in GBP
          <input
            defaultValue={session?.price_pence ? (session.price_pence / 100).toFixed(2) : ""}
            min="1"
            name="price"
            placeholder="12.00"
            step="0.01"
            type="number"
          />
        </label>
        <label>
          External payment URL
          <input
            defaultValue={session?.payment_url ?? ""}
            name="paymentUrl"
            placeholder="https://"
            type="url"
          />
        </label>
        <label>
          Meeting provider
          <select defaultValue={session?.meeting_provider ?? "zoom"} name="meetingProvider">
            <option value="zoom">Zoom</option>
            <option value="external">Other external provider</option>
          </select>
        </label>
        <label>
          Private meeting URL
          <input
            defaultValue={session?.join_url ?? ""}
            name="meetingUrl"
            placeholder="https://"
            type="url"
          />
        </label>
        <label className="field-full">
          Joining instructions (optional)
          <textarea
            defaultValue={session?.joining_instructions ?? ""}
            maxLength={500}
            name="meetingInstructions"
            rows={3}
          />
        </label>
      </div>
      <p className="cms-safety-note">
        Meeting links are visible only to confirmed participants from 15 minutes before the start
        until the session ends. Never enter a shared host login or password.
      </p>
      <div className="form-actions">
        <button type="submit">{session ? "Save room" : "Create room"}</button>
      </div>
    </form>
  );
}

export function BookingList({ session }: { session: GroupMockAdminSession }) {
  return (
    <div className="group-mock-admin-bookings">
      <h4>Bookings ({session.bookings.length})</h4>
      {session.bookings.map((booking, index) => (
        <form action={updateGroupMockBookingAction} key={booking.id}>
          <input name="bookingId" type="hidden" value={booking.id} />
          <input name="version" type="hidden" value={booking.version} />
          <span>
            Seat {index + 1} · {booking.status.replaceAll("_", " ")}
          </span>
          <select
            aria-label={`Update booking ${index + 1}`}
            name="status"
            defaultValue={
              booking.status === "payment_pending" || booking.status === "waitlisted"
                ? "confirmed"
                : booking.status
            }
          >
            <option value="confirmed">Confirmed</option>
            <option value="attended">Attended</option>
            <option value="no_show">No show</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button className="button-secondary" type="submit">
            Update
          </button>
        </form>
      ))}
      {!session.bookings.length && <p>No bookings yet.</p>}
    </div>
  );
}
