import "server-only";
import { withApplicationUser } from "../../../infrastructure/database/runtime-connections";
import { readAnswer, readStories } from "../../answer-bank/application/answer-bank";
import { validateProviderReview } from "../domain/review";
import {
  answerCoachNoticeVersion,
  readAnswerCoachRuntime,
} from "../infrastructure/provider-runtime";
import * as repo from "../infrastructure/review-repository";
import { reviewWithLocalFallback } from "../infrastructure/review-provider";
import { answerCoachPromptVersion } from "../infrastructure/deepseek-provider";

export const readAnswerReviews = (owner: string, answerId: string) =>
  withApplicationUser(owner, (db) => repo.listReviews(db, owner, answerId));
export const readAnswerCoachUsage = (owner: string) =>
  withApplicationUser(owner, (db) => repo.readUsage(db, owner));
export function readAnswerCoachConfiguration() {
  const runtime = readAnswerCoachRuntime();
  return { modelAvailable: runtime.modelAvailable };
}

export async function reviewMemberAnswer(
  owner: string,
  answerId: string,
  options: Readonly<{ modelConsent: boolean }> = { modelConsent: false },
) {
  if (process.env.ANSWER_COACH_ENABLED === "false") throw new Error("answer_coach_disabled");
  const runtime = readAnswerCoachRuntime();
  if (runtime.modelAvailable && !options.modelConsent)
    throw new Error("answer_coach_consent_required");
  const [answer, stories] = await Promise.all([readAnswer(owner, answerId), readStories(owner)]);
  if (!answer || answer.archivedAt) return null;
  const draft = answer.draftAnswer.trim();
  if (!draft || draft.length > 8000) throw new Error("answer_coach_input_invalid");
  const linkedStories = answer.storyIds.slice(0, 3).flatMap((id) => {
    const story = stories.find((candidate) => candidate.id === id);
    return story
      ? [
          {
            actions: story.actions.slice(0, 2000),
            reasoning: story.reasoning.slice(0, 1200),
            reflection: story.reflection.slice(0, 1200),
            result: story.result.slice(0, 1200),
            situation: story.situation.slice(0, 1200),
            task: story.task.slice(0, 1200),
          },
        ]
      : [];
  });
  // Reserve a review slot in a short transaction (atomic per-owner capacity),
  // then run the provider call with no database connection held open.
  await withApplicationUser(owner, (db) => repo.reserveAnswerCoachReviewUsage(db, owner));
  const input = {
    draftAnswer: draft,
    keyPoints: answer.keyPoints.slice(0, 2000),
    question: answer.question.slice(0, 1000),
    questionFamily: answer.questionFamily,
    stories: linkedStories,
  };
  const run = await reviewWithLocalFallback(runtime.provider, input);
  const selectedProvider = run.provider;
  const providerResult = run.result;
  const review = validateProviderReview(providerResult.review, draft);
  return withApplicationUser(owner, async (db) => {
    const storedReview = await repo.saveReview(
      db,
      owner,
      answerId,
      answer.version,
      draft,
      selectedProvider.id,
      selectedProvider.mode,
      review,
      {
        modelRequested: runtime.modelAvailable,
        promptVersion: selectedProvider.mode === "model" ? answerCoachPromptVersion : 1,
        providerNoticeVersion: runtime.modelAvailable ? answerCoachNoticeVersion : null,
        usage: providerResult.usage,
      },
    );
    return {
      fallbackUsed: run.fallbackUsed,
      review: storedReview,
      usage: await repo.readUsage(db, owner),
    };
  });
}

export function updateAnswerReviewComment(
  owner: string,
  answerId: string,
  commentId: string,
  state: unknown,
) {
  if (state !== "open" && state !== "addressed" && state !== "dismissed")
    throw new Error("invalid_comment_state");
  return withApplicationUser(owner, (db) =>
    repo.setCommentState(db, owner, answerId, commentId, state),
  );
}
