import "server-only";

import { z } from "zod";
import type { JobSearchProvider } from "../domain/job-search";
import { createJSearchProvider, jobDiscoveryEnvironmentValues } from "./jsearch-provider";

const runtimeConfigurationSchema = z
  .object({
    apiKey: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().trim().min(1).max(1024).optional(),
    ),
    appEnvironment: z.enum(jobDiscoveryEnvironmentValues),
    enabled: z.boolean(),
    productionUseApproved: z.boolean(),
  })
  .strict();

export type JobDiscoveryRuntime =
  | Readonly<{
      available: false;
      reason:
        "disabled" | "invalid_configuration" | "missing_configuration" | "production_not_approved";
    }>
  | Readonly<{
      available: true;
      provider: JobSearchProvider;
    }>;

export function createJobDiscoveryRuntime(
  configurationInput: unknown,
  fetchImplementation: typeof fetch = fetch,
): JobDiscoveryRuntime {
  const parsed = runtimeConfigurationSchema.safeParse(configurationInput);
  if (!parsed.success) return { available: false, reason: "invalid_configuration" };
  const configuration = parsed.data;
  if (!configuration.enabled) return { available: false, reason: "disabled" };
  if (configuration.appEnvironment === "production" && !configuration.productionUseApproved)
    return { available: false, reason: "production_not_approved" };
  if (!configuration.apiKey) return { available: false, reason: "missing_configuration" };
  return {
    available: true,
    provider: createJSearchProvider(
      {
        apiKey: configuration.apiKey,
        appEnvironment: configuration.appEnvironment,
        productionUseApproved: configuration.productionUseApproved,
      },
      fetchImplementation,
    ),
  };
}
