import { describe, expect, it } from "vitest";
import type { AnswerCoachInput, AnswerCoachProvider } from "../domain/review";
import { reviewWithLocalFallback } from "./review-provider";

const input: AnswerCoachInput = {
  draftAnswer: "We completed the task.",
  keyPoints: "",
  question: "Tell me about teamwork.",
  questionFamily: "competency_and_behavioural",
  stories: [],
};

describe("Answer Coach local fallback", () => {
  it("uses and labels the deterministic fallback when a model fails", async () => {
    const unavailableModel: AnswerCoachProvider = {
      id: "unavailable-model",
      mode: "model",
      review: async () => {
        throw new Error("provider unavailable");
      },
    };
    const run = await reviewWithLocalFallback(unavailableModel, input);
    expect(run).toMatchObject({
      fallbackUsed: true,
      provider: { id: "local-rubric-v1", mode: "local_rubric" },
    });
    expect(run.result.review).toMatchObject({ comments: expect.any(Array) });
  });
});
