import postgres, { type TransactionSql } from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  cancelBooking,
  createBooking,
  createMaterial,
  createSession,
  listLobbySessions,
  listPublishedMaterials,
  readBookedSession,
} from "../../src/modules/practice-services/infrastructure/group-mock-repository";

const url =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const migration = postgres(url, { max: 2, prepare: false });
const runtimeUrl = new URL(url);
runtimeUrl.username = "offerlab_runtime_login";
runtimeUrl.password = "postgres";
const runtime = postgres(runtimeUrl.toString(), { max: 4, prepare: false });

const administrator = "20000000-0000-4000-8000-000000000001";
const members = [
  "20000000-0000-4000-8000-000000000002",
  "41000000-0000-4000-8000-000000000002",
  "41000000-0000-4000-8000-000000000003",
  "41000000-0000-4000-8000-000000000004",
] as const;
const extraAuthUsers = [
  "42000000-0000-4000-8000-000000000002",
  "42000000-0000-4000-8000-000000000003",
  "42000000-0000-4000-8000-000000000004",
] as const;

async function as<T>(owner: string, operation: (database: TransactionSql) => PromiseLike<T>) {
  return runtime.begin(async (database) => {
    await database`set local role offerlab_app`;
    await database`select set_config('app.current_user_id',${owner},true)`;
    return operation(database);
  }) as Promise<T>;
}

const materialInput = {
  debrief_questions: ["What supported the decision?", "What would you do differently?"],
  deliverable: "Present one recommendation and explain the most important trade-off.",
  difficulty: "standard" as const,
  discussion_minutes: 40,
  exercise_type: "prioritisation" as const,
  follow_up_minutes: 10,
  information_pack: "Three fictional community projects have different costs, risks and reach.",
  observer_rubric: "Look for inclusive contributions, explicit criteria and clear time management.",
  participant_instructions: "Read independently, discuss the options and agree one recommendation.",
  preparation_minutes: 10,
  problem_type: "capital_allocation" as const,
  publicationState: "published" as const,
  recommended_group_size: 5,
  recommended_minutes: 60,
  scenario: "A fictional charity must choose one community project for limited annual funding.",
  sector: "retail_consumer" as const,
  skills: ["collaboration", "prioritisation", "ethical_judgement"],
  stable_key: "integration_priority_case",
  summary: "A synthetic group prioritisation exercise.",
  title: "Community funding priorities",
};

let materialId = "";
let sessionId = "";

beforeAll(async () => {
  await migration`update app."user" set role='administrator' where id=${administrator}::uuid`;
  for (let index = 0; index < extraAuthUsers.length; index += 1) {
    const authId = extraAuthUsers[index]!;
    const userId = members[index + 1]!;
    const email = `group-mock-${index + 2}@test.offerlab.invalid`;
    await migration`insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
      raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token)
      values('00000000-0000-0000-0000-000000000000',${authId}::uuid,'authenticated','authenticated',${email},'',now(),
      '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','') on conflict(id) do nothing`;
    await migration`insert into app."user"(id,auth_user_id,email) values(${userId}::uuid,${authId}::uuid,${email})
      on conflict(id) do nothing`;
  }
});

beforeEach(async () => {
  await migration`delete from app.audit_event where entity_type like 'group_mock_%'`;
  await migration`delete from app.group_mock_session_meeting`;
  await migration`delete from app.group_mock_booking`;
  await migration`delete from app.group_mock_session`;
  await migration`delete from app.group_mock_material where stable_key='integration_priority_case'`;
  materialId = await as(administrator, (database) =>
    createMaterial(database, administrator, materialInput),
  );
  const result = await as(administrator, (database) =>
    createSession(database, administrator, {
      accessMode: "member_included",
      capacity: 3,
      endsAt: new Date("2099-08-10T19:00:00.000Z"),
      materialId,
      meetingInstructions: "Use your first name only.",
      meetingProvider: "external",
      meetingUrl: "https://meet.example.test/group-mock",
      minimumParticipants: 3,
      paymentUrl: null,
      pricePence: null,
      startsAt: new Date("2099-08-10T18:00:00.000Z"),
      state: "open",
      title: "Integration group mock",
    }),
  );
  if (result.outcome !== "changed") throw new Error("Session fixture was not created.");
  sessionId = result.id;
});

afterAll(async () => {
  await migration`delete from app.audit_event where entity_type like 'group_mock_%'`;
  await migration`delete from app.group_mock_session_meeting`;
  await migration`delete from app.group_mock_booking`;
  await migration`delete from app.group_mock_session`;
  await migration`delete from app.group_mock_material where stable_key='integration_priority_case'`;
  await migration`delete from app."user" where id in (${members[1]}::uuid,${members[2]}::uuid,${members[3]}::uuid)`;
  await migration`delete from auth.users where id in (${extraAuthUsers[0]}::uuid,${extraAuthUsers[1]}::uuid,${extraAuthUsers[2]}::uuid)`;
  await migration`update app."user" set role='member' where id=${administrator}::uuid`;
  await Promise.all([migration.end(), runtime.end()]);
});

describe("Group Mock PostgreSQL boundaries", () => {
  it("provides exactly 100 original synthetic cases with broad industry and problem coverage", async () => {
    const rows = await migration<{ cases: number; industries: number; problems: number }[]>`
      select count(*)::int cases,count(distinct sector)::int industries,count(distinct problem_type)::int problems
      from app.group_mock_material where stable_key like 'library\_%' escape '\\'`;
    expect(rows[0]).toEqual({ cases: 100, industries: 10, problems: 10 });
    const library = await as(members[0], (database) => listPublishedMaterials(database));
    expect(library.filter((item) => item.title.includes(":"))).toHaveLength(100);
  });

  it("includes a professional flagship case with substantial evidence and facilitator guidance", async () => {
    const rows = await migration<
      {
        debrief_count: number;
        information_length: number;
        observer_length: number;
        title: string;
      }[]
    >`
      select title,length(information_pack)::int information_length,
        length(observer_rubric)::int observer_length,cardinality(debrief_questions)::int debrief_count
      from app.group_mock_material where stable_key='library_02_revenue_growth'`;
    expect(rows[0]).toEqual({
      debrief_count: 7,
      information_length: expect.any(Number),
      observer_length: expect.any(Number),
      title: "Lumen Bank: profitable growth under pressure",
    });
    expect(rows[0]!.information_length).toBeGreaterThan(5_000);
    expect(rows[0]!.observer_length).toBeGreaterThan(2_000);
  });

  it("assigns seats atomically, exposes aggregate occupancy and promotes the waitlist", async () => {
    for (const member of members) {
      await expect(
        as(member, (database) => createBooking(database, member, sessionId)),
      ).resolves.toEqual(expect.objectContaining({ outcome: "changed" }));
    }
    const lobby = await as(members[3], (database) => listLobbySessions(database, members[3]));
    expect(lobby[0]).toMatchObject({
      confirmedCount: 3,
      waitingCount: 1,
      bookingStatus: "waitlisted",
    });

    const first = (await as(members[0], (database) => listLobbySessions(database, members[0])))[0]!;
    await expect(
      as(members[0], (database) =>
        cancelBooking(database, members[0], first.bookingId!, first.bookingVersion!),
      ),
    ).resolves.toEqual({ outcome: "changed" });
    const promoted = await as(members[3], (database) => listLobbySessions(database, members[3]));
    expect(promoted[0]).toMatchObject({
      confirmedCount: 3,
      waitingCount: 0,
      bookingStatus: "confirmed",
    });
  });

  it("protects full material and the meeting link until booking and join-window rules permit access", async () => {
    const unbooked = await as(members[1], (database) =>
      readBookedSession(database, members[1], sessionId),
    );
    expect(unbooked).toBeNull();
    await as(members[0], (database) => createBooking(database, members[0], sessionId));
    const booked = await as(members[0], (database) =>
      readBookedSession(database, members[0], sessionId),
    );
    expect(booked?.material?.title).toBe("Community funding priorities");
    expect(booked?.session.joinUrl).toBeNull();
  });

  it("forces RLS on every member-facing room table", async () => {
    const rows = await migration<{ relforcerowsecurity: boolean; relrowsecurity: boolean }[]>`
      select relrowsecurity,relforcerowsecurity from pg_class where oid in
      ('app.group_mock_material'::regclass,'app.group_mock_session'::regclass,
       'app.group_mock_booking'::regclass,'app.group_mock_session_meeting'::regclass)`;
    expect(rows).toHaveLength(4);
    expect(rows.every((row) => row.relrowsecurity && row.relforcerowsecurity)).toBe(true);
  });
});
