import type { TransactionSql } from "postgres";
import type { AnswerCoachProviderUsage, AnswerCoachReview } from "../domain/review";

export const answerCoachUsageLimits = { monthly: 20, recent: 5 } as const;
export type AnswerCoachUsage = Readonly<{
  monthlyLimit: number;
  monthlyUsed: number;
  recentLimit: number;
  recentUsed: number;
}>;

export type StoredComment = AnswerCoachReview["comments"][number] & {
  id: string;
  state: "open" | "addressed" | "dismissed";
};
export type StoredReview = Omit<AnswerCoachReview, "comments"> & {
  answerSnapshot: string;
  answerVersion: number;
  comments: StoredComment[];
  createdAt: Date;
  id: string;
  modelRequested: boolean;
  promptVersion: number;
  providerId: string;
  providerMode: "local_rubric" | "model";
};

type ReviewRow = {
  answer_snapshot: string;
  answer_version: number;
  created_at: Date;
  follow_up_questions: string[];
  id: string;
  model_requested: boolean;
  prompt_version: number;
  provider_id: string;
  provider_mode: StoredReview["providerMode"];
  strengths: string[];
  suggested_answer: string | null;
  summary: string;
  unsupported_claims: string[];
};
type CommentRow = {
  anchor_end: number;
  anchor_quote: string;
  anchor_start: number;
  category: StoredComment["category"];
  coaching_question: string;
  id: string;
  observation: string;
  optional_revision: string | null;
  state: StoredComment["state"];
};

const mapReview = (row: ReviewRow, comments: CommentRow[]): StoredReview => ({
  answerSnapshot: row.answer_snapshot,
  answerVersion: row.answer_version,
  comments: comments.map((comment) => ({
    anchor: { end: comment.anchor_end, quote: comment.anchor_quote, start: comment.anchor_start },
    category: comment.category,
    coachingQuestion: comment.coaching_question,
    id: comment.id,
    observation: comment.observation,
    optionalRevision: comment.optional_revision,
    state: comment.state,
  })),
  createdAt: row.created_at,
  followUpQuestions: row.follow_up_questions,
  id: row.id,
  modelRequested: row.model_requested,
  promptVersion: row.prompt_version,
  providerId: row.provider_id,
  providerMode: row.provider_mode,
  strengths: row.strengths,
  suggestedAnswer: row.suggested_answer,
  summary: row.summary,
  unsupportedClaimsDetected: row.unsupported_claims,
});

export async function listReviews(db: TransactionSql, owner: string, answerId: string) {
  const rows = await db<
    ReviewRow[]
  >`select id,answer_version,answer_snapshot,provider_id,provider_mode,model_requested,prompt_version,summary,strengths,suggested_answer,follow_up_questions,unsupported_claims,created_at from app.answer_coach_review where owner_user_id=${owner}::uuid and answer_id=${answerId}::uuid order by created_at desc`;
  const result: StoredReview[] = [];
  for (const row of rows) {
    const comments = await db<
      CommentRow[]
    >`select id,category,anchor_start,anchor_end,anchor_quote,observation,coaching_question,optional_revision,state from app.answer_coach_comment where owner_user_id=${owner}::uuid and review_id=${row.id}::uuid order by position`;
    result.push(mapReview(row, comments));
  }
  return result;
}

export async function assertUsageAllowed(db: TransactionSql, owner: string) {
  await db`select pg_advisory_xact_lock(hashtext(${`answer-coach:${owner}`}))`;
  const [counts] = await db<
    { monthly: number; recent: number }[]
  >`select count(*) filter(where created_at>=date_trunc('month',now()))::int monthly,count(*) filter(where created_at>=now()-interval '10 minutes')::int recent from app.answer_coach_review where owner_user_id=${owner}::uuid`;
  if ((counts?.recent ?? 0) >= answerCoachUsageLimits.recent)
    throw new Error("answer_coach_rate_limited");
  if ((counts?.monthly ?? 0) >= answerCoachUsageLimits.monthly)
    throw new Error("answer_coach_usage_capped");
}

export async function readUsage(db: TransactionSql, owner: string): Promise<AnswerCoachUsage> {
  const [counts] = await db<
    { monthly: number; recent: number }[]
  >`select count(*) filter(where created_at>=date_trunc('month',now()))::int monthly,count(*) filter(where created_at>=now()-interval '10 minutes')::int recent from app.answer_coach_review where owner_user_id=${owner}::uuid`;
  return {
    monthlyLimit: answerCoachUsageLimits.monthly,
    monthlyUsed: counts?.monthly ?? 0,
    recentLimit: answerCoachUsageLimits.recent,
    recentUsed: counts?.recent ?? 0,
  };
}

export async function saveReview(
  db: TransactionSql,
  owner: string,
  answerId: string,
  answerVersion: number,
  answerSnapshot: string,
  providerId: string,
  providerMode: StoredReview["providerMode"],
  review: AnswerCoachReview,
  metadata?: Readonly<{
    modelRequested: boolean;
    promptVersion?: number;
    providerNoticeVersion: string | null;
    usage: AnswerCoachProviderUsage | null;
  }>,
) {
  const [row] = await db<
    ReviewRow[]
  >`insert into app.answer_coach_review(owner_user_id,answer_id,answer_version,answer_snapshot,provider_id,provider_mode,model_requested,prompt_version,provider_notice_version,input_tokens,output_tokens,latency_ms,summary,strengths,suggested_answer,follow_up_questions,unsupported_claims) values(${owner}::uuid,${answerId}::uuid,${answerVersion},${answerSnapshot},${providerId},${providerMode},${metadata?.modelRequested ?? false},${metadata?.promptVersion ?? 1},${metadata?.providerNoticeVersion ?? null},${metadata?.usage?.inputTokens ?? null},${metadata?.usage?.outputTokens ?? null},${metadata?.usage?.latencyMs ?? null},${review.summary},${db.json(review.strengths)},${review.suggestedAnswer},${db.json(review.followUpQuestions)},${db.json(review.unsupportedClaimsDetected)}) returning id,answer_version,answer_snapshot,provider_id,provider_mode,model_requested,prompt_version,summary,strengths,suggested_answer,follow_up_questions,unsupported_claims,created_at`;
  for (let index = 0; index < review.comments.length; index++) {
    const comment = review.comments[index]!;
    await db`insert into app.answer_coach_comment(owner_user_id,review_id,position,category,anchor_start,anchor_end,anchor_quote,observation,coaching_question,optional_revision) values(${owner}::uuid,${row!.id}::uuid,${index + 1},${comment.category},${comment.anchor.start},${comment.anchor.end},${comment.anchor.quote},${comment.observation},${comment.coachingQuestion},${comment.optionalRevision})`;
  }
  return (await listReviews(db, owner, answerId))[0]!;
}

export async function setCommentState(
  db: TransactionSql,
  owner: string,
  answerId: string,
  commentId: string,
  state: StoredComment["state"],
) {
  const rows = await db<
    { id: string }[]
  >`update app.answer_coach_comment c set state=${state},updated_at=now() from app.answer_coach_review r where c.id=${commentId}::uuid and c.owner_user_id=${owner}::uuid and r.id=c.review_id and r.owner_user_id=${owner}::uuid and r.answer_id=${answerId}::uuid returning c.id`;
  return rows.length ? { outcome: "changed" as const } : { outcome: "not_found" as const };
}
