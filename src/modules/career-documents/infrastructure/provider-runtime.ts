import "server-only";

import type { CareerReviewProvider } from "../domain/review";
import { localCareerReviewProvider } from "../domain/review";
import { createDeepSeekCareerReviewProvider } from "./deepseek-provider";

export const careerDocumentNoticeVersion = "career-documents-deepseek-2026-08-07";

export type CareerDocumentRuntime = Readonly<{
  modelAvailable: boolean;
  provider: CareerReviewProvider;
  providerName: "DeepSeek" | "Local review";
}>;

const applicationEnvironments = new Set(["local", "test", "staging", "production"]);

function providerTransportAllowed(baseUrl: string | undefined, appEnvironment: string): boolean {
  if (!baseUrl) return false;
  try {
    const url = new URL(baseUrl);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !["http:", "https:"].includes(url.protocol)
    )
      return false;
    return appEnvironment !== "production" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function readCareerDocumentRuntime(): CareerDocumentRuntime {
  const appEnvironment = process.env.APP_ENV;
  if (!appEnvironment || !applicationEnvironments.has(appEnvironment)) {
    return {
      modelAvailable: false,
      provider: localCareerReviewProvider,
      providerName: "Local review",
    };
  }
  const baseUrl = process.env.DEEPSEEK_BASE_URL;
  const productionDataApproved =
    appEnvironment !== "production" || process.env.CAREER_DOCUMENT_MODEL_DATA_APPROVED === "true";
  if (
    process.env.CAREER_DOCUMENT_AI_ENABLED !== "false" &&
    productionDataApproved &&
    process.env.CAREER_DOCUMENT_PROVIDER === "deepseek" &&
    process.env.DEEPSEEK_API_KEY &&
    baseUrl &&
    providerTransportAllowed(baseUrl, appEnvironment) &&
    process.env.DEEPSEEK_MODEL
  ) {
    return {
      modelAvailable: true,
      provider: createDeepSeekCareerReviewProvider({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseUrl,
        model: process.env.DEEPSEEK_MODEL,
      }),
      providerName: "DeepSeek",
    };
  }
  return {
    modelAvailable: false,
    provider: localCareerReviewProvider,
    providerName: "Local review",
  };
}
