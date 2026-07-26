import { z } from "zod";
import { recruitmentStages } from "../../applications/domain/application";
import { industries } from "../../taxonomy/domain/industries";
import { opportunityTypes } from "../../taxonomy/domain/opportunity-types";

const keys = <T extends Record<string, string>>(values: T) =>
  Object.keys(values) as [keyof T & string, ...(keyof T & string)[]];
const clean = (value: string) => value.normalize("NFC").trim().replace(/\s+/gu, " ");
const optional = (value: string | null) => (value === null ? null : clean(value) || null);

export const reportSourceKinds = ["member", "coach_curated"] as const;
export type ReportSourceKind = (typeof reportSourceKinds)[number];

const schema = z
  .object({
    approximateDate: z.string().date(),
    assessedSkills: z.array(z.string()).min(1).max(10),
    companyName: z.string(),
    confidentialityConfirmed: z.literal(true),
    formatSummary: z.string(),
    industry: z.enum(keys(industries)).nullable(),
    location: z.string().nullable(),
    opportunityType: z.enum(keys(opportunityTypes)).nullable(),
    outcome: z.string().nullable(),
    preparationAdvice: z.string(),
    recruitmentCycle: z.string().regex(/^\d{4}\/\d{2}$/),
    recruitmentStage: z.enum(keys(recruitmentStages)),
    reflection: z.string(),
    roleTitle: z.string(),
    themes: z.string(),
  })
  .strict();

type ParsedReportValues = z.infer<typeof schema>;
export type ReportValues = Omit<ParsedReportValues, "confidentialityConfirmed"> &
  Readonly<{ sourceKind: ReportSourceKind }>;
export type ReportErrors = Partial<Record<keyof ParsedReportValues, readonly string[]>>;

export type ReportFilters = Readonly<{
  cycle?: string;
  industry?: string;
  query: string;
  stage?: string;
}>;

export function parseReportFilters(params: URLSearchParams): ReportFilters {
  const query = clean(params.get("q") ?? "").slice(0, 120);
  const stage = params.get("stage") ?? "";
  const industry = params.get("industry") ?? "";
  const cycle = params.get("cycle") ?? "";
  return {
    ...(cycle && /^\d{4}\/\d{2}$/.test(cycle) ? { cycle } : {}),
    ...(industry && industry in industries ? { industry } : {}),
    query,
    ...(stage && stage in recruitmentStages ? { stage } : {}),
  };
}

export function createReportSlug(
  companyName: string,
  recruitmentStage: string,
  id: string,
): string {
  const stem = `${clean(companyName)}-${recruitmentStage}`
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 150)
    .replace(/-$/u, "");
  return `${stem || "candidate-experience"}-${id.replaceAll("-", "").slice(0, 12)}`;
}

export function parseReport(
  input: unknown,
  sourceKind: ReportSourceKind = "member",
): Readonly<{ errors: ReportErrors; ok: false }> | Readonly<{ ok: true; value: ReportValues }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const errors: ReportErrors = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof ParsedReportValues;
      errors[field] = ["Enter a valid value."];
    }
    return { errors, ok: false };
  }
  const value: ReportValues = {
    ...parsed.data,
    assessedSkills: [...new Set(parsed.data.assessedSkills.map(clean).filter(Boolean))],
    companyName: clean(parsed.data.companyName),
    formatSummary: clean(parsed.data.formatSummary),
    location: optional(parsed.data.location),
    outcome: optional(parsed.data.outcome),
    preparationAdvice: clean(parsed.data.preparationAdvice),
    reflection: clean(parsed.data.reflection),
    roleTitle: clean(parsed.data.roleTitle),
    sourceKind,
    themes: clean(parsed.data.themes),
  };
  const errors: ReportErrors = {};
  if (!value.companyName || value.companyName.length > 160)
    errors.companyName = ["Enter the employer name in 160 characters or fewer."];
  if (!value.roleTitle || value.roleTitle.length > 160)
    errors.roleTitle = ["Enter the role or programme in 160 characters or fewer."];
  if (value.location && value.location.length > 120)
    errors.location = ["Enter the location in 120 characters or fewer."];
  if (!value.formatSummary || value.formatSummary.length > 200)
    errors.formatSummary = ["Summarise the format in 200 characters or fewer."];
  if (!value.themes || value.themes.length > 1000)
    errors.themes = ["Describe the themes in 1,000 characters or fewer."];
  if (!value.reflection || value.reflection.length > 1500)
    errors.reflection = ["Add a useful reflection in 1,500 characters or fewer."];
  if (!value.preparationAdvice || value.preparationAdvice.length > 1500)
    errors.preparationAdvice = ["Add practical preparation advice in 1,500 characters or fewer."];
  if (value.outcome && value.outcome.length > 500)
    errors.outcome = ["Keep the optional outcome to 500 characters or fewer."];
  if (!value.assessedSkills.length || value.assessedSkills.some((skill) => skill.length > 80))
    errors.assessedSkills = ["Add 1–10 short assessed skills."];
  if (Object.keys(errors).length) return { errors, ok: false };
  return { ok: true, value };
}
