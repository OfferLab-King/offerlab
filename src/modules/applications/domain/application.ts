import { z } from "zod";

import { opportunityTypes, type OpportunityType } from "../../taxonomy/domain/opportunity-types";
import { industries, type Industry } from "../../taxonomy/domain/industries";

export const recruitmentStages = {
  preparing: "Preparing",
  applied: "Applied",
  online_assessment: "Online assessment",
  video_interview: "Video interview",
  interview: "Interview",
  assessment_centre: "Assessment centre",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
} as const;

export type RecruitmentStage = keyof typeof recruitmentStages;

export type ApplicationValues = Readonly<{
  appliedDate: string | null;
  applicationDeadline: string | null;
  company: string;
  companyId: string | null;
  industry: Industry | null;
  location: string | null;
  nextStageDeadline: string | null;
  notes: string | null;
  opportunityType: OpportunityType;
  role: string;
  stage: RecruitmentStage;
}>;

export type ApplicationField = keyof ApplicationValues | "version";
export type ApplicationFieldErrors = Partial<Record<ApplicationField, readonly string[]>>;

const enumKeys = <T extends Record<string, string>>(values: T) =>
  Object.keys(values) as [keyof T & string, ...(keyof T & string)[]];

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value: string): boolean {
  if (!isoDate.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day
  );
}

const inputSchema = z
  .object({
    appliedDate: z.string().nullable().optional().default(null),
    applicationDeadline: z.string().nullable().optional().default(null),
    company: z.string(),
    companyId: z.string().uuid().nullable().optional().default(null),
    industry: z.enum(enumKeys(industries)).nullable().optional().default(null),
    location: z.string().nullable().optional().default(null),
    nextStageDeadline: z.string().nullable().optional().default(null),
    notes: z.string().nullable().optional().default(null),
    opportunityType: z.enum(enumKeys(opportunityTypes)),
    role: z.string(),
    stage: z.enum(enumKeys(recruitmentStages)),
    version: z.number().int().positive().optional(),
  })
  .strict();

function normalizeDisplayText(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/gu, " ");
}

function normalizeOptionalDisplayText(value: string | null): string | null {
  if (value === null) return null;
  return normalizeDisplayText(value) || null;
}

function normalizeNotes(value: string | null): string | null {
  if (value === null) return null;
  const normalized = value.replace(/\r\n?/g, "\n").trim();
  return normalized || null;
}

function pushError(errors: ApplicationFieldErrors, field: ApplicationField, message: string): void {
  (errors as Record<string, readonly string[]>)[field] = [message];
}

export type ParsedApplicationInput = Readonly<{
  values: ApplicationValues;
  version: number | undefined;
}>;

export function parseApplicationInput(
  input: unknown,
  requireVersion = false,
):
  | Readonly<{ errors: ApplicationFieldErrors; ok: false }>
  | Readonly<{ ok: true; value: ParsedApplicationInput }> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    const errors: ApplicationFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field !== "string") continue;
      const message =
        field === "opportunityType"
          ? "Choose an approved opportunity type."
          : field === "industry"
            ? "Choose an approved industry."
            : field === "stage"
              ? "Choose an approved recruitment stage."
              : field === "version"
                ? "Reload this application and try again."
                : "Enter a valid value.";
      pushError(errors, field as ApplicationField, message);
    }
    return { errors, ok: false };
  }

  const values: ApplicationValues = {
    appliedDate: parsed.data.appliedDate || null,
    applicationDeadline: parsed.data.applicationDeadline || null,
    company: normalizeDisplayText(parsed.data.company),
    companyId: parsed.data.companyId,
    location: normalizeOptionalDisplayText(parsed.data.location),
    nextStageDeadline: parsed.data.nextStageDeadline || null,
    industry: parsed.data.industry,
    notes: normalizeNotes(parsed.data.notes),
    opportunityType: parsed.data.opportunityType,
    role: normalizeDisplayText(parsed.data.role),
    stage: parsed.data.stage,
  };
  const errors: ApplicationFieldErrors = {};
  if (!values.company) pushError(errors, "company", "Enter a company name.");
  else if (Array.from(values.company).length > 120)
    pushError(errors, "company", "Company must be 120 characters or fewer.");
  if (!values.role) pushError(errors, "role", "Enter a role title.");
  else if (Array.from(values.role).length > 160)
    pushError(errors, "role", "Role must be 160 characters or fewer.");
  if (values.location && Array.from(values.location).length > 120)
    pushError(errors, "location", "Location must be 120 characters or fewer.");
  if (values.notes && Array.from(values.notes).length > 2_000)
    pushError(errors, "notes", "Notes must be 2,000 characters or fewer.");
  for (const [field, value] of [
    ["applicationDeadline", values.applicationDeadline],
    ["appliedDate", values.appliedDate],
    ["nextStageDeadline", values.nextStageDeadline],
  ] as const) {
    if (value && !validDate(value)) pushError(errors, field, "Enter a valid date.");
  }
  if (requireVersion && parsed.data.version === undefined)
    pushError(errors, "version", "Reload this application and try again.");
  if (Object.keys(errors).length > 0) return { errors, ok: false };
  return { ok: true, value: { values, version: parsed.data.version } };
}

export function applicationValuesEqual(left: ApplicationValues, right: ApplicationValues): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function isApplicationId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
