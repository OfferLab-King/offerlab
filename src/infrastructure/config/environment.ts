import { z } from "zod";
import { isLoopbackUrl } from "./local-development";

export const environmentKeys = [
  "NODE_ENV",
  "APP_ENV",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "AUTH_RATE_LIMIT_SECRET",
  "ANSWER_COACH_ENABLED",
  "ANSWER_COACH_PROVIDER",
  "ANSWER_COACH_MODEL_DATA_APPROVED",
  "CAREER_DOCUMENT_AI_ENABLED",
  "CAREER_DOCUMENT_PROVIDER",
  "CAREER_DOCUMENT_MODEL_DATA_APPROVED",
  "CAREER_DOCUMENT_REVIEW_HOSTED_ACCOUNT_MONTHLY_LIMIT",
  "CAREER_DOCUMENT_REVIEW_MEMBER_DAILY_LIMIT",
  "CAREER_DOCUMENT_REVIEW_MEMBER_MONTHLY_LIMIT",
  "DEEPSEEK_API_KEY",
  "DEEPSEEK_BASE_URL",
  "DEEPSEEK_MODEL",
  "DATABASE_URL",
  "IDENTITY_SYNC_DATABASE_URL",
  "JOB_BROWSER_MAX_CONCURRENCY",
  "JOB_CATALOG_ENABLED",
  "JOB_CRAWLER_DATABASE_URL",
  "JOB_CRAWLER_FAILURE_PAUSE_THRESHOLD",
  "JOB_CRAWLER_MAX_CONCURRENCY",
  "JOB_CRAWLER_MAX_DETAIL_PAGES",
  "JOB_CRAWLER_MAX_JOBS_PER_SOURCE",
  "JOB_CRAWLER_MISSING_THRESHOLD",
  "JOB_CRAWLER_MODEL_DATA_APPROVED",
  "JOB_CRAWLER_ROBOTS_CACHE_TTL_MS",
  "JOB_CRAWLER_TIMEOUT_MS",
  "JOB_CRAWLER_USER_AGENT",
  "JOB_ENRICHMENT_BATCH_LIMIT",
  "JOB_ENRICHMENT_PROMPT_VERSION",
  "JOB_LLM_ENABLED",
  "JOB_LLM_MAX_CONCURRENCY",
  "JSEARCH_API_KEY",
  "JSEARCH_ACCOUNT_MONTHLY_LIMIT",
  "JSEARCH_COMMERCIAL_USE_APPROVED",
  "JSEARCH_ENABLED",
  "JSEARCH_MEMBER_DAILY_LIMIT",
  "JSEARCH_MEMBER_MONTHLY_LIMIT",
  "LOCAL_AUTH_BYPASS_ENABLED",
  "LOG_LEVEL",
] as const;

const optionalUrl = z.preprocess((value) => (value === "" ? undefined : value), z.url().optional());
const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);
const optionalPositiveInteger = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z
    .string()
    .regex(/^(?:[1-9]\d{0,4}|100000)$/u)
    .optional(),
);

const serverEnvironmentSchema = z
  .object({
    APP_ENV: z.enum(["local", "test", "staging", "production"]),
    ANSWER_COACH_ENABLED: z.enum(["true", "false"]).optional(),
    ANSWER_COACH_MODEL_DATA_APPROVED: z.enum(["true", "false"]).optional(),
    ANSWER_COACH_PROVIDER: z.enum(["local", "deepseek"]).optional(),
    AUTH_RATE_LIMIT_SECRET: optionalString,
    CAREER_DOCUMENT_AI_ENABLED: z.enum(["true", "false"]).optional(),
    CAREER_DOCUMENT_MODEL_DATA_APPROVED: z.enum(["true", "false"]).optional(),
    CAREER_DOCUMENT_PROVIDER: z.enum(["local", "deepseek"]).optional(),
    CAREER_DOCUMENT_REVIEW_HOSTED_ACCOUNT_MONTHLY_LIMIT: optionalPositiveInteger,
    CAREER_DOCUMENT_REVIEW_MEMBER_DAILY_LIMIT: optionalPositiveInteger,
    CAREER_DOCUMENT_REVIEW_MEMBER_MONTHLY_LIMIT: optionalPositiveInteger,
    DATABASE_URL: optionalString,
    DEEPSEEK_API_KEY: optionalString,
    DEEPSEEK_BASE_URL: optionalUrl,
    DEEPSEEK_MODEL: optionalString,
    IDENTITY_SYNC_DATABASE_URL: optionalString,
    JOB_BROWSER_MAX_CONCURRENCY: optionalPositiveInteger,
    JOB_CATALOG_ENABLED: z.enum(["true", "false"]).optional(),
    JOB_CRAWLER_DATABASE_URL: optionalString,
    JOB_CRAWLER_FAILURE_PAUSE_THRESHOLD: optionalPositiveInteger,
    JOB_CRAWLER_MAX_CONCURRENCY: optionalPositiveInteger,
    JOB_CRAWLER_MAX_DETAIL_PAGES: optionalPositiveInteger,
    JOB_CRAWLER_MAX_JOBS_PER_SOURCE: optionalPositiveInteger,
    JOB_CRAWLER_MISSING_THRESHOLD: optionalPositiveInteger,
    JOB_CRAWLER_MODEL_DATA_APPROVED: z.enum(["true", "false"]).optional(),
    JOB_CRAWLER_ROBOTS_CACHE_TTL_MS: optionalPositiveInteger,
    JOB_CRAWLER_TIMEOUT_MS: optionalPositiveInteger,
    JOB_CRAWLER_USER_AGENT: optionalString,
    JOB_ENRICHMENT_BATCH_LIMIT: optionalPositiveInteger,
    JOB_ENRICHMENT_PROMPT_VERSION: optionalPositiveInteger,
    JOB_LLM_ENABLED: z.enum(["true", "false"]).optional(),
    JOB_LLM_MAX_CONCURRENCY: optionalPositiveInteger,
    JSEARCH_ACCOUNT_MONTHLY_LIMIT: optionalPositiveInteger,
    JSEARCH_API_KEY: optionalString,
    JSEARCH_COMMERCIAL_USE_APPROVED: z.enum(["true", "false"]).optional(),
    JSEARCH_ENABLED: z.enum(["true", "false"]).optional(),
    JSEARCH_MEMBER_DAILY_LIMIT: optionalPositiveInteger,
    JSEARCH_MEMBER_MONTHLY_LIMIT: optionalPositiveInteger,
    LOCAL_AUTH_BYPASS_ENABLED: z.enum(["true", "false"]).optional(),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]),
    NEXT_PUBLIC_APP_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NODE_ENV: z.enum(["development", "test", "production"]),
  })
  .superRefine((environment, context) => {
    if (
      environment.LOCAL_AUTH_BYPASS_ENABLED === "true" &&
      (environment.APP_ENV !== "local" ||
        environment.NODE_ENV !== "development" ||
        !isLoopbackUrl(environment.NEXT_PUBLIC_APP_URL))
    ) {
      context.addIssue({
        code: "custom",
        message: "LOCAL_AUTH_BYPASS_ENABLED=true is allowed only for loopback local development",
        path: ["LOCAL_AUTH_BYPASS_ENABLED"],
      });
    }
    if (environment.APP_ENV === "production") {
      if (environment.JOB_CATALOG_ENABLED === "true" && !environment.JOB_CRAWLER_DATABASE_URL) {
        context.addIssue({
          code: "custom",
          message: "JOB_CRAWLER_DATABASE_URL is required when the job catalog is enabled",
          path: ["JOB_CRAWLER_DATABASE_URL"],
        });
      }
      for (const key of [
        "DATABASE_URL",
        "IDENTITY_SYNC_DATABASE_URL",
        "AUTH_RATE_LIMIT_SECRET",
      ] as const) {
        if (!environment[key]) {
          context.addIssue({
            code: "custom",
            message: `${key} is required in production`,
            path: [key],
          });
        }
      }
      if (
        environment.ANSWER_COACH_PROVIDER === "deepseek" &&
        environment.ANSWER_COACH_MODEL_DATA_APPROVED !== "true"
      ) {
        context.addIssue({
          code: "custom",
          message: "ANSWER_COACH_MODEL_DATA_APPROVED=true is required for DeepSeek in production",
          path: ["ANSWER_COACH_MODEL_DATA_APPROVED"],
        });
      }
      if (
        environment.CAREER_DOCUMENT_AI_ENABLED !== "false" &&
        environment.CAREER_DOCUMENT_PROVIDER === "deepseek" &&
        environment.CAREER_DOCUMENT_MODEL_DATA_APPROVED !== "true"
      ) {
        context.addIssue({
          code: "custom",
          message:
            "CAREER_DOCUMENT_MODEL_DATA_APPROVED=true is required for DeepSeek document review in production",
          path: ["CAREER_DOCUMENT_MODEL_DATA_APPROVED"],
        });
      }
      if (
        environment.CAREER_DOCUMENT_AI_ENABLED !== "false" &&
        environment.CAREER_DOCUMENT_PROVIDER === "deepseek" &&
        environment.DEEPSEEK_BASE_URL &&
        new URL(environment.DEEPSEEK_BASE_URL).protocol !== "https:"
      ) {
        context.addIssue({
          code: "custom",
          message: "DEEPSEEK_BASE_URL must use HTTPS for production document review",
          path: ["DEEPSEEK_BASE_URL"],
        });
      }
      if (
        environment.JSEARCH_ENABLED === "true" &&
        environment.JSEARCH_COMMERCIAL_USE_APPROVED !== "true"
      ) {
        context.addIssue({
          code: "custom",
          message: "JSEARCH_COMMERCIAL_USE_APPROVED=true is required for JSearch in production",
          path: ["JSEARCH_COMMERCIAL_USE_APPROVED"],
        });
      }
      if (
        environment.JOB_CATALOG_ENABLED === "true" &&
        environment.DEEPSEEK_API_KEY &&
        environment.JOB_LLM_ENABLED === "true" &&
        environment.JOB_CRAWLER_MODEL_DATA_APPROVED !== "true"
      ) {
        context.addIssue({
          code: "custom",
          message:
            "JOB_CRAWLER_MODEL_DATA_APPROVED=true is required for job enrichment via DeepSeek in production",
          path: ["JOB_CRAWLER_MODEL_DATA_APPROVED"],
        });
      }
      if (
        environment.JOB_CATALOG_ENABLED === "true" &&
        environment.JOB_LLM_ENABLED === "true" &&
        environment.DEEPSEEK_BASE_URL &&
        new URL(environment.DEEPSEEK_BASE_URL).protocol !== "https:"
      ) {
        context.addIssue({
          code: "custom",
          message: "DEEPSEEK_BASE_URL must use HTTPS for production job enrichment",
          path: ["DEEPSEEK_BASE_URL"],
        });
      }
    }
    if (environment.ANSWER_COACH_PROVIDER === "deepseek") {
      for (const key of ["DEEPSEEK_API_KEY", "DEEPSEEK_BASE_URL", "DEEPSEEK_MODEL"] as const) {
        if (!environment[key])
          context.addIssue({ code: "custom", message: `${key} is required`, path: [key] });
      }
    }
    if (
      environment.CAREER_DOCUMENT_AI_ENABLED !== "false" &&
      environment.CAREER_DOCUMENT_PROVIDER === "deepseek"
    ) {
      for (const key of ["DEEPSEEK_API_KEY", "DEEPSEEK_BASE_URL", "DEEPSEEK_MODEL"] as const) {
        if (!environment[key])
          context.addIssue({ code: "custom", message: `${key} is required`, path: [key] });
      }
    }
    if (environment.JSEARCH_ENABLED === "true" && !environment.JSEARCH_API_KEY) {
      context.addIssue({
        code: "custom",
        message: "JSEARCH_API_KEY is required when JSearch is enabled",
        path: ["JSEARCH_API_KEY"],
      });
    }
  });

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

export function parseServerEnvironment(input: NodeJS.ProcessEnv): ServerEnvironment {
  return serverEnvironmentSchema.parse(input);
}

export function parseOptionalUrl(value: unknown): URL | undefined {
  const parsed = optionalUrl.parse(value);
  return parsed ? new URL(parsed) : undefined;
}
