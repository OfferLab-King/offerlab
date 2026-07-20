import { z } from "zod";

import { opportunityTypes } from "../../taxonomy/domain/opportunity-types";
import { industries } from "../../taxonomy/domain/industries";

export { opportunityTypes } from "../../taxonomy/domain/opportunity-types";
export { industries } from "../../taxonomy/domain/industries";

export const educationStages = {
  undergraduate: "Undergraduate",
  postgraduate: "Postgraduate",
  recent_graduate: "Recent graduate",
} as const;

export const preparationPriorities = {
  application_cv: "Applications and CV",
  online_tests: "Online tests",
  video_interview: "Video interviews",
  behavioural_interview: "Behavioural interviews",
  assessment_centre: "Assessment centres",
  motivation_commercial_awareness: "Motivation and commercial awareness",
  professional_communication: "Professional communication",
  application_planning: "Application planning",
} as const;

export const supportNeeds = {
  structured_plan: "A structured preparation plan",
  feedback: "Feedback on my preparation",
  interview_practice: "Interview practice",
  assessment_centre_practice: "Assessment-centre practice",
  accountability: "Accountability and staying on track",
  international_student_guidance: "International-student guidance",
} as const;

export const confidenceLevels = {
  building: "I am building confidence",
  mixed: "My confidence varies by task",
  confident: "I feel confident overall",
} as const;

const enumKeys = <T extends Record<string, string>>(values: T) =>
  Object.keys(values) as [keyof T & string, ...(keyof T & string)[]];

const educationSchema = z.enum(enumKeys(educationStages));
const opportunitySchema = z.enum(enumKeys(opportunityTypes));
const industrySchema = z.enum(enumKeys(industries));
const prioritySchema = z.enum(enumKeys(preparationPriorities));
const supportSchema = z.enum(enumKeys(supportNeeds));
const confidenceSchema = z.enum(enumKeys(confidenceLevels));

export type OnboardingAnswers = Readonly<{
  confidence: z.infer<typeof confidenceSchema> | null;
  educationStage: z.infer<typeof educationSchema> | null;
  industries: readonly z.infer<typeof industrySchema>[];
  opportunityTypes: readonly z.infer<typeof opportunitySchema>[];
  preparationPriorities: readonly z.infer<typeof prioritySchema>[];
  supportNeeds: readonly z.infer<typeof supportSchema>[];
  targetCompanies: readonly string[];
}>;

export type OnboardingIntent = "complete" | "save";

export type OnboardingField = keyof OnboardingAnswers;
export type OnboardingFieldErrors = Partial<Record<OnboardingField, readonly string[]>>;

const inputSchema = z
  .object({
    confidence: confidenceSchema.nullable().optional().default(null),
    educationStage: educationSchema.nullable().optional().default(null),
    industries: z.array(industrySchema).max(8).default([]),
    intent: z.enum(["complete", "save"]),
    opportunityTypes: z.array(opportunitySchema).max(4).default([]),
    preparationPriorities: z.array(prioritySchema).max(8).default([]),
    supportNeeds: z.array(supportSchema).max(6).default([]),
    targetCompanies: z.array(z.string().max(320)).max(10).default([]),
  })
  .strict();

export type ParsedOnboardingInput = Readonly<{
  answers: OnboardingAnswers;
  intent: OnboardingIntent;
}>;

function normalizeCompanies(companies: readonly string[]): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const company of companies) {
    const value = company.normalize("NFC").trim().replace(/\s+/g, " ");
    if (!value) continue;
    const key = value.toLocaleLowerCase("en-GB");
    if (!seen.has(key)) {
      normalized.push(value);
      seen.add(key);
    }
  }
  return normalized;
}

export function parseOnboardingInput(
  input: unknown,
):
  | Readonly<{ ok: true; value: ParsedOnboardingInput }>
  | Readonly<{ errors: OnboardingFieldErrors; ok: false }> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string") (errors[field] ??= []).push("Choose an approved value.");
    }
    return { errors: errors as OnboardingFieldErrors, ok: false };
  }

  const answers: OnboardingAnswers = {
    confidence: parsed.data.confidence,
    educationStage: parsed.data.educationStage,
    industries: [...new Set(parsed.data.industries)],
    opportunityTypes: [...new Set(parsed.data.opportunityTypes)],
    preparationPriorities: [...new Set(parsed.data.preparationPriorities)],
    supportNeeds: [...new Set(parsed.data.supportNeeds)],
    targetCompanies: normalizeCompanies(parsed.data.targetCompanies),
  };
  if (answers.targetCompanies.some((company) => Array.from(company).length > 80)) {
    return {
      errors: { targetCompanies: ["Each company name must be 80 characters or fewer."] },
      ok: false,
    };
  }
  return { ok: true, value: { answers, intent: parsed.data.intent } };
}

export function completionErrors(answers: OnboardingAnswers): OnboardingFieldErrors {
  const errors: OnboardingFieldErrors = {};
  if (!answers.educationStage) errors.educationStage = ["Choose your education or career stage."];
  if (answers.opportunityTypes.length === 0)
    errors.opportunityTypes = ["Choose at least one opportunity type."];
  if (answers.industries.length === 0) errors.industries = ["Choose at least one target industry."];
  if (answers.preparationPriorities.length === 0)
    errors.preparationPriorities = ["Choose at least one preparation priority."];
  return errors;
}

export function isOnboardingComplete(answers: OnboardingAnswers): boolean {
  return Object.keys(completionErrors(answers)).length === 0;
}

export function onboardingAnswersEqual(left: OnboardingAnswers, right: OnboardingAnswers): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
