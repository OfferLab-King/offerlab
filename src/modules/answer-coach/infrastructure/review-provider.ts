import "server-only";

import { logger } from "../../../infrastructure/logging/logger";
import type {
  AnswerCoachInput,
  AnswerCoachProvider,
  AnswerCoachProviderResult,
} from "../domain/review";
import { localRubricProvider } from "./local-rubric-provider";

export type ProviderRun = Readonly<{
  fallbackUsed: boolean;
  provider: AnswerCoachProvider;
  result: AnswerCoachProviderResult;
}>;

export async function reviewWithLocalFallback(
  provider: AnswerCoachProvider,
  input: AnswerCoachInput,
): Promise<ProviderRun> {
  try {
    return { fallbackUsed: false, provider, result: await provider.review(input) };
  } catch (error) {
    if (provider.mode !== "model") throw new Error("answer_coach_provider_unavailable");
    const reason =
      error instanceof Error && error.name === "AbortError"
        ? "timeout"
        : error instanceof Error && error.message.startsWith("answer_coach_")
          ? error.message
          : "unknown";
    logger.warn({
      event: "answer_coach_provider_fallback",
      provider: provider.id,
      reason,
    });
    return {
      fallbackUsed: true,
      provider: localRubricProvider,
      result: await localRubricProvider.review(input),
    };
  }
}
