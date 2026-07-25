import { z } from "zod";
import { recruitmentStages } from "../../applications/domain/application";
import { industries } from "../../taxonomy/domain/industries";
import { opportunityTypes } from "../../taxonomy/domain/opportunity-types";

const keys = <T extends Record<string, string>>(values: T) =>
  Object.keys(values) as [keyof T & string, ...(keyof T & string)[]];
const clean = (value: string) => value.normalize("NFC").trim().replace(/\s+/gu, " ");

const schema = z
  .object({
    approximateDate: z.string().date(),
    assessedSkills: z.array(z.string()).min(1).max(10),
    formatSummary: z.string(),
    industry: z.enum(keys(industries)).nullable(),
    opportunityType: z.enum(keys(opportunityTypes)).nullable(),
    recruitmentCycle: z.string().regex(/^\d{4}\/\d{2}$/),
    recruitmentStage: z.enum(keys(recruitmentStages)),
    reflection: z.string(),
    themes: z.string(),
  })
  .strict();

export type ReportValues = z.infer<typeof schema>;
export type ReportErrors = Partial<Record<keyof ReportValues, readonly string[]>>;

export function parseReport(
  input: unknown,
): Readonly<{ errors: ReportErrors; ok: false }> | Readonly<{ ok: true; value: ReportValues }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const errors: ReportErrors = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof ReportValues;
      errors[field] = ["Enter a valid value."];
    }
    return { errors, ok: false };
  }
  const value = {
    ...parsed.data,
    assessedSkills: [...new Set(parsed.data.assessedSkills.map(clean).filter(Boolean))],
    formatSummary: clean(parsed.data.formatSummary),
    reflection: clean(parsed.data.reflection),
    themes: clean(parsed.data.themes),
  };
  const errors: ReportErrors = {};
  if (!value.formatSummary || value.formatSummary.length > 200)
    errors.formatSummary = ["Summarise the format in 200 characters or fewer."];
  if (!value.themes || value.themes.length > 1000)
    errors.themes = ["Describe the themes in 1,000 characters or fewer."];
  if (!value.reflection || value.reflection.length > 1500)
    errors.reflection = ["Add a useful reflection in 1,500 characters or fewer."];
  if (!value.assessedSkills.length || value.assessedSkills.some((skill) => skill.length > 80))
    errors.assessedSkills = ["Add 1–10 short assessed skills."];
  if (Object.keys(errors).length) return { errors, ok: false };
  return { ok: true, value };
}
