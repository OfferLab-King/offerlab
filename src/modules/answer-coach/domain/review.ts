import { z } from "zod";

const note = z.object({ detail: z.string().max(500), heading: z.string().max(120) }).strict();
export const answerCoachReviewSchema = z
  .object({
    coachingQuestions: z.array(z.string().max(300)).max(3),
    priorities: z.array(note).max(3),
    strengths: z.array(note).max(3),
    summary: z.string().max(500),
  })
  .strict();
export type AnswerCoachReview = z.infer<typeof answerCoachReviewSchema>;

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
  stories: readonly CoachStory[];
}>;

export interface AnswerCoachProvider {
  readonly mode: "local_prototype" | "provider";
  review(input: AnswerCoachInput): Promise<AnswerCoachReview>;
}
