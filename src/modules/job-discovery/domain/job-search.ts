import { z } from "zod";

export const jobSearchDatePostedValues = ["all", "today", "3days", "week", "month"] as const;
export const jobSearchEmploymentTypeValues = [
  "FULLTIME",
  "CONTRACTOR",
  "PARTTIME",
  "INTERN",
] as const;
export const jobSearchRequirementValues = [
  "under_3_years_experience",
  "more_than_3_years_experience",
  "no_experience",
  "no_degree",
] as const;
export const jobSalaryPeriodValues = ["HOUR", "DAY", "WEEK", "MONTH", "YEAR"] as const;

const controlCharacters = /[\u0000-\u001f\u007f]/u;

function searchText(maximumLength: number) {
  return z
    .string()
    .trim()
    .min(2)
    .max(maximumLength)
    .refine((value) => !controlCharacters.test(value), "Control characters are not allowed.")
    .transform((value) => value.replace(/\s+/gu, " "));
}

const uniqueValues = <Value extends string>(values: readonly Value[]): Value[] => [
  ...new Set(values),
];

export const jobSearchRequestSchema = z
  .object({
    cursor: z
      .string()
      .trim()
      .min(1)
      .max(2048)
      .refine((value) => !controlCharacters.test(value), "Invalid cursor.")
      .optional(),
    datePosted: z.enum(jobSearchDatePostedValues).default("all"),
    employmentTypes: z
      .array(z.enum(jobSearchEmploymentTypeValues))
      .max(jobSearchEmploymentTypeValues.length)
      .default([])
      .transform(uniqueValues),
    jobRequirements: z
      .array(z.enum(jobSearchRequirementValues))
      .max(jobSearchRequirementValues.length)
      .default([])
      .transform(uniqueValues),
    location: searchText(120),
    radiusKm: z.number().int().min(1).max(200).optional(),
    remoteOnly: z.boolean().default(false),
    role: searchText(120),
  })
  .strict();

export type JobSearchRequest = z.output<typeof jobSearchRequestSchema>;
export type JobSearchDatePosted = (typeof jobSearchDatePostedValues)[number];
export type JobSearchEmploymentType = (typeof jobSearchEmploymentTypeValues)[number];
export type JobSearchRequirement = (typeof jobSearchRequirementValues)[number];
export type JobSalaryPeriod = (typeof jobSalaryPeriodValues)[number];

export function parseJobSearchRequest(input: unknown): JobSearchRequest {
  return jobSearchRequestSchema.parse(input);
}

export type JobApplyOption = Readonly<{
  direct: boolean;
  publisher: string;
  url: string;
}>;

export type JobSearchListing = Readonly<{
  applyOptions: readonly JobApplyOption[];
  applyUrl: string;
  city: string | null;
  country: string | null;
  description: string | null;
  directApply: boolean;
  employerName: string;
  employmentType: string | null;
  employmentTypes: readonly JobSearchEmploymentType[];
  highlights: Readonly<Record<string, readonly string[]>>;
  id: string;
  isRemote: boolean | null;
  location: string | null;
  postedAt: string | null;
  postedAtUtc: string | null;
  publisher: string;
  salaryMaximum: number | null;
  salaryMinimum: number | null;
  salaryPeriod: JobSalaryPeriod | null;
  salaryText: string | null;
  title: string;
}>;

export type JobSearchResult = Readonly<{
  jobs: readonly JobSearchListing[];
  nextCursor: string | null;
}>;

export interface JobSearchProvider {
  search(input: JobSearchRequest): Promise<JobSearchResult>;
}
