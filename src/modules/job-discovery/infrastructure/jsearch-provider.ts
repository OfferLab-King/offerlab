import "server-only";

import { z } from "zod";
import {
  jobSalaryPeriodValues,
  jobSearchEmploymentTypeValues,
  type JobSearchListing,
  type JobSearchProvider,
  type JobSearchRequest,
  type JobSearchResult,
} from "../domain/job-search";

const jsearchEndpoint = "https://api.openwebninja.com/jsearch/search-v2";
export const jsearchTimeoutMs = 12_000;

export const jobDiscoveryEnvironmentValues = ["local", "test", "staging", "production"] as const;

export type JSearchProviderConfiguration = Readonly<{
  apiKey: string;
  appEnvironment: (typeof jobDiscoveryEnvironmentValues)[number];
  productionUseApproved: boolean;
}>;

export type JobDiscoveryProviderErrorCode =
  | "job_discovery_production_not_approved"
  | "job_discovery_provider_invalid_response"
  | "job_discovery_provider_rate_limited"
  | "job_discovery_provider_timeout"
  | "job_discovery_provider_unauthorized"
  | "job_discovery_provider_unavailable";

export class JobDiscoveryProviderError extends Error {
  public readonly code: JobDiscoveryProviderErrorCode;

  public constructor(code: JobDiscoveryProviderErrorCode) {
    super(code);
    this.code = code;
    this.name = "JobDiscoveryProviderError";
  }
}

const configurationSchema = z
  .object({
    apiKey: z.string().trim().min(1).max(1024),
    appEnvironment: z.enum(jobDiscoveryEnvironmentValues),
    productionUseApproved: z.boolean(),
  })
  .strict();

function safeHttpUrlSchema() {
  return z
    .string()
    .trim()
    .min(1)
    .max(4096)
    .transform((value, context) => {
      try {
        const url = new URL(value);
        if (!(["http:", "https:"] as const).includes(url.protocol as "http:" | "https:")) {
          context.addIssue({ code: "custom", message: "Only HTTP(S) URLs are accepted." });
          return z.NEVER;
        }
        if (url.username || url.password) {
          context.addIssue({ code: "custom", message: "Credential-bearing URLs are rejected." });
          return z.NEVER;
        }
        return url.toString();
      } catch {
        context.addIssue({ code: "custom", message: "Invalid URL." });
        return z.NEVER;
      }
    });
}

const optionalText = (maximumLength: number) => z.string().max(maximumLength).nullable().optional();

const utcDateTimeSchema = z
  .string()
  .max(64)
  .refine(
    (value) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u.test(value),
    "Expected an ISO 8601 UTC timestamp.",
  )
  .refine((value) => Number.isFinite(Date.parse(value)), "Expected a valid UTC timestamp.")
  .transform((value) => new Date(value).toISOString());

const applyOptionSchema = z.object({
  apply_link: safeHttpUrlSchema(),
  is_direct: z.boolean().optional().default(false),
  publisher: z.string().trim().min(1).max(300),
});

const providerJobSchema = z.object({
  apply_options: z.array(applyOptionSchema).max(20).optional().default([]),
  employer_name: z.string().trim().min(1).max(300),
  job_apply_is_direct: z.boolean().optional().default(false),
  job_apply_link: safeHttpUrlSchema(),
  job_city: optionalText(200),
  job_country: z.string().trim().length(2).nullable().optional(),
  job_description: optionalText(50_000),
  job_employment_type: optionalText(120),
  job_employment_types: z
    .array(z.enum(jobSearchEmploymentTypeValues))
    .max(jobSearchEmploymentTypeValues.length)
    .optional()
    .default([]),
  job_highlights: z
    .record(z.string().min(1).max(100), z.array(z.string().max(1000)).max(30))
    .optional()
    .default({}),
  job_id: z.string().trim().min(1).max(1024),
  job_is_remote: z.boolean().nullable().optional(),
  job_location: optionalText(500),
  job_max_salary: z.number().finite().nonnegative().nullable().optional(),
  job_min_salary: z.number().finite().nonnegative().nullable().optional(),
  job_posted_at: optionalText(120),
  job_posted_at_datetime_utc: utcDateTimeSchema.nullable().optional(),
  job_publisher: z.string().trim().min(1).max(300),
  job_salary: optionalText(500),
  job_salary_period: z.enum(jobSalaryPeriodValues).nullable().optional(),
  job_title: z.string().trim().min(1).max(300),
});

const providerResponseSchema = z.object({
  data: z.object({
    cursor: z.string().min(1).max(2048).nullable().optional(),
    jobs: z.array(providerJobSchema).max(10),
  }),
  parameters: z.object({}).passthrough(),
  request_id: z.string().trim().min(1).max(200),
  status: z.literal("OK"),
});

type ProviderJob = z.output<typeof providerJobSchema>;
type FetchLike = typeof fetch;

function compactText(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function nullableText(value: string | null | undefined, preserveLineBreaks = false): string | null {
  if (value === null || value === undefined) return null;
  const normalized = preserveLineBreaks ? value.trim() : compactText(value);
  return normalized || null;
}

function normalizeJob(job: ProviderJob): JobSearchListing {
  return {
    applyOptions: job.apply_options.map((option) => ({
      direct: option.is_direct,
      publisher: compactText(option.publisher),
      url: option.apply_link,
    })),
    applyUrl: job.job_apply_link,
    city: nullableText(job.job_city),
    country: job.job_country?.toUpperCase() ?? null,
    description: nullableText(job.job_description, true),
    directApply: job.job_apply_is_direct,
    employerName: compactText(job.employer_name),
    employmentType: nullableText(job.job_employment_type),
    employmentTypes: job.job_employment_types,
    highlights: Object.fromEntries(
      Object.entries(job.job_highlights).map(([heading, items]) => [
        compactText(heading),
        items.map(compactText).filter(Boolean),
      ]),
    ),
    id: job.job_id,
    isRemote: job.job_is_remote ?? null,
    location: nullableText(job.job_location),
    postedAt: nullableText(job.job_posted_at),
    postedAtUtc: job.job_posted_at_datetime_utc ?? null,
    publisher: compactText(job.job_publisher),
    salaryMaximum: job.job_max_salary ?? null,
    salaryMinimum: job.job_min_salary ?? null,
    salaryPeriod: job.job_salary_period ?? null,
    salaryText: nullableText(job.job_salary),
    title: compactText(job.job_title),
  };
}

function buildSearchUrl(input: JobSearchRequest): URL {
  const url = new URL(jsearchEndpoint);
  url.searchParams.set("query", `${input.role} jobs in ${input.location}`);
  url.searchParams.set("country", "gb");
  url.searchParams.set("language", "en");
  url.searchParams.set("num_pages", "1");
  url.searchParams.set("date_posted", input.datePosted);
  url.searchParams.set("work_from_home", String(input.remoteOnly));
  if (input.cursor) url.searchParams.set("cursor", input.cursor);
  if (input.employmentTypes.length)
    url.searchParams.set("employment_types", input.employmentTypes.join(","));
  if (input.jobRequirements.length)
    url.searchParams.set("job_requirements", input.jobRequirements.join(","));
  if (input.radiusKm !== undefined) url.searchParams.set("radius", String(input.radiusKm));
  return url;
}

function statusError(status: number): JobDiscoveryProviderError {
  if (status === 401 || status === 403)
    return new JobDiscoveryProviderError("job_discovery_provider_unauthorized");
  if (status === 429) return new JobDiscoveryProviderError("job_discovery_provider_rate_limited");
  return new JobDiscoveryProviderError("job_discovery_provider_unavailable");
}

export function createJSearchProvider(
  configurationInput: JSearchProviderConfiguration,
  fetchImplementation: FetchLike = fetch,
): JobSearchProvider {
  const configuration = configurationSchema.parse(configurationInput);
  if (configuration.appEnvironment === "production" && !configuration.productionUseApproved)
    throw new JobDiscoveryProviderError("job_discovery_production_not_approved");

  return {
    async search(input: JobSearchRequest): Promise<JobSearchResult> {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), jsearchTimeoutMs);
      try {
        const response = await fetchImplementation(buildSearchUrl(input), {
          cache: "no-store",
          headers: {
            accept: "application/json",
            "x-api-key": configuration.apiKey,
          },
          method: "GET",
          signal: controller.signal,
        });
        if (!response.ok) throw statusError(response.status);

        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          throw new JobDiscoveryProviderError("job_discovery_provider_invalid_response");
        }
        const parsed = providerResponseSchema.safeParse(payload);
        if (!parsed.success)
          throw new JobDiscoveryProviderError("job_discovery_provider_invalid_response");
        return {
          jobs: parsed.data.data.jobs.map(normalizeJob),
          nextCursor: parsed.data.data.cursor ?? null,
        };
      } catch (error) {
        if (error instanceof JobDiscoveryProviderError) throw error;
        if (controller.signal.aborted)
          throw new JobDiscoveryProviderError("job_discovery_provider_timeout");
        throw new JobDiscoveryProviderError("job_discovery_provider_unavailable");
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
