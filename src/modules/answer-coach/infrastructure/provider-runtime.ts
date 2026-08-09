import "server-only";

import type { AnswerCoachProvider } from "../domain/review";
import { createDeepSeekProvider } from "./deepseek-provider";
import { localRubricProvider } from "./local-rubric-provider";

export const answerCoachNoticeVersion = "answer-coach-deepseek-2026-08-06";

export type AnswerCoachRuntime = Readonly<{
  modelAvailable: boolean;
  provider: AnswerCoachProvider;
  providerName: "DeepSeek" | "Local rubric";
}>;

const applicationEnvironments = new Set(["local", "test", "staging", "production"]);

export function readAnswerCoachRuntime(): AnswerCoachRuntime {
  const appEnvironment = process.env.APP_ENV;
  if (!appEnvironment || !applicationEnvironments.has(appEnvironment)) {
    return { modelAvailable: false, provider: localRubricProvider, providerName: "Local rubric" };
  }
  const productionDataApproved =
    appEnvironment !== "production" || process.env.ANSWER_COACH_MODEL_DATA_APPROVED === "true";
  if (
    productionDataApproved &&
    process.env.ANSWER_COACH_PROVIDER === "deepseek" &&
    process.env.DEEPSEEK_API_KEY &&
    process.env.DEEPSEEK_BASE_URL &&
    process.env.DEEPSEEK_MODEL
  ) {
    return {
      modelAvailable: true,
      provider: createDeepSeekProvider({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseUrl: process.env.DEEPSEEK_BASE_URL,
        model: process.env.DEEPSEEK_MODEL,
      }),
      providerName: "DeepSeek",
    };
  }
  return { modelAvailable: false, provider: localRubricProvider, providerName: "Local rubric" };
}
