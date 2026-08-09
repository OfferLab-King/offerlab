import "server-only";

import { withApplicationUser } from "../../../infrastructure/database/runtime-connections";
import {
  careerDocumentTitleSchema,
  careerDocumentVersionInputSchema,
  careerJobTargetInputSchema,
  type CareerDocumentKind,
} from "../domain/career-document";
import { validateCareerProviderReview } from "../domain/review";
import type { ExtractedCareerDocument } from "../infrastructure/document-extractor";
import {
  createCareerDocument,
  createCareerDocumentVersion,
  findCareerDocument,
  findCareerDocumentVersion,
  findCareerDocumentWorkspaceDocument,
  listCareerDocumentReviews,
  listCareerDocuments,
  listCareerDocumentVersionSummaries,
  listCareerJobTargets,
  saveCareerDocumentReview,
  saveCareerJobTarget,
} from "../infrastructure/career-repository";
import { careerDocumentPromptVersion } from "../infrastructure/deepseek-provider";
import {
  careerDocumentNoticeVersion,
  readCareerDocumentRuntime,
} from "../infrastructure/provider-runtime";
import { reviewCareerDocumentWithFallback } from "../infrastructure/review-provider";
import { reserveCareerDocumentReviewUsage } from "../infrastructure/review-usage-repository";

const defaultReviewUsageLimits = {
  hostedAccountMonthly: 400,
  memberDaily: 10,
  memberMonthly: 40,
} as const;

type ReviewUsageEnvironmentKey =
  | "CAREER_DOCUMENT_REVIEW_HOSTED_ACCOUNT_MONTHLY_LIMIT"
  | "CAREER_DOCUMENT_REVIEW_MEMBER_DAILY_LIMIT"
  | "CAREER_DOCUMENT_REVIEW_MEMBER_MONTHLY_LIMIT";

function reviewUsageLimit(name: ReviewUsageEnvironmentKey, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  if (!/^(?:[1-9]\d{0,4}|100000)$/u.test(value)) {
    throw new Error("career_document_review_usage_configuration_invalid");
  }
  return Number(value);
}

export function readCareerDocumentReviewUsageLimits() {
  return {
    hostedAccountMonthly: reviewUsageLimit(
      "CAREER_DOCUMENT_REVIEW_HOSTED_ACCOUNT_MONTHLY_LIMIT",
      defaultReviewUsageLimits.hostedAccountMonthly,
    ),
    memberDaily: reviewUsageLimit(
      "CAREER_DOCUMENT_REVIEW_MEMBER_DAILY_LIMIT",
      defaultReviewUsageLimits.memberDaily,
    ),
    memberMonthly: reviewUsageLimit(
      "CAREER_DOCUMENT_REVIEW_MEMBER_MONTHLY_LIMIT",
      defaultReviewUsageLimits.memberMonthly,
    ),
  } as const;
}

export function readCareerDocumentConfiguration() {
  const runtime = readCareerDocumentRuntime();
  return {
    modelAvailable: runtime.modelAvailable,
    noticeVersion: runtime.modelAvailable ? careerDocumentNoticeVersion : null,
  };
}

export const readCareerDocuments = (owner: string, kind: CareerDocumentKind, archived = false) =>
  withApplicationUser(owner, (database) => listCareerDocuments(database, owner, kind, archived));

export const readCareerJobTargets = (owner: string) =>
  withApplicationUser(owner, (database) => listCareerJobTargets(database, owner));

export async function readCareerDocumentWorkspace(
  owner: string,
  documentId: string,
  requestedVersionId?: string | null,
) {
  return withApplicationUser(owner, async (database) => {
    const document = await findCareerDocumentWorkspaceDocument(database, owner, documentId);
    if (!document) return null;
    const versionSummaries = await listCareerDocumentVersionSummaries(database, owner, documentId);
    const selectedSummary =
      versionSummaries.find((candidate) => candidate.id === requestedVersionId) ??
      versionSummaries[0];
    if (!selectedSummary) return null;
    const selectedVersion = await findCareerDocumentVersion(
      database,
      owner,
      documentId,
      selectedSummary.id,
    );
    if (!selectedVersion) return null;
    const reviews = await listCareerDocumentReviews(database, owner, selectedVersion.id);
    return { document, reviews, selectedVersion, versionSummaries };
  });
}

export async function addUploadedCareerDocument(
  owner: string,
  input: unknown,
  extracted: ExtractedCareerDocument,
) {
  const title = careerDocumentTitleSchema.safeParse(input);
  if (!title.success) return { outcome: "invalid" } as const;
  const initial = careerDocumentVersionInputSchema.parse({
    contentText: extracted.contentText,
    jobDescription: "",
    label: "Base upload",
    targetCompany: null,
    targetJobId: null,
    targetRole: null,
  });
  const document = await withApplicationUser(owner, (database) =>
    createCareerDocument(database, owner, title.data.kind, title.data.title, initial, {
      filename: extracted.filename,
      mimeType: extracted.mimeType,
      sha256: extracted.sha256,
      sizeBytes: extracted.sizeBytes,
    }),
  );
  return { document, outcome: "created", warnings: extracted.warnings } as const;
}

export async function addCareerDocumentVersion(owner: string, documentId: string, input: unknown) {
  const parsed = careerDocumentVersionInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      fields: [...new Set(parsed.error.issues.map((issue) => String(issue.path[0] ?? "form")))],
      outcome: "invalid",
    } as const;
  }
  const item = await withApplicationUser(owner, (database) =>
    createCareerDocumentVersion(database, owner, documentId, parsed.data),
  );
  return item ? ({ item, outcome: "created" } as const) : ({ outcome: "not_found" } as const);
}

export async function addCareerJobTarget(owner: string, input: unknown) {
  const parsed = careerJobTargetInputSchema.safeParse(input);
  if (!parsed.success) return { outcome: "invalid" } as const;
  const item = await withApplicationUser(owner, (database) =>
    saveCareerJobTarget(database, owner, parsed.data),
  );
  return { item, outcome: "saved" } as const;
}

function redactContactDetails(content: string): string {
  return content
    .replace(/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/giu, "[email removed]")
    .replace(/(?:\+44\s?\d|\b0\d)(?:[\s()-]*\d){8,12}\b/gu, "[phone removed]")
    .replace(
      /https?:\/\/(?:www\.)?(?:linkedin\.com|github\.com)\/\S+/giu,
      "[profile link removed]",
    );
}

export async function reviewCareerDocument(
  owner: string,
  documentId: string,
  versionId: string,
  options: Readonly<{ modelConsent: boolean; providerNoticeVersion?: string | null }>,
) {
  const runtime = readCareerDocumentRuntime();
  if (
    runtime.modelAvailable &&
    (!options.modelConsent || options.providerNoticeVersion !== careerDocumentNoticeVersion)
  ) {
    throw new Error("career_document_review_consent_required");
  }
  const limits = readCareerDocumentReviewUsageLimits();
  const prepared = await withApplicationUser(owner, async (database) => {
    const [document, version] = await Promise.all([
      findCareerDocument(database, owner, documentId),
      findCareerDocumentVersion(database, owner, documentId, versionId),
    ]);
    if (!document || document.archivedAt || !version) return null;
    if (!version.jobDescription || !version.targetCompany || !version.targetRole) {
      throw new Error("career_document_target_required");
    }
    const reserved = await reserveCareerDocumentReviewUsage(
      database,
      owner,
      runtime.modelAvailable,
      limits,
    );
    if (!reserved) throw new Error("career_document_review_limit_reached");
    return { documentKind: document.kind, version };
  });
  if (!prepared) return null;

  const sourceForProvider = redactContactDetails(prepared.version.contentText);
  const run = await reviewCareerDocumentWithFallback(runtime.provider, {
    contentText: sourceForProvider,
    jobDescription: prepared.version.jobDescription,
    kind: prepared.documentKind,
    targetCompany: prepared.version.targetCompany!,
    targetRole: prepared.version.targetRole!,
  });
  const review = validateCareerProviderReview(
    run.result.review,
    sourceForProvider,
    prepared.version.jobDescription,
    { kind: prepared.documentKind, targetCompany: prepared.version.targetCompany! },
  );

  return withApplicationUser(owner, async (database) => {
    const [document, currentVersion] = await Promise.all([
      findCareerDocument(database, owner, documentId),
      findCareerDocumentVersion(database, owner, documentId, versionId),
    ]);
    if (!document || document.archivedAt || !currentVersion) return null;
    if (
      currentVersion.contentText !== prepared.version.contentText ||
      currentVersion.jobDescription !== prepared.version.jobDescription ||
      currentVersion.targetCompany !== prepared.version.targetCompany ||
      currentVersion.targetRole !== prepared.version.targetRole
    ) {
      throw new Error("career_document_review_source_changed");
    }
    const stored = await saveCareerDocumentReview(
      database,
      owner,
      currentVersion.id,
      {
        id: run.provider.id,
        inputTokens: run.result.usage?.inputTokens ?? null,
        latencyMs: run.result.usage?.latencyMs ?? null,
        mode: run.fallbackUsed ? "fallback" : run.provider.mode,
        modelRequested: runtime.modelAvailable,
        noticeVersion: runtime.modelAvailable ? options.providerNoticeVersion! : null,
        outputTokens: run.result.usage?.outputTokens ?? null,
        promptVersion: run.provider.mode === "model" ? careerDocumentPromptVersion : 2,
      },
      review,
    );
    return { fallbackUsed: run.fallbackUsed, review: stored };
  });
}
