import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CareerReviewInput } from "../domain/review";
import { createDeepSeekCareerReviewProvider } from "./deepseek-provider";

const loggerMocks = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("../../../infrastructure/logging/logger", () => ({ logger: loggerMocks }));

const input: CareerReviewInput = {
  contentText:
    "SUMMARY\nWeb Developer using React and accessibility. Contact: private.member@example.test.",
  jobDescription: "Example Ltd needs a Web Developer with React and TypeScript.",
  kind: "cv",
  targetCompany: "Example Ltd",
  targetRole: "Web Developer",
};

const validOutput = {
  documentChecks: {
    length: "The CV is concise.",
    readability: "The structure is clear.",
    specificity: "The evidence needs more detail.",
    targeting: "The target role is explicit.",
  },
  matchedRequirements: ["React"],
  missingRequirements: ["TypeScript"],
  priorityActions: [
    {
      category: "Evidence",
      observation: "TypeScript is not evidenced.",
      suggestion: "Add a truthful example only if the source supports it.",
    },
  ],
  strengths: [
    {
      evidence: "Web Developer using React and accessibility.",
      requirement: "React",
    },
  ],
  suggestedContent: null,
  summary: "React is represented; TypeScript needs an evidence check.",
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
  return createDeepSeekCareerReviewProvider(
    {
      apiKey: "private-provider-key",
      baseUrl: "https://api.deepseek.example/",
      model: "deepseek-v4-flash",
      timeoutMs: 1_000,
    },
    fetchImplementation,
  );
}

describe("DeepSeek career-document review provider", () => {
  beforeEach(() => {
    loggerMocks.info.mockClear();
    loggerMocks.warn.mockClear();
  });

  it("sends a bounded JSON request and logs only operational telemetry", async () => {
    const fetchImplementation = vi.fn(async (...arguments_: Parameters<typeof fetch>) => {
      void arguments_;
      return apiResponse(JSON.stringify(validOutput));
    });

    const result = await provider(fetchImplementation as typeof fetch).review(input);

    expect(result.review).toEqual(validOutput);
    expect(result.usage).toMatchObject({ inputTokens: 120, outputTokens: 42 });
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    const [url, request] = fetchImplementation.mock.calls[0]!;
    expect(url).toBe("https://api.deepseek.example/chat/completions");
    expect(request).toMatchObject({ cache: "no-store", method: "POST" });
    expect(request?.headers).toEqual({
      authorization: "Bearer private-provider-key",
      "content-type": "application/json",
    });
    const body = JSON.parse(String(request?.body));
    expect(body).toMatchObject({
      max_tokens: 4_000,
      model: "deepseek-v4-flash",
      response_format: { type: "json_object" },
      temperature: 0.2,
      thinking: { type: "disabled" },
    });
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0]).toMatchObject({ role: "system" });
    expect(body.messages[1]).toMatchObject({ role: "user" });
    expect(body.messages[1].content).toContain(JSON.stringify(input.contentText));
    expect(JSON.stringify(body)).not.toContain("private-provider-key");

    expect(loggerMocks.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "career_document_provider_completed",
        inputTokens: 120,
        model: "deepseek-v4-flash",
        outputTokens: 42,
        provider: "deepseek",
      }),
    );
    const telemetry = JSON.stringify([
      ...loggerMocks.info.mock.calls,
      ...loggerMocks.warn.mock.calls,
    ]);
    expect(telemetry).not.toContain(input.contentText);
    expect(telemetry).not.toContain(input.jobDescription);
    expect(telemetry).not.toContain(input.targetCompany);
    expect(telemetry).not.toContain("private.member@example.test");
    expect(telemetry).not.toContain("private-provider-key");
  });

  it("retries malformed JSON once and asks the model to repair its output", async () => {
    const fetchImplementation = vi
      .fn()
      .mockResolvedValueOnce(apiResponse("{"))
      .mockResolvedValueOnce(apiResponse(JSON.stringify(validOutput)));

    const result = await provider(fetchImplementation as typeof fetch).review(input);

    expect(result.review).toEqual(validOutput);
    expect(result.usage).toMatchObject({ inputTokens: 240, outputTokens: 84 });
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
    const retryBody = JSON.parse(String(fetchImplementation.mock.calls[1]![1]?.body));
    expect(retryBody.messages[0].content).toContain("previous output was malformed or unsafe");
    expect(loggerMocks.warn).toHaveBeenCalledWith({
      attempt: 1,
      event: "career_document_model_output_rejected",
    });
  });

  it("rejects schema-invalid output after the single bounded retry", async () => {
    const invalidOutput = { ...validOutput, unexpected: "not allowed" };
    const fetchImplementation = vi.fn(async () => apiResponse(JSON.stringify(invalidOutput)));

    await expect(provider(fetchImplementation as typeof fetch).review(input)).rejects.toThrow(
      "career_document_model_output_invalid",
    );
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });

  it("retries a model-written replacement before accepting a diagnostic-only review", async () => {
    const unsafeOutput = {
      ...validOutput,
      suggestedContent:
        "Web Developer using React and accessibility who improved delivery by 83% across several complex projects and consistently exceeded every stakeholder expectation.",
    };
    const fetchImplementation = vi
      .fn()
      .mockResolvedValueOnce(apiResponse(JSON.stringify(unsafeOutput)))
      .mockResolvedValueOnce(apiResponse(JSON.stringify(validOutput)));

    await expect(
      provider(fetchImplementation as typeof fetch).review(input),
    ).resolves.toMatchObject({ review: validOutput });
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
    expect(loggerMocks.warn).toHaveBeenCalledWith({
      attempt: 1,
      event: "career_document_model_output_rejected",
    });
  });

  it("retries an incomplete response and then accepts complete JSON", async () => {
    const incomplete = new Response(
      JSON.stringify({ choices: [{ finish_reason: "length", message: { content: "{}" } }] }),
      { headers: { "content-type": "application/json" } },
    );
    const fetchImplementation = vi
      .fn()
      .mockResolvedValueOnce(incomplete)
      .mockResolvedValueOnce(apiResponse(JSON.stringify(validOutput)));

    await expect(
      provider(fetchImplementation as typeof fetch).review(input),
    ).resolves.toMatchObject({ review: validOutput });
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });

  it("does not retry provider authentication or rate-limit failures", async () => {
    const fetchImplementation = vi.fn(async () => apiResponse("{}", 429));

    await expect(provider(fetchImplementation as typeof fetch).review(input)).rejects.toThrow(
      "career_document_provider_unavailable",
    );
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    expect(loggerMocks.warn).toHaveBeenCalledWith({
      event: "career_document_provider_failed",
      provider: "deepseek",
      statusCode: 429,
    });
  });
});
