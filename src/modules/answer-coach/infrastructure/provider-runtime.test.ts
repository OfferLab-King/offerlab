import { describe, expect, it, vi } from "vitest";
import { readAnswerCoachRuntime } from "./provider-runtime";

function configureDeepSeek() {
  vi.stubEnv("ANSWER_COACH_PROVIDER", "deepseek");
  vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
  vi.stubEnv("DEEPSEEK_BASE_URL", "https://api.deepseek.example");
  vi.stubEnv("DEEPSEEK_MODEL", "deepseek-v4-flash");
}

describe("Answer Coach provider runtime gate", () => {
  it("enables a complete DeepSeek configuration outside production", () => {
    configureDeepSeek();
    vi.stubEnv("APP_ENV", "local");
    expect(readAnswerCoachRuntime()).toMatchObject({
      modelAvailable: true,
      providerName: "DeepSeek",
    });
  });

  it("fails closed in production until the member-data gate is approved", () => {
    configureDeepSeek();
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("ANSWER_COACH_MODEL_DATA_APPROVED", "false");
    expect(readAnswerCoachRuntime()).toMatchObject({
      modelAvailable: false,
      providerName: "Local rubric",
    });
    vi.stubEnv("ANSWER_COACH_MODEL_DATA_APPROVED", "true");
    expect(readAnswerCoachRuntime()).toMatchObject({
      modelAvailable: true,
      providerName: "DeepSeek",
    });
  });
});
