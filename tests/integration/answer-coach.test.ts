import postgres, { type TransactionSql } from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  assertUsageAllowed,
  listReviews,
  saveReview,
  setCommentState,
} from "../../src/modules/answer-coach/infrastructure/review-repository";

const url =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const admin = postgres(url, { prepare: false });
const runtimeUrl = new URL(url);
runtimeUrl.username = "offerlab_runtime_login";
runtimeUrl.password = "postgres";
const runtime = postgres(runtimeUrl.toString(), { prepare: false });
const one = "20000000-0000-4000-8000-000000000001",
  two = "20000000-0000-4000-8000-000000000002";
let answerId = "";
async function as<T>(owner: string, fn: (db: TransactionSql) => PromiseLike<T>) {
  return runtime.begin(async (db) => {
    await db`set local role offerlab_app`;
    await db`select set_config('app.current_user_id',${owner},true)`;
    return fn(db);
  }) as Promise<T>;
}
const output = {
  comments: [
    {
      anchor: { start: 0, end: 12, quote: "I led a team" },
      category: "Evidence" as const,
      coachingQuestion: "What did you personally change?",
      observation: "Make the individual action more specific.",
      optionalRevision: null,
    },
  ],
  followUpQuestions: ["What changed?"],
  strengths: ["Clear first-person opening."],
  suggestedAnswer: "I led the team through a tight deadline.",
  summary: "Add one concrete action.",
  unsupportedClaimsDetected: [],
};

beforeEach(async () => {
  await admin`delete from app.answer_coach_comment`;
  await admin`delete from app.answer_coach_review`;
  await admin`delete from app.member_answer where title='Answer Coach integration fixture'`;
  answerId = (
    await admin<
      { id: string }[]
    >`insert into app.member_answer(owner_user_id,custom_question,question_family,title,draft_answer) values(${one}::uuid,'Tell me about teamwork.','competency_and_behavioural','Answer Coach integration fixture','I led a team through a deadline.') returning id`
  )[0]!.id;
});
afterAll(async () => {
  await admin`delete from app.answer_coach_comment`;
  await admin`delete from app.answer_coach_review`;
  await admin`delete from app.member_answer where title='Answer Coach integration fixture'`;
  await Promise.all([admin.end(), runtime.end()]);
});

describe("Answer Coach PostgreSQL persistence", () => {
  it("persists recoverable reviews and comment state without mutating the answer", async () => {
    const saved = await as(one, async (db) => {
      await assertUsageAllowed(db, one);
      return saveReview(
        db,
        one,
        answerId,
        1,
        "I led a team through a deadline.",
        "local-rubric-v1",
        "local_rubric",
        output,
      );
    });
    expect(saved.comments[0]).toMatchObject({ category: "Evidence", state: "open" });
    await expect(as(two, (db) => listReviews(db, two, answerId))).resolves.toEqual([]);
    await expect(
      as(two, (db) => setCommentState(db, two, answerId, saved.comments[0]!.id, "dismissed")),
    ).resolves.toEqual({ outcome: "not_found" });
    await expect(
      as(one, (db) => setCommentState(db, one, answerId, saved.comments[0]!.id, "addressed")),
    ).resolves.toEqual({ outcome: "changed" });
    expect((await as(one, (db) => listReviews(db, one, answerId)))[0]!.comments[0]!.state).toBe(
      "addressed",
    );
    const [answer] = await admin<
      { draft_answer: string }[]
    >`select draft_answer from app.member_answer where id=${answerId}::uuid`;
    expect(answer?.draft_answer).toBe("I led a team through a deadline.");
  });

  it("forces RLS on both review tables", async () => {
    const rows = await admin<
      { relforcerowsecurity: boolean; relrowsecurity: boolean }[]
    >`select relrowsecurity,relforcerowsecurity from pg_class where oid in ('app.answer_coach_review'::regclass,'app.answer_coach_comment'::regclass)`;
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.relrowsecurity && row.relforcerowsecurity)).toBe(true);
  });

  it("persists model provenance, notice acceptance and content-free operational metadata", async () => {
    const saved = await as(one, (db) =>
      saveReview(
        db,
        one,
        answerId,
        1,
        "I led a team through a deadline.",
        "deepseek-v4-flash",
        "model",
        output,
        {
          modelRequested: true,
          promptVersion: 2,
          providerNoticeVersion: "answer-coach-deepseek-2026-08-06",
          usage: { inputTokens: 120, latencyMs: 350, outputTokens: 42 },
        },
      ),
    );
    expect(saved).toMatchObject({
      modelRequested: true,
      providerId: "deepseek-v4-flash",
      providerMode: "model",
      promptVersion: 2,
      suggestedAnswer: "I led the team through a tight deadline.",
    });
    const [metadata] = await admin<
      {
        input_tokens: number;
        latency_ms: number;
        output_tokens: number;
        provider_notice_version: string;
        prompt_version: number;
        suggested_answer: string | null;
      }[]
    >`select input_tokens,output_tokens,latency_ms,prompt_version,provider_notice_version,suggested_answer from app.answer_coach_review where id=${saved.id}::uuid`;
    expect(metadata).toEqual({
      input_tokens: 120,
      latency_ms: 350,
      output_tokens: 42,
      provider_notice_version: "answer-coach-deepseek-2026-08-06",
      prompt_version: 2,
      suggested_answer: "I led the team through a tight deadline.",
    });
  });
});
