import { z } from "zod";

export const environmentKeys = [
  "NODE_ENV",
  "APP_ENV",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "AUTH_RATE_LIMIT_SECRET",
  "ANSWER_COACH_ENABLED",
  "DATABASE_URL",
  "IDENTITY_SYNC_DATABASE_URL",
  "LOG_LEVEL",
] as const;

const optionalUrl = z.preprocess((value) => (value === "" ? undefined : value), z.url().optional());
const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const serverEnvironmentSchema = z
  .object({
    APP_ENV: z.enum(["local", "test", "staging", "production"]),
    ANSWER_COACH_ENABLED: z.enum(["true", "false"]).optional(),
    AUTH_RATE_LIMIT_SECRET: optionalString,
    DATABASE_URL: optionalString,
    IDENTITY_SYNC_DATABASE_URL: optionalString,
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]),
    NEXT_PUBLIC_APP_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NODE_ENV: z.enum(["development", "test", "production"]),
  })
  .superRefine((environment, context) => {
    if (environment.APP_ENV === "production") {
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
