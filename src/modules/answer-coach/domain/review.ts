import { z } from "zod";

export const answerCoachCategories = [
  "Evidence",
  "Reasoning",
  "Relevance",
  "Structure",
  "Reflection",
] as const;

export const answerCoachCommentSchema = z
  .object({
    anchor: z
      .object({
        end: z.number().int().nonnegative(),
        quote: z.string().min(1).max(500),
        start: z.number().int().nonnegative(),
      })
      .strict(),
    category: z.enum(answerCoachCategories),
    coachingQuestion: z.string().min(1).max(300),
    observation: z.string().min(1).max(500),
    optionalRevision: z.string().min(1).max(500).nullable(),
  })
  .strict();

export const answerCoachReviewSchema = z
  .object({
    comments: z.array(answerCoachCommentSchema).min(1).max(8),
    followUpQuestions: z.array(z.string().min(1).max(300)).max(3),
    strengths: z.array(z.string().min(1).max(300)).max(2),
    suggestedAnswer: z.string().min(1).max(8000).nullable(),
    summary: z.string().min(1).max(300),
    unsupportedClaimsDetected: z.array(z.string().min(1).max(300)).max(3),
  })
  .strict();

export type AnswerCoachReview = z.infer<typeof answerCoachReviewSchema>;
export type AnswerCoachComment = z.infer<typeof answerCoachCommentSchema>;
export type CoachStory = Readonly<{
  actions: string;
  reasoning: string;
  reflection: string;
  result: string;
  situation: string;
  task: string;
}>;
export type AnswerCoachInput = Readonly<{
  draftAnswer: string;
  keyPoints: string;
  question: string;
  questionFamily: string;
  stories: readonly CoachStory[];
}>;

export type AnswerCoachProviderUsage = Readonly<{
  inputTokens: number;
  latencyMs: number;
  outputTokens: number;
}>;

export type AnswerCoachProviderResult = Readonly<{
  review: unknown;
  usage: AnswerCoachProviderUsage | null;
}>;

export interface AnswerCoachProvider {
  readonly id: string;
  readonly mode: "local_rubric" | "model";
  review(input: AnswerCoachInput): Promise<AnswerCoachProviderResult>;
}

export function validateProviderReview(value: unknown, answer: string): AnswerCoachReview {
  const review = answerCoachReviewSchema.parse(value);
  for (const comment of review.comments) {
    const { start, end, quote } = comment.anchor;
    if (end <= start || end > answer.length || answer.slice(start, end) !== quote)
      throw new Error("answer_coach_invalid_anchor");
  }
  return review;
}
