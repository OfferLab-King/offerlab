import { describe, expect, it } from "vitest";
import { answerCoachCategories, validateProviderReview } from "../domain/review";
import { answerCoachEvaluationExamples } from "../evaluation/examples";
import { localRubricProvider } from "./local-rubric-provider";

describe("local Answer Coach fallback", () => {
  it.each(answerCoachEvaluationExamples)(
    "returns valid grounded output for $id",
    async ({ input }) => {
      const raw = await localRubricProvider.review(input);
      const review = validateProviderReview(raw, input.draftAnswer.trim());
      expect(review.comments.length).toBeGreaterThan(0);
      expect(review.comments.length).toBeLessThanOrEqual(8);
      expect(
        review.comments.every((comment) => answerCoachCategories.includes(comment.category)),
      ).toBe(true);
    },
  );

  it("rejects malformed and ungrounded provider anchors", () => {
    expect(() => validateProviderReview({ comments: [], extra: true }, "Answer")).toThrow();
    expect(() =>
      validateProviderReview(
        {
          comments: [
            {
              anchor: { start: 0, end: 5, quote: "Wrong" },
              category: "Evidence",
              coachingQuestion: "What happened?",
              observation: "Add evidence.",
              optionalRevision: null,
            },
          ],
          followUpQuestions: [],
          strengths: [],
          summary: "Review.",
          unsupportedClaimsDetected: [],
        },
        "Right answer",
      ),
    ).toThrow("answer_coach_invalid_anchor");
  });
});
