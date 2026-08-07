import { describe, expect, it, vi } from "vitest";
import { validateProviderReview, type AnswerCoachInput } from "../domain/review";
import { answerCoachEvaluationExamples } from "../evaluation/examples";
import { createDeepSeekProvider } from "./deepseek-provider";

const input: AnswerCoachInput = {
  draftAnswer: "I compared three options because the deadline was close. We delivered on time.",
  keyPoints: "Comparison and delivery.",
  question: "Tell me about teamwork.",
  questionFamily: "competency_and_behavioural",
  stories: [],
};

const validOutput = {
  comments: [
    {
      anchorId: "a1",
      category: "Evidence",
      coachingQuestion: "What criteria did you use?",
      observation: "The action is clear; the comparison criteria would strengthen the evidence.",
      optionalRevision: null,
    },
  ],
  followUpQuestions: ["What criteria did you use?"],
  strengths: ["The answer explains why timing mattered."],
  suggestedAnswer:
    "I compared three options because the deadline was close, and we delivered on time.",
  summary: "Add the criteria behind your comparison.",
  unsupportedClaimsDetected: [],
};

function apiResponse(content: string, status = 200) {
  return new Response(
    JSON.stringify({
      choices: [{ finish_reason: "stop", message: { content } }],
      usage: { completion_tokens: 42, prompt_tokens: 120 },
    }),
    { headers: { "content-type": "application/json" }, status },
  );
}

function provider(fetchImplementation: typeof fetch) {
  return createDeepSeekProvider(
    {
      apiKey: "test-key",
      baseUrl: "https://api.deepseek.example",
      model: "deepseek-v4-flash",
      timeoutMs: 1000,
    },
    fetchImplementation,
  );
}

describe("DeepSeek Answer Coach provider", () => {
  it.each(answerCoachEvaluationExamples)(
    "passes strict structured-output and anchoring checks for synthetic case $id",
    async ({ input: evaluationInput }) => {
      const output = {
        ...validOutput,
        comments: [{ ...validOutput.comments[0] }],
        suggestedAnswer: null,
      };
      const fetchImplementation = vi.fn(async () => apiResponse(JSON.stringify(output)));
      const result = await provider(fetchImplementation as typeof fetch).review(evaluationInput);
      expect(() =>
        validateProviderReview(result.review, evaluationInput.draftAnswer),
      ).not.toThrow();
    },
  );

  it("returns strictly validated output with deterministic source offsets", async () => {
    const fetchImplementation = vi.fn(async (...arguments_: Parameters<typeof fetch>) => {
      void arguments_;
      return apiResponse(JSON.stringify(validOutput));
    });
    const result = await provider(fetchImplementation as typeof fetch).review(input);
    const review = validateProviderReview(result.review, input.draftAnswer);
    expect(review.comments[0]?.anchor).toEqual({
      end: 56,
      quote: "I compared three options because the deadline was close.",
      start: 0,
    });
    expect(result.usage).toMatchObject({ inputTokens: 120, outputTokens: 42 });
    const request = fetchImplementation.mock.calls[0]![1]!;
    const body = JSON.parse(String(request.body));
    expect(body).toMatchObject({
      response_format: { type: "json_object" },
      thinking: { type: "disabled" },
    });
    expect(JSON.stringify(body)).not.toContain("test-key");
  });

  it("retries malformed output once and then accepts a valid response", async () => {
    const fetchImplementation = vi
      .fn()
      .mockResolvedValueOnce(apiResponse("{"))
      .mockResolvedValueOnce(apiResponse(JSON.stringify(validOutput)));
    await expect(
      provider(fetchImplementation as typeof fetch).review(input),
    ).resolves.toBeDefined();
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });

  it("rejects an ungrounded anchor after the single bounded retry", async () => {
    const ungrounded = {
      ...validOutput,
      comments: [{ ...validOutput.comments[0], anchorId: "a99" }],
    };
    const fetchImplementation = vi.fn(async () => apiResponse(JSON.stringify(ungrounded)));
    await expect(provider(fetchImplementation as typeof fetch).review(input)).rejects.toThrow(
      "answer_coach_model_anchor_invalid",
    );
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });

  it("rejects a suggested answer that invents a numeric claim", async () => {
    const ungrounded = { ...validOutput, suggestedAnswer: `${validOutput.suggestedAnswer} 93%.` };
    const fetchImplementation = vi.fn(async () => apiResponse(JSON.stringify(ungrounded)));
    await expect(provider(fetchImplementation as typeof fetch).review(input)).rejects.toThrow(
      "answer_coach_model_suggestion_ungrounded_number",
    );
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });

  it("retries a suggested answer that infers an unstated outcome", async () => {
    const inferred = {
      ...validOutput,
      suggestedAnswer:
        "I compared three options because the deadline was close and helped the team choose faster.",
    };
    const fetchImplementation = vi
      .fn()
      .mockResolvedValueOnce(apiResponse(JSON.stringify(inferred)))
      .mockResolvedValueOnce(apiResponse(JSON.stringify(validOutput)));
    const result = await provider(fetchImplementation as typeof fetch).review(input);
    const review = validateProviderReview(result.review, input.draftAnswer);
    expect(review.suggestedAnswer).toBe(validOutput.suggestedAnswer);
    const retryBody = JSON.parse(String(fetchImplementation.mock.calls[1]![1]!.body));
    expect(retryBody.messages[0].content).toContain("inferred an outcome or effect");
  });

  it("requires comment-level replacement wording to appear in the complete suggestion", async () => {
    const optionalRevision = "Because the deadline was close, I compared three options.";
    const mismatched = {
      ...validOutput,
      comments: [{ ...validOutput.comments[0], optionalRevision }],
    };
    const aligned = {
      ...mismatched,
      suggestedAnswer: `${optionalRevision} We delivered on time.`,
    };
    const fetchImplementation = vi
      .fn()
      .mockResolvedValueOnce(apiResponse(JSON.stringify(mismatched)))
      .mockResolvedValueOnce(apiResponse(JSON.stringify(aligned)));
    const result = await provider(fetchImplementation as typeof fetch).review(input);
    const review = validateProviderReview(result.review, input.draftAnswer);
    expect(review.suggestedAnswer).toBe(aligned.suggestedAnswer);
    expect(review.comments[0]?.optionalRevision).toBe(optionalRevision);
    const retryBody = JSON.parse(String(fetchImplementation.mock.calls[1]![1]!.body));
    expect(retryBody.messages[0].content).toContain(
      "Every non-null optionalRevision must appear verbatim in suggestedAnswer",
    );
  });

  it("can omit unsupported source claims while retaining a grounded suggested answer", async () => {
    const output = {
      ...validOutput,
      unsupportedClaimsDetected: ["The result is not supported."],
    };
    const fetchImplementation = vi.fn(async () => apiResponse(JSON.stringify(output)));
    const result = await provider(fetchImplementation as typeof fetch).review(input);
    expect(validateProviderReview(result.review, input.draftAnswer).suggestedAnswer).toBe(
      validOutput.suggestedAnswer,
    );
  });

  it("does not retry provider authentication or rate-limit failures", async () => {
    const fetchImplementation = vi.fn(async () => apiResponse("{}", 429));
    await expect(provider(fetchImplementation as typeof fetch).review(input)).rejects.toThrow(
      "answer_coach_provider_unavailable",
    );
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });
});
