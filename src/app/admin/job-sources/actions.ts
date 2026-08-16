"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdministrator } from "../../../modules/identity-access/application/authorization";
import {
  overrideJobClassificationForAdmin,
  overrideJobEligibilityBatchForAdmin,
  overrideJobPublicationForAdmin,
  pauseCompanySource,
  requestSourceRunForAdmin,
  updateSourceUrlsForAdmin,
} from "../../../modules/job-catalog/application/admin";

const pauseSchema = z.object({
  sourceId: z.string().uuid(),
  paused: z.enum(["true", "false"]),
});

const sourceIdSchema = z.object({
  sourceId: z.string().uuid(),
});

const sourceUrlsSchema = z.object({
  sourceId: z.string().uuid(),
  careersUrl: z.string().url().max(1000),
  crawlEndpointUrl: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().url().max(1000).optional(),
  ),
  configuration: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z
      .string()
      .max(20000)
      .transform((value, context) => {
        try {
          const parsed: unknown = JSON.parse(value);
          if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
            context.addIssue({
              code: "custom",
              message: "Connector configuration must be a JSON object.",
            });
            return z.NEVER;
          }
          return parsed as Readonly<Record<string, unknown>>;
        } catch {
          context.addIssue({
            code: "custom",
            message: "Connector configuration must be valid JSON.",
          });
          return z.NEVER;
        }
      })
      .optional(),
  ),
});

const eligibilityOverrideSchema = z.object({
  jobId: z.string().uuid(),
  eligibilityStatus: z.enum(["eligible", "ineligible", "needs_review"]),
});

const classificationOverrideSchema = z.object({
  jobId: z.string().uuid(),
  opportunityType: z.string().max(60).optional(),
  sectorKey: z.string().max(60).optional(),
  subsectorKey: z.string().max(60).optional(),
});

const publicationOverrideSchema = z.object({
  jobId: z.string().uuid(),
  publicationStatus: z.enum(["published", "suppressed", "draft"]),
});

export async function updateSourcePause(formData: FormData): Promise<void> {
  const administrator = await requireAdministrator();
  const parsed = pauseSchema.parse({
    sourceId: formData.get("sourceId"),
    paused: formData.get("paused"),
  });
  await pauseCompanySource(administrator.userId, parsed.sourceId, parsed.paused === "true");
  revalidatePath("/admin/job-sources");
}

export async function requestSourceRun(formData: FormData): Promise<void> {
  const administrator = await requireAdministrator();
  const parsed = sourceIdSchema.parse({ sourceId: formData.get("sourceId") });
  await requestSourceRunForAdmin(administrator.userId, parsed.sourceId);
  revalidatePath("/admin/job-sources");
}

export async function updateSourceUrls(formData: FormData): Promise<void> {
  const administrator = await requireAdministrator();
  const parsed = sourceUrlsSchema.parse({
    sourceId: formData.get("sourceId"),
    careersUrl: formData.get("careersUrl"),
    crawlEndpointUrl: formData.get("crawlEndpointUrl"),
    configuration: formData.get("configuration"),
  });
  await updateSourceUrlsForAdmin(administrator.userId, parsed.sourceId, {
    careersUrl: parsed.careersUrl,
    crawlEndpointUrl: parsed.crawlEndpointUrl ?? null,
    configuration: parsed.configuration ?? null,
  });
  revalidatePath("/admin/job-sources");
}

export async function overrideEligibility(formData: FormData): Promise<void> {
  const administrator = await requireAdministrator();
  const parsed = eligibilityOverrideSchema.parse({
    eligibilityStatus: formData.get("eligibilityStatus"),
    jobId: formData.get("jobId"),
  });
  await overrideJobClassificationForAdmin(administrator.userId, parsed.jobId, {
    eligibilityStatus: parsed.eligibilityStatus,
  });
  revalidatePath("/admin/job-sources");
}

const eligibilityDecisionSchema = z.object({
  jobId: z.string().uuid(),
  decision: z.enum(["eligible", "ineligible"]),
});

const bulkDecisionSchema = z.object({
  jobIds: z.array(z.string().uuid()).min(1).max(200),
  decision: z.enum(["eligible", "ineligible"]),
});

export async function quickEligibilityDecision(formData: FormData): Promise<void> {
  const administrator = await requireAdministrator();
  const parsed = eligibilityDecisionSchema.parse({
    jobId: formData.get("jobId"),
    decision: formData.get("decision"),
  });
  await overrideJobEligibilityBatchForAdmin(administrator.userId, [parsed.jobId], parsed.decision);
  revalidatePath("/admin/job-sources");
}

export async function bulkEligibilityDecision(formData: FormData): Promise<void> {
  const administrator = await requireAdministrator();
  const parsed = bulkDecisionSchema.parse({
    jobIds: formData.getAll("jobIds"),
    decision: formData.get("decision"),
  });
  await overrideJobEligibilityBatchForAdmin(administrator.userId, parsed.jobIds, parsed.decision);
  revalidatePath("/admin/job-sources");
}

export async function overrideClassification(formData: FormData): Promise<void> {
  const administrator = await requireAdministrator();
  const parsed = classificationOverrideSchema.parse({
    jobId: formData.get("jobId"),
    opportunityType: formData.get("opportunityType") || undefined,
    sectorKey: formData.get("sectorKey") || undefined,
    subsectorKey: formData.get("subsectorKey") || undefined,
  });
  await overrideJobClassificationForAdmin(administrator.userId, parsed.jobId, {
    ...(parsed.opportunityType ? { opportunityType: parsed.opportunityType } : {}),
    sectorKey: parsed.sectorKey ?? null,
    subsectorKey: parsed.subsectorKey ?? null,
  });
  revalidatePath("/admin/job-sources");
}

export async function overridePublication(formData: FormData): Promise<void> {
  const administrator = await requireAdministrator();
  const parsed = publicationOverrideSchema.parse({
    jobId: formData.get("jobId"),
    publicationStatus: formData.get("publicationStatus"),
  });
  await overrideJobPublicationForAdmin(
    administrator.userId,
    parsed.jobId,
    parsed.publicationStatus,
  );
  revalidatePath("/admin/job-sources");
}
