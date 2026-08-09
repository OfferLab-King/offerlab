import { describe, expect, it } from "vitest";
import type { CareerReview, CareerReviewInput, CareerReviewProvider } from "../domain/review";
import { reviewCareerDocumentWithFallback } from "./review-provider";

const input: CareerReviewInput = {
  contentText: "Graduate Analyst with research and Excel experience.",
  jobDescription: "Graduate Analyst role requiring research and Excel.",
  kind: "cv",
  targetCompany: "Example Ltd",
  targetRole: "Graduate Analyst",
};

const modelReview: CareerReview = {
  documentChecks: {
    length: "Concise.",
    readability: "Clear.",
    specificity: "Specific.",
    targeting: "Targeted.",
  },
  matchedRequirements: ["research", "Excel"],
  missingRequirements: [],
  priorityActions: [
    {
      category: "Clarity",
      observation: "The profile could be more direct.",
      suggestion: "Lead with the strongest grounded evidence.",
    },
  ],
  strengths: [{ evidence: "Research is named.", requirement: "research" }],
  suggestedContent: null,
  summary: "The main requirements are represented.",
};

describe("career-document review fallback", () => {
  it("uses and labels the deterministic fallback when the model fails", async () => {
    const unavailableModel: CareerReviewProvider = {
      id: "unavailable-model",
      mode: "model",
      review: async () => {
        throw new Error("provider unavailable");
      },
    };

    const run = await reviewCareerDocumentWithFallback(unavailableModel, input);

    expect(run).toMatchObject({
      fallbackUsed: true,
      provider: { id: "offerlab-career-rubric-v2", mode: "local" },
    });
    expect(run.result.usage).toBeNull();
    expect(run.result.review.summary).toContain("assessed role requirements");
  });

  it("preserves a successful model result and telemetry without invoking fallback", async () => {
    const model: CareerReviewProvider = {
      id: "test-model",
      mode: "model",
      review: async () => ({
        review: modelReview,
        usage: { inputTokens: 100, latencyMs: 50, outputTokens: 25 },
      }),
    };

    const run = await reviewCareerDocumentWithFallback(model, input);

    expect(run).toEqual({
      fallbackUsed: false,
      provider: model,
      result: {
        review: modelReview,
        usage: { inputTokens: 100, latencyMs: 50, outputTokens: 25 },
      },
    });
  });

  it("fails explicitly if a selected local provider cannot complete", async () => {
    const unavailableLocal: CareerReviewProvider = {
      id: "broken-local",
      mode: "local",
      review: async () => {
        throw new Error("local failed");
      },
    };

    await expect(reviewCareerDocumentWithFallback(unavailableLocal, input)).rejects.toThrow(
      "career_document_review_failed",
    );
  });
});
