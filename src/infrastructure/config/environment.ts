import { z } from "zod";

export const environmentKeys = [
  "NODE_ENV",
  "APP_ENV",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "DATABASE_MIGRATION_URL",
  "TEST_DATABASE_URL",
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
    DATABASE_MIGRATION_URL: optionalString,
    DATABASE_URL: optionalString,
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]),
    NEXT_PUBLIC_APP_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NODE_ENV: z.enum(["development", "test", "production"]),
    SUPABASE_SERVICE_ROLE_KEY: optionalString,
    TEST_DATABASE_URL: optionalString,
  })
  .superRefine((environment, context) => {
    if (environment.APP_ENV === "production") {
      for (const key of [
        "DATABASE_MIGRATION_URL",
        "DATABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
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
