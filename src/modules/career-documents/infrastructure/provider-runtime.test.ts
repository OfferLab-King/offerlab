import { afterEach, describe, expect, it, vi } from "vitest";
import { readCareerDocumentRuntime } from "./provider-runtime";

function configureDeepSeek() {
  vi.stubEnv("CAREER_DOCUMENT_PROVIDER", "deepseek");
  vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
  vi.stubEnv("DEEPSEEK_BASE_URL", "https://api.deepseek.example");
  vi.stubEnv("DEEPSEEK_MODEL", "deepseek-v4-flash");
}

describe("career-document provider runtime gate", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("enables a complete DeepSeek configuration outside production", () => {
    configureDeepSeek();
    vi.stubEnv("APP_ENV", "local");

    expect(readCareerDocumentRuntime()).toMatchObject({
      modelAvailable: true,
      provider: { id: "deepseek-deepseek-v4-flash", mode: "model" },
      providerName: "DeepSeek",
    });
  });

  it.each([undefined, "", "prodution"])(
    "keeps hosted review unavailable for an absent or invalid APP_ENV (%s)",
    (appEnvironment) => {
      configureDeepSeek();
      if (appEnvironment === undefined) vi.stubEnv("APP_ENV", undefined);
      else vi.stubEnv("APP_ENV", appEnvironment);

      expect(readCareerDocumentRuntime()).toMatchObject({
        modelAvailable: false,
        provider: { mode: "local" },
        providerName: "Local review",
      });
    },
  );

  it("fails closed in production until member-data use is explicitly approved", () => {
    configureDeepSeek();
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("CAREER_DOCUMENT_MODEL_DATA_APPROVED", "false");

    expect(readCareerDocumentRuntime()).toMatchObject({
      modelAvailable: false,
      provider: { id: "offerlab-career-rubric-v2", mode: "local" },
      providerName: "Local review",
    });

    vi.stubEnv("CAREER_DOCUMENT_MODEL_DATA_APPROVED", "true");
    expect(readCareerDocumentRuntime()).toMatchObject({
      modelAvailable: true,
      providerName: "DeepSeek",
    });
  });

  it("requires HTTPS transport for a production hosted provider", () => {
    configureDeepSeek();
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("CAREER_DOCUMENT_MODEL_DATA_APPROVED", "true");
    vi.stubEnv("DEEPSEEK_BASE_URL", "http://api.deepseek.example");

    expect(readCareerDocumentRuntime()).toMatchObject({
      modelAvailable: false,
      provider: { mode: "local" },
      providerName: "Local review",
    });
  });

  it.each([
    "ftp://api.deepseek.example",
    "https://user:secret@api.deepseek.example",
    "https://api.deepseek.example?token=unsafe",
  ])("rejects an unsafe hosted-provider base URL: %s", (baseUrl) => {
    configureDeepSeek();
    vi.stubEnv("APP_ENV", "local");
    vi.stubEnv("DEEPSEEK_BASE_URL", baseUrl);

    expect(readCareerDocumentRuntime()).toMatchObject({
      modelAvailable: false,
      provider: { mode: "local" },
    });
  });

  it.each(["DEEPSEEK_API_KEY", "DEEPSEEK_BASE_URL", "DEEPSEEK_MODEL"])(
    "keeps model review unavailable when %s is missing",
    (missingKey) => {
      configureDeepSeek();
      vi.stubEnv("APP_ENV", "local");
      vi.stubEnv(missingKey, "");

      expect(readCareerDocumentRuntime()).toMatchObject({
        modelAvailable: false,
        provider: { mode: "local" },
        providerName: "Local review",
      });
    },
  );

  it("does not select DeepSeek unless it is the configured provider", () => {
    configureDeepSeek();
    vi.stubEnv("APP_ENV", "local");
    vi.stubEnv("CAREER_DOCUMENT_PROVIDER", "local");

    expect(readCareerDocumentRuntime()).toMatchObject({
      modelAvailable: false,
      provider: { mode: "local" },
      providerName: "Local review",
    });
  });

  it("uses deterministic local review when hosted AI is switched off", () => {
    configureDeepSeek();
    vi.stubEnv("APP_ENV", "local");
    vi.stubEnv("CAREER_DOCUMENT_AI_ENABLED", "false");

    expect(readCareerDocumentRuntime()).toMatchObject({
      modelAvailable: false,
      provider: { id: "offerlab-career-rubric-v2", mode: "local" },
      providerName: "Local review",
    });
  });
});
