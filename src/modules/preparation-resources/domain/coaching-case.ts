import { z } from "zod";

export const coachingCaseCategories = [
  "Evidence",
  "Reasoning",
  "Relevance",
  "Structure",
  "Reflection",
] as const;

export const coachingCaseChangeSchema = z
  .object({
    category: z.enum(coachingCaseCategories),
    end: z.number().int().nonnegative(),
    explanation: z.string().min(1).max(800),
    heading: z.string().min(1).max(120),
    id: z.string().regex(/^[a-z][a-z0-9_]{0,79}$/u),
    replacement: z.string().max(1000),
    start: z.number().int().nonnegative(),
  })
  .strict();

export const coachingCaseDetailSchema = z
  .object({
    changes: z.array(coachingCaseChangeSchema).min(1).max(20),
    improvedAnswer: z.string().min(1).max(8000),
    keyWeaknesses: z.array(z.string().min(1).max(300)).min(1).max(6),
    originalAnswer: z.string().min(1).max(8000),
    practicePrompt: z.string().min(1).max(1000),
    question: z.string().min(1).max(1000),
    whyStronger: z.string().min(1).max(2000),
  })
  .strict()
  .superRefine((value, context) => {
    let cursor = 0;
    let rebuilt = "";
    for (const [index, change] of [...value.changes].sort((a, b) => a.start - b.start).entries()) {
      if (
        change.start < cursor ||
        change.end <= change.start ||
        change.end > value.originalAnswer.length
      ) {
        context.addIssue({
          code: "custom",
          message: "Changes must be ordered, non-overlapping ranges inside the original answer.",
          path: ["changes", index],
        });
        continue;
      }
      rebuilt += value.originalAnswer.slice(cursor, change.start) + change.replacement;
      cursor = change.end;
    }
    rebuilt += value.originalAnswer.slice(cursor);
    if (rebuilt !== value.improvedAnswer)
      context.addIssue({
        code: "custom",
        message: "Improved answer must exactly match the declared changes.",
        path: ["improvedAnswer"],
      });
  });

export type CoachingCaseDetail = z.infer<typeof coachingCaseDetailSchema>;
