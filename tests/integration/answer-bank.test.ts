import postgres, { type TransactionSql } from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  archiveAnswer,
  archiveStory,
  createAnswer,
  createStory,
  findAnswer,
  findStory,
  listQuestions,
  listAnswers,
  listStories,
  updateAnswer,
  updateStory,
} from "../../src/modules/answer-bank/infrastructure/answer-bank-repository";
const url =
    process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres",
  migration = postgres(url, { max: 2, prepare: false }),
  runtimeUrl = new URL(url);
runtimeUrl.username = "offerlab_runtime_login";
runtimeUrl.password = "postgres";
const runtime = postgres(runtimeUrl.toString(), { max: 2, prepare: false });
const one = "20000000-0000-4000-8000-000000000001",
  two = "20000000-0000-4000-8000-000000000002";
const questionKey = "integration_answer_bank_teamwork",
  questionFamily = "competency_and_behavioural" as const;
let questionId = "";
async function as<T>(owner: string, fn: (db: TransactionSql) => PromiseLike<T>) {
  return runtime.begin(async (db) => {
    await db`set local role offerlab_app`;
    await db`select set_config('app.current_user_id',${owner},true)`;
    return fn(db);
  }) as Promise<T>;
}
const story = {
  title: "Leading a society project",
  experienceType: "society" as const,
  situation: "A deadline moved forward.",
  task: "Deliver the event safely.",
  actions: "I replanned the work and assigned clear owners.",
  reasoning: "I prioritised the critical path.",
  result: "We delivered on time.",
  reflection: "I would surface dependencies earlier.",
  summary: null,
  competencies: ["teamwork", "leadership"] as const,
  ready: true,
};
beforeEach(async () => {
  await migration`delete from app.audit_event where entity_type in ('member_story','member_answer')`;
  await migration`delete from app.answer_coach_comment`;
  await migration`delete from app.answer_coach_review`;
  await migration`delete from app.member_answer_story`;
  await migration`delete from app.member_answer`;
  await migration`delete from app.member_story_competency`;
  await migration`delete from app.member_story`;
  await migration`delete from app.interview_question where stable_key=${questionKey}`;
  questionId = (
    await migration<
      { id: string }[]
    >`insert into app.interview_question(stable_key,question_family,prompt,guidance,position) values(${questionKey},${questionFamily},'Tell me about a time you contributed to a team.','Use a specific example.',900001) returning id`
  )[0]!.id;
  await migration`insert into app.interview_question_stage(question_id,recruitment_stage) values(${questionId}::uuid,'interview')`;
});
afterAll(async () => {
  if (questionId)
    await migration`delete from app.member_answer where question_id=${questionId}::uuid`;
  await migration`delete from app.interview_question where stable_key=${questionKey}`;
  await Promise.all([migration.end(), runtime.end()]);
});
describe("private Answer and Story Bank", () => {
  it("publishes the 14-question founder catalogue in the question-first order", async () => {
    const questions = await as(one, (db) => listQuestions(db, one));
    const catalogue = questions.filter((question) => question.id !== questionId);
    expect(catalogue).toHaveLength(14);
    expect(catalogue.slice(0, 4).map((question) => question.prompt)).toEqual([
      "Tell me about yourself.",
      "Why do you want to work for this organisation?",
      "Why are you interested in this role?",
      "Why should we select you?",
    ]);
    expect(
      catalogue.filter((question) => question.family === "competency_and_behavioural"),
    ).toHaveLength(10);
  });

  it("marks a competency answer ready without requiring a separate story", async () => {
    const answer = await as(one, (db) =>
      createAnswer(db, one, {
        applicationId: null,
        customQuestion: null,
        draftAnswer:
          "I clarified the deadline, assigned owners and checked progress. We submitted on time.",
        keyPoints: "",
        questionFamily,
        questionId,
        ready: true,
        recruitmentStage: null,
        storyIds: [],
        title: "Teamwork question",
      }),
    );
    expect(answer).toMatchObject({ ready: true, storyIds: [] });
    expect(await as(two, (db) => findAnswer(db, two, answer.id))).toBeNull();
  });

  it("creates, updates, maps competencies, archives and restores a story with safe audit", async () => {
    const made = await as(one, (db) => createStory(db, one, story));
    expect(made).toMatchObject({
      ready: true,
      version: 2,
      competencies: ["teamwork", "leadership"],
    });
    const changed = await as(one, (db) =>
      updateStory(db, one, made.id, 2, { ...story, competencies: ["problem_solving"] }),
    );
    expect(changed).toMatchObject({
      outcome: "changed",
      item: { version: 3, competencies: ["problem_solving"] },
    });
    expect(
      await as(one, (db) =>
        updateStory(db, one, made.id, 3, { ...story, competencies: ["problem_solving"] }),
      ),
    ).toMatchObject({ outcome: "unchanged", item: { version: 3 } });
    expect(await as(two, (db) => findStory(db, two, made.id))).toBeNull();
    expect(await as(one, (db) => archiveStory(db, one, made.id, 3, true))).toMatchObject({
      item: { version: 4 },
    });
    expect(await as(one, (db) => listStories(db, one, false))).toEqual([]);
    expect(await as(one, (db) => listStories(db, one, true))).toHaveLength(1);
    expect(await as(one, (db) => archiveStory(db, one, made.id, 4, false))).toMatchObject({
      item: { version: 5 },
    });
    expect(await as(one, (db) => listStories(db, one, false))).toHaveLength(1);
    const audits = await migration<
      { metadata: object }[]
    >`select metadata from app.audit_event where entity_type='member_story'`;
    expect(audits.every((x) => JSON.stringify(x.metadata) === "{}")).toBe(true);
  });
  it("creates canonical and custom answers, reuses ordered stories, and rejects cross-owner application links", async () => {
    const first = await as(one, (db) => createStory(db, one, story)),
      second = await as(one, (db) => createStory(db, one, { ...story, title: "Another example" }));
    const questions = await as(one, (db) => listQuestions(db, one));
    expect(questions).toContainEqual(
      expect.objectContaining({ id: questionId, family: questionFamily, stages: ["interview"] }),
    );
    const answer = await as(one, (db) =>
      createAnswer(db, one, {
        questionId,
        customQuestion: null,
        questionFamily,
        title: "Teamwork",
        keyPoints: "My contribution",
        draftAnswer: "A concise answer",
        applicationId: null,
        recruitmentStage: "interview",
        storyIds: [first.id, second.id],
        ready: true,
      }),
    );
    expect(answer.storyIds).toEqual([first.id, second.id]);
    const reordered = await as(one, (db) =>
      updateAnswer(db, one, answer.id, 2, { ...answer, storyIds: [second.id, first.id] }),
    );
    expect(reordered).toMatchObject({ item: { version: 3, storyIds: [second.id, first.id] } });
    const reloaded = await as(one, (db) => findAnswer(db, one, answer.id));
    expect(reloaded?.storyIds).toEqual([second.id, first.id]);
    const unchanged = await as(one, (db) =>
      updateAnswer(db, one, answer.id, 3, { ...answer, storyIds: [second.id, first.id] }),
    );
    expect(unchanged).toMatchObject({
      outcome: "unchanged",
      item: { version: 3, updatedAt: reloaded?.updatedAt },
    });
    await expect(
      as(one, (db) =>
        updateAnswer(db, one, answer.id, 2, { ...answer, storyIds: [first.id, second.id] }),
      ),
    ).resolves.toEqual({ outcome: "conflict" });
    expect(await as(two, (db) => findAnswer(db, two, answer.id))).toBeNull();
    const foreignApp = (
      await migration<
        { id: string }[]
      >`select id from app.application where owner_user_id=${two}::uuid limit 1`
    )[0];
    if (foreignApp)
      await expect(
        as(one, (db) =>
          createAnswer(db, one, {
            ...answer,
            questionId: null,
            customQuestion: "Custom?",
            applicationId: foreignApp.id,
            storyIds: [],
          }),
        ),
      ).rejects.toThrow();
    expect(await as(one, (db) => archiveAnswer(db, one, answer.id, 3, true))).toMatchObject({
      item: { version: 4 },
    });
    expect(await as(one, (db) => listAnswers(db, one, false))).toEqual([]);
    expect(await as(one, (db) => listAnswers(db, one, true))).toHaveLength(1);
    expect(await as(one, (db) => archiveAnswer(db, one, answer.id, 4, false))).toMatchObject({
      item: { version: 5, archivedAt: null },
    });
    expect(await as(one, (db) => listAnswers(db, one, false))).toHaveLength(1);
  });
  it("forces RLS and keeps identity-sync credentials away from private tables", async () => {
    const rows = await migration<
      { relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }[]
    >`select relname,relrowsecurity,relforcerowsecurity from pg_class where oid in ('app.member_story'::regclass,'app.member_story_competency'::regclass,'app.member_answer'::regclass,'app.member_answer_story'::regclass)`;
    expect(rows).toHaveLength(4);
    expect(rows.every((x) => x.relrowsecurity && x.relforcerowsecurity)).toBe(true);
    const privilege = await migration<
      { allowed: boolean }[]
    >`select has_table_privilege('offerlab_identity_sync','app.member_story','select') allowed`;
    expect(privilege[0]?.allowed).toBe(false);
  });
});
