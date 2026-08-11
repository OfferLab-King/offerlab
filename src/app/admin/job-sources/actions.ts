"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdministrator } from "../../../modules/identity-access/application/authorization";
import {
  overrideJobClassificationForAdmin,
  overrideJobPublicationForAdmin,
  pauseCompanySource,
  recordCompanySourceReview,
  setCompanyCrawlPermission,
} from "../../../modules/job-catalog/application/admin";

const pauseSchema = z.object({
  companyId: z.string().uuid(),
  paused: z.enum(["true", "false"]),
});

const permissionSchema = z.object({
  companyId: z.string().uuid(),
  crawlAllowed: z.enum(["allowed", "unknown", "blocked"]),
});

const reviewSchema = z.object({
  companyId: z.string().uuid(),
  evidenceUrl: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().url().max(500).optional(),
  ),
  reviewDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  reviewNotes: z.string().max(2000).default(""),
  robotsResult: z.enum(["allowed", "blocked", "unknown", "not_checked"]),
  termsResult: z.enum(["allowed", "blocked", "unknown", "not_reviewed"]),
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
    companyId: formData.get("companyId"),
    paused: formData.get("paused"),
  });
  await pauseCompanySource(administrator.userId, parsed.companyId, parsed.paused === "true");
  revalidatePath("/admin/job-sources");
}

export async function updateCrawlPermission(formData: FormData): Promise<void> {
  const administrator = await requireAdministrator();
  const parsed = permissionSchema.parse({
    companyId: formData.get("companyId"),
    crawlAllowed: formData.get("crawlAllowed"),
  });
  await setCompanyCrawlPermission(administrator.userId, parsed.companyId, parsed.crawlAllowed);
  revalidatePath("/admin/job-sources");
}

export async function recordReview(formData: FormData): Promise<void> {
  const administrator = await requireAdministrator();
  const parsed = reviewSchema.parse({
    companyId: formData.get("companyId"),
    evidenceUrl: formData.get("evidenceUrl"),
    reviewDate: formData.get("reviewDate"),
    reviewNotes: formData.get("reviewNotes") ?? "",
    robotsResult: formData.get("robotsResult"),
    termsResult: formData.get("termsResult"),
  });
  await recordCompanySourceReview(administrator.userId, parsed.companyId, {
    evidenceUrl: parsed.evidenceUrl ?? null,
    reviewDate: new Date(`${parsed.reviewDate}T00:00:00Z`),
    reviewNotes: parsed.reviewNotes,
    robotsResult: parsed.robotsResult,
    termsResult: parsed.termsResult,
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
