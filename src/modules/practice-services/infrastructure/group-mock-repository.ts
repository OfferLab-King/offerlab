import type { TransactionSql } from "postgres";

import type {
  groupMockExerciseTypes,
  groupMockProblemTypes,
  groupMockSectors,
} from "../domain/group-mock";
import { groupMockRulesVersion } from "../domain/group-mock";

export type GroupMockBookingStatus =
  "payment_pending" | "confirmed" | "waitlisted" | "cancelled" | "attended" | "no_show";

type LobbyRow = Readonly<{
  access_mode: "member_included" | "manual_payment";
  booking_id: string | null;
  booking_status: GroupMockBookingStatus | null;
  booking_version: number | null;
  capacity: number;
  confirmed_count: number | string;
  difficulty: "introductory" | "standard" | "advanced";
  ends_at: string;
  exercise_type: keyof typeof groupMockExerciseTypes;
  id: string;
  join_url: string | null;
  material_id: string;
  material_summary: string;
  minimum_participants: number;
  payment_url: string | null;
  price_pence: number | null;
  recommended_minutes: number;
  sector: keyof typeof groupMockSectors;
  starts_at: string;
  state: "open" | "closed" | "completed";
  title: string;
  waiting_count: number | string;
}>;

export type GroupMockLobbySession = Readonly<{
  accessMode: LobbyRow["access_mode"];
  bookingId: string | null;
  bookingStatus: GroupMockBookingStatus | null;
  bookingVersion: number | null;
  capacity: number;
  confirmedCount: number;
  difficulty: LobbyRow["difficulty"];
  endsAt: string;
  exerciseType: LobbyRow["exercise_type"];
  id: string;
  joinUrl: string | null;
  materialId: string;
  materialSummary: string;
  minimumParticipants: number;
  paymentUrl: string | null;
  pricePence: number | null;
  recommendedMinutes: number;
  sector: LobbyRow["sector"];
  startsAt: string;
  state: LobbyRow["state"];
  title: string;
  waitingCount: number;
}>;

const lobbySession = (row: LobbyRow): GroupMockLobbySession => ({
  accessMode: row.access_mode,
  bookingId: row.booking_id,
  bookingStatus: row.booking_status,
  bookingVersion: row.booking_version,
  capacity: row.capacity,
  confirmedCount: Number(row.confirmed_count),
  difficulty: row.difficulty,
  endsAt: row.ends_at,
  exerciseType: row.exercise_type,
  id: row.id,
  joinUrl: row.join_url,
  materialId: row.material_id,
  materialSummary: row.material_summary,
  minimumParticipants: row.minimum_participants,
  paymentUrl: row.payment_url,
  pricePence: row.price_pence,
  recommendedMinutes: row.recommended_minutes,
  sector: row.sector,
  startsAt: row.starts_at,
  state: row.state,
  title: row.title,
  waitingCount: Number(row.waiting_count),
});

export async function listLobbySessions(db: TransactionSql, owner: string) {
  const rows = await db<LobbyRow[]>`
    select s.id,s.material_id,s.title,s.starts_at,s.ends_at,s.minimum_participants,s.capacity,
      s.access_mode,s.price_pence,s.payment_url,s.state,m.summary material_summary,m.sector,
      m.exercise_type,m.difficulty,m.recommended_minutes,b.id booking_id,b.status booking_status,
      b.version booking_version,meeting.join_url,counts.confirmed_count,counts.waiting_count
    from app.group_mock_session s
    join app.group_mock_material m on m.id=s.material_id and m.publication_state='published'
    cross join lateral app.group_mock_session_counts(s.id) counts
    left join app.group_mock_booking b on b.session_id=s.id and b.owner_user_id=${owner}::uuid
    left join app.group_mock_session_meeting meeting on meeting.session_id=s.id
    where s.state in ('open','closed','completed') and (s.ends_at>now()-interval '30 days' or b.id is not null)
    order by case when s.ends_at>now() then 0 else 1 end,s.starts_at,s.id`;
  return rows.map(lobbySession);
}

export type MaterialDetailRow = Readonly<{
  debrief_questions: string[];
  deliverable: string;
  difficulty: LobbyRow["difficulty"];
  discussion_minutes: number;
  exercise_type: LobbyRow["exercise_type"];
  follow_up_minutes: number;
  id: string;
  information_pack: string;
  observer_rubric: string;
  participant_instructions: string;
  preparation_minutes: number;
  problem_type: keyof typeof groupMockProblemTypes;
  recommended_group_size: number;
  recommended_minutes: number;
  scenario: string;
  sector: LobbyRow["sector"];
  skills: string[];
  summary: string;
  title: string;
}>;

export type GroupMockMaterialSummary = Pick<
  MaterialDetailRow,
  | "difficulty"
  | "discussion_minutes"
  | "exercise_type"
  | "follow_up_minutes"
  | "id"
  | "preparation_minutes"
  | "problem_type"
  | "recommended_group_size"
  | "recommended_minutes"
  | "sector"
  | "skills"
  | "summary"
  | "title"
>;

export async function readBookedSession(db: TransactionSql, owner: string, sessionId: string) {
  const sessions = await db<LobbyRow[]>`
    select s.id,s.material_id,s.title,s.starts_at,s.ends_at,s.minimum_participants,s.capacity,
      s.access_mode,s.price_pence,s.payment_url,s.state,m.summary material_summary,m.sector,
      m.exercise_type,m.difficulty,m.recommended_minutes,b.id booking_id,b.status booking_status,
      b.version booking_version,meeting.join_url,counts.confirmed_count,counts.waiting_count
    from app.group_mock_session s join app.group_mock_material m on m.id=s.material_id
    cross join lateral app.group_mock_session_counts(s.id) counts
    join app.group_mock_booking b on b.session_id=s.id and b.owner_user_id=${owner}::uuid
    left join app.group_mock_session_meeting meeting on meeting.session_id=s.id
    where s.id=${sessionId}::uuid`;
  const session = sessions[0];
  if (!session) return null;
  const details =
    session.booking_status === "confirmed" || session.booking_status === "attended"
      ? await db<MaterialDetailRow[]>`
          select m.id,m.title,m.summary,m.sector,m.exercise_type,m.difficulty,m.recommended_minutes,
            m.problem_type,m.skills,m.recommended_group_size,m.preparation_minutes,m.discussion_minutes,m.follow_up_minutes,
            m.scenario,m.participant_instructions,m.information_pack,m.deliverable,m.observer_rubric,m.debrief_questions
          from app.group_mock_material m where m.id=${session.material_id}::uuid and m.publication_state='published'`
      : [];
  return { material: details[0] ?? null, session: lobbySession(session) };
}

export async function createBooking(db: TransactionSql, owner: string, sessionId: string) {
  await db`select pg_advisory_xact_lock(hashtext(${`group-mock:${sessionId}`}))`;
  const existing = await db<
    { id: string; status: GroupMockBookingStatus; version: number }[]
  >`select id,status,version from app.group_mock_booking where owner_user_id=${owner}::uuid and session_id=${sessionId}::uuid`;
  if (existing[0] && existing[0].status !== "cancelled")
    return { outcome: "unchanged", status: existing[0].status } as const;
  const rows = existing[0]
    ? await db<{ id: string; status: GroupMockBookingStatus }[]>`
        update app.group_mock_booking set status='waitlisted' where id=${existing[0].id}::uuid
        returning id,status`
    : await db<{ id: string; status: GroupMockBookingStatus }[]>`
        insert into app.group_mock_booking(session_id,owner_user_id,status,age_eligibility_confirmed_at,participation_rules_version)
        values(${sessionId}::uuid,${owner}::uuid,'waitlisted',now(),${groupMockRulesVersion}) returning id,status`;
  if (!rows[0]) return { outcome: "not_found" } as const;
  await db`insert into app.audit_event(actor_user_id,action,entity_type,entity_id,metadata)
    values(${owner}::uuid,'group_mock.booking_created','group_mock_booking',${rows[0].id}::uuid,'{}'::jsonb)`;
  return { outcome: "changed", status: rows[0].status } as const;
}

export async function cancelBooking(
  db: TransactionSql,
  owner: string,
  bookingId: string,
  expectedVersion: number,
) {
  const rows = await db<{ id: string }[]>`
    update app.group_mock_booking set status='cancelled'
    where id=${bookingId}::uuid and owner_user_id=${owner}::uuid and version=${expectedVersion}
      and status in ('payment_pending','confirmed','waitlisted') returning id`;
  if (!rows[0]) return { outcome: "conflict" } as const;
  await db`insert into app.audit_event(actor_user_id,action,entity_type,entity_id,metadata)
    values(${owner}::uuid,'group_mock.booking_cancelled','group_mock_booking',${bookingId}::uuid,'{}'::jsonb)`;
  return { outcome: "changed" } as const;
}

export type GroupMockMaterialAdmin = MaterialDetailRow &
  Readonly<{
    publication_state: "draft" | "published" | "archived";
    stable_key: string;
    version: number;
  }>;

export type GroupMockMaterialAdminSummary = GroupMockMaterialSummary &
  Pick<GroupMockMaterialAdmin, "publication_state" | "stable_key" | "version">;

export async function listMaterialsForAdmin(db: TransactionSql) {
  return db<GroupMockMaterialAdminSummary[]>`
    select id,stable_key,title,summary,sector,exercise_type,difficulty,recommended_minutes,
      problem_type,skills,recommended_group_size,preparation_minutes,discussion_minutes,follow_up_minutes,
      publication_state,version from app.group_mock_material order by created_at desc,id`;
}

export async function listPublishedMaterials(db: TransactionSql) {
  return db<GroupMockMaterialSummary[]>`
    select id,title,summary,sector,exercise_type,difficulty,recommended_minutes,problem_type,skills,
      recommended_group_size,preparation_minutes,discussion_minutes,follow_up_minutes
    from app.group_mock_material where publication_state='published'
    order by title,id`;
}

export async function readMaterialForAdmin(db: TransactionSql, materialId: string) {
  const rows = await db<GroupMockMaterialAdmin[]>`
    select id,stable_key,title,summary,sector,exercise_type,difficulty,recommended_minutes,
      problem_type,skills,recommended_group_size,preparation_minutes,discussion_minutes,follow_up_minutes,
      scenario,participant_instructions,information_pack,deliverable,observer_rubric,debrief_questions,
      publication_state,version from app.group_mock_material where id=${materialId}::uuid`;
  return rows[0] ?? null;
}

export async function readPublishedMaterial(db: TransactionSql, materialId: string) {
  const rows = await db<MaterialDetailRow[]>`
    select id,title,summary,sector,exercise_type,difficulty,recommended_minutes,problem_type,skills,
      recommended_group_size,preparation_minutes,discussion_minutes,follow_up_minutes,scenario,
      participant_instructions,information_pack,deliverable,observer_rubric,debrief_questions
    from app.group_mock_material where id=${materialId}::uuid and publication_state='published'`;
  return rows[0] ?? null;
}

type MaterialInput = Omit<GroupMockMaterialAdmin, "id" | "publication_state" | "version"> & {
  publicationState: GroupMockMaterialAdmin["publication_state"];
};

export async function createMaterial(
  db: TransactionSql,
  administrator: string,
  input: MaterialInput,
) {
  const rows = await db<{ id: string }[]>`
    insert into app.group_mock_material(stable_key,title,summary,sector,exercise_type,difficulty,
      recommended_minutes,scenario,participant_instructions,information_pack,deliverable,
      observer_rubric,debrief_questions,publication_state,originality_confirmed_at,originality_confirmed_by_user_id,
      problem_type,skills,recommended_group_size,preparation_minutes,discussion_minutes,follow_up_minutes)
    values(${input.stable_key},${input.title},${input.summary},${input.sector},${input.exercise_type},
      ${input.difficulty},${input.recommended_minutes},${input.scenario},${input.participant_instructions},
      ${input.information_pack},${input.deliverable},${input.observer_rubric},${input.debrief_questions},
      ${input.publicationState},now(),${administrator}::uuid,${input.problem_type},${input.skills},
      ${input.recommended_group_size},${input.preparation_minutes},${input.discussion_minutes},${input.follow_up_minutes}) returning id`;
  await db`insert into app.audit_event(actor_user_id,action,entity_type,entity_id,metadata)
    values(${administrator}::uuid,'group_mock.material_created','group_mock_material',${rows[0]!.id}::uuid,'{}'::jsonb)`;
  return rows[0]!.id;
}

export async function updateMaterial(
  db: TransactionSql,
  administrator: string,
  id: string,
  expectedVersion: number,
  input: MaterialInput,
) {
  const rows = await db<{ id: string }[]>`
    update app.group_mock_material set stable_key=${input.stable_key},title=${input.title},summary=${input.summary},
      sector=${input.sector},exercise_type=${input.exercise_type},difficulty=${input.difficulty},
      recommended_minutes=${input.recommended_minutes},scenario=${input.scenario},
      participant_instructions=${input.participant_instructions},information_pack=${input.information_pack},
      deliverable=${input.deliverable},observer_rubric=${input.observer_rubric},
      debrief_questions=${input.debrief_questions},publication_state=${input.publicationState},
      problem_type=${input.problem_type},skills=${input.skills},recommended_group_size=${input.recommended_group_size},
      preparation_minutes=${input.preparation_minutes},discussion_minutes=${input.discussion_minutes},
      follow_up_minutes=${input.follow_up_minutes},
      originality_confirmed_at=now(),originality_confirmed_by_user_id=${administrator}::uuid
    where id=${id}::uuid and version=${expectedVersion} returning id`;
  if (!rows[0]) return { outcome: "conflict" } as const;
  await db`insert into app.audit_event(actor_user_id,action,entity_type,entity_id,metadata)
    values(${administrator}::uuid,'group_mock.material_updated','group_mock_material',${id}::uuid,'{}'::jsonb)`;
  return { outcome: "changed" } as const;
}

export type GroupMockAdminSession = Readonly<{
  access_mode: "member_included" | "manual_payment";
  bookings: ReadonlyArray<{
    id: string;
    status: GroupMockBookingStatus;
    version: number;
  }>;
  capacity: number;
  ends_at: string;
  id: string;
  join_url: string | null;
  joining_instructions: string | null;
  material_id: string;
  material_title: string;
  meeting_provider: "zoom" | "external" | null;
  minimum_participants: number;
  payment_url: string | null;
  price_pence: number | null;
  starts_at: string;
  state: "draft" | "open" | "closed" | "completed" | "cancelled";
  title: string;
  version: number;
}>;

export async function listSessionsForAdmin(db: TransactionSql) {
  return db<GroupMockAdminSession[]>`
    select s.id,s.material_id,s.title,s.starts_at,s.ends_at,s.minimum_participants,s.capacity,
      s.access_mode,s.price_pence,s.payment_url,s.state,s.version,m.title material_title,
      meeting.provider meeting_provider,meeting.join_url,meeting.joining_instructions,
      coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'status',b.status,'version',b.version)
        order by b.created_at,b.id) from app.group_mock_booking b where b.session_id=s.id),'[]'::jsonb) bookings
    from app.group_mock_session s join app.group_mock_material m on m.id=s.material_id
    left join app.group_mock_session_meeting meeting on meeting.session_id=s.id
    order by s.starts_at desc,s.id`;
}

type SessionInput = Readonly<{
  accessMode: "member_included" | "manual_payment";
  capacity: number;
  endsAt: Date;
  materialId: string;
  meetingInstructions: string | null;
  meetingProvider: "zoom" | "external" | null;
  meetingUrl: string | null;
  minimumParticipants: number;
  paymentUrl: string | null;
  pricePence: number | null;
  startsAt: Date;
  state: "draft" | "open" | "closed" | "completed" | "cancelled";
  title: string;
}>;

async function upsertMeeting(db: TransactionSql, sessionId: string, input: SessionInput) {
  if (!input.meetingProvider || !input.meetingUrl) {
    await db`delete from app.group_mock_session_meeting where session_id=${sessionId}::uuid`;
    return;
  }
  await db`insert into app.group_mock_session_meeting(session_id,provider,join_url,joining_instructions)
    values(${sessionId}::uuid,${input.meetingProvider},${input.meetingUrl},${input.meetingInstructions})
    on conflict(session_id) do update set provider=excluded.provider,join_url=excluded.join_url,
      joining_instructions=excluded.joining_instructions`;
}

export async function createSession(
  db: TransactionSql,
  administrator: string,
  input: SessionInput,
) {
  const rows = await db<{ id: string }[]>`
    insert into app.group_mock_session(material_id,title,starts_at,ends_at,minimum_participants,capacity,
      access_mode,price_pence,payment_url,state)
    select id,${input.title},${input.startsAt},${input.endsAt},${input.minimumParticipants},${input.capacity},
      ${input.accessMode},${input.pricePence},${input.paymentUrl},${input.state}
    from app.group_mock_material where id=${input.materialId}::uuid and
      (${input.state}<>'open' or publication_state='published') returning id`;
  if (!rows[0]) return { outcome: "invalid" } as const;
  await upsertMeeting(db, rows[0].id, input);
  await db`insert into app.audit_event(actor_user_id,action,entity_type,entity_id,metadata)
    values(${administrator}::uuid,'group_mock.session_created','group_mock_session',${rows[0].id}::uuid,'{}'::jsonb)`;
  return { id: rows[0].id, outcome: "changed" } as const;
}

export async function updateSession(
  db: TransactionSql,
  administrator: string,
  id: string,
  expectedVersion: number,
  input: SessionInput,
) {
  const rows = await db<{ id: string }[]>`
    update app.group_mock_session s set material_id=${input.materialId}::uuid,title=${input.title},
      starts_at=${input.startsAt},ends_at=${input.endsAt},minimum_participants=${input.minimumParticipants},
      capacity=${input.capacity},access_mode=${input.accessMode},price_pence=${input.pricePence},
      payment_url=${input.paymentUrl},state=${input.state}
    where s.id=${id}::uuid and s.version=${expectedVersion} and
      (${input.state}<>'open' or exists(select 1 from app.group_mock_material m where m.id=${input.materialId}::uuid and m.publication_state='published'))
    returning id`;
  if (!rows[0]) return { outcome: "conflict" } as const;
  await upsertMeeting(db, id, input);
  await db`insert into app.audit_event(actor_user_id,action,entity_type,entity_id,metadata)
    values(${administrator}::uuid,'group_mock.session_updated','group_mock_session',${id}::uuid,'{}'::jsonb)`;
  return { outcome: "changed" } as const;
}

export async function updateBookingForAdmin(
  db: TransactionSql,
  administrator: string,
  bookingId: string,
  expectedVersion: number,
  status: "confirmed" | "cancelled" | "attended" | "no_show",
) {
  const rows = await db<{ id: string }[]>`
    update app.group_mock_booking b set status=${status}
    from app.group_mock_session s
    where b.id=${bookingId}::uuid and b.version=${expectedVersion}
      and b.session_id=s.id
      and (
        ${status} <> 'confirmed'
        or (
          select count(*) from app.group_mock_booking x
          where x.session_id=b.session_id and x.status='confirmed' and x.id<>b.id
        ) < s.capacity
      )
    returning b.id`;
  if (!rows[0]) return { outcome: "capacity_or_conflict" } as const;
  await db`insert into app.audit_event(actor_user_id,action,entity_type,entity_id,metadata)
    values(${administrator}::uuid,'group_mock.booking_updated','group_mock_booking',${bookingId}::uuid,'{}'::jsonb)`;
  return { outcome: "changed" } as const;
}
