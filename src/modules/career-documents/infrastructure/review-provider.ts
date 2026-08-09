import type { CareerReviewInput, CareerReviewProvider } from "../domain/review";
import { localCareerReviewProvider } from "../domain/review";

export async function reviewCareerDocumentWithFallback(
  provider: CareerReviewProvider,
  input: CareerReviewInput,
) {
  try {
    return { fallbackUsed: false, provider, result: await provider.review(input) } as const;
  } catch {
    if (provider.mode === "local") throw new Error("career_document_review_failed");
    return {
      fallbackUsed: true,
      provider: { ...localCareerReviewProvider, mode: "local" as const },
      result: await localCareerReviewProvider.review(input),
    } as const;
  }
}
