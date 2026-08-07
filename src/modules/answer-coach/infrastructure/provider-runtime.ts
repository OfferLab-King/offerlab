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

export function readAnswerCoachRuntime(): AnswerCoachRuntime {
  const productionDataApproved =
    process.env.APP_ENV !== "production" || process.env.ANSWER_COACH_MODEL_DATA_APPROVED === "true";
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
