import "server-only";
import { withApplicationUser } from "../../../infrastructure/database/runtime-connections";
import { readAnswer, readStories } from "../../answer-bank/application/answer-bank";
import { validateProviderReview } from "../domain/review";
import { localRubricProvider } from "../infrastructure/local-rubric-provider";
import * as repo from "../infrastructure/review-repository";

const provider = localRubricProvider;
export const readAnswerReviews = (owner: string, answerId: string) =>
  withApplicationUser(owner, (db) => repo.listReviews(db, owner, answerId));

export async function reviewMemberAnswer(owner: string, answerId: string) {
  if (process.env.ANSWER_COACH_ENABLED === "false") throw new Error("answer_coach_disabled");
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
  return withApplicationUser(owner, async (db) => {
    await repo.assertUsageAllowed(db, owner);
    const raw = await provider.review({
      draftAnswer: draft,
      keyPoints: answer.keyPoints.slice(0, 2000),
      question: answer.question.slice(0, 1000),
      stories: linkedStories,
    });
    const review = validateProviderReview(raw, draft);
    return repo.saveReview(
      db,
      owner,
      answerId,
      answer.version,
      draft,
      provider.id,
      provider.mode,
      review,
    );
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
