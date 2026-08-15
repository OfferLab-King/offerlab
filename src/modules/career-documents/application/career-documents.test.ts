import type { TransactionSql } from "postgres";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CareerReview } from "../domain/review";

const mocks = vi.hoisted(() => ({
  createCareerDocument: vi.fn(),
  createCareerDocumentVersion: vi.fn(),
  events: [] as string[],
  findCareerDocument: vi.fn(),
  findCareerDocumentVersion: vi.fn(),
  findCareerDocumentWorkspaceDocument: vi.fn(),
  listCareerDocumentReviews: vi.fn(),
  listCareerDocuments: vi.fn(),
  listCareerDocumentVersionSummaries: vi.fn(),
  listCareerJobTargets: vi.fn(),
  readMembershipBenefits: vi.fn(),
  readRuntime: vi.fn(),
  reserveUsage: vi.fn(),
  reviewWithFallback: vi.fn(),
  saveCareerDocumentReview: vi.fn(),
  saveCareerJobTarget: vi.fn(),
  withApplicationUser: vi.fn(),
}));

vi.mock("../../../infrastructure/database/runtime-connections", () => ({
  withApplicationUser: mocks.withApplicationUser,
}));

vi.mock("../infrastructure/career-repository", () => ({
  createCareerDocument: mocks.createCareerDocument,
  createCareerDocumentVersion: mocks.createCareerDocumentVersion,
  findCareerDocument: mocks.findCareerDocument,
  findCareerDocumentVersion: mocks.findCareerDocumentVersion,
  findCareerDocumentWorkspaceDocument: mocks.findCareerDocumentWorkspaceDocument,
  listCareerDocumentReviews: mocks.listCareerDocumentReviews,
  listCareerDocuments: mocks.listCareerDocuments,
  listCareerDocumentVersionSummaries: mocks.listCareerDocumentVersionSummaries,
  listCareerJobTargets: mocks.listCareerJobTargets,
  saveCareerDocumentReview: mocks.saveCareerDocumentReview,
  saveCareerJobTarget: mocks.saveCareerJobTarget,
}));

vi.mock("../infrastructure/provider-runtime", () => ({
  careerDocumentNoticeVersion: "test-notice-v1",
  readCareerDocumentRuntime: mocks.readRuntime,
}));

vi.mock("../infrastructure/review-provider", () => ({
  reviewCareerDocumentWithFallback: mocks.reviewWithFallback,
}));

vi.mock("../infrastructure/review-usage-repository", () => ({
  reserveCareerDocumentReviewUsage: mocks.reserveUsage,
}));

vi.mock("../../membership/application/membership", () => ({
  readMembershipBenefits: mocks.readMembershipBenefits,
}));

import {
  readCareerDocumentReviewUsageLimits,
  readCareerDocumentWorkspace,
  readEffectiveReviewUsageLimits,
  reviewCareerDocument,
} from "./career-documents";

const source =
  "Graduate developer with TypeScript, PostgreSQL and automated testing experience on accessible web products.";

const document = {
  archivedAt: null,
  id: "document-id",
  kind: "cv" as const,
  latestVersion: null,
  title: "Developer CV",
  updatedAt: new Date("2026-08-07T12:00:00Z"),
  version: 1,
  versionCount: 1,
};

const version = {
  contentText: source,
  createdAt: new Date("2026-08-07T12:00:00Z"),
  id: "version-id",
  jobDescription: "Build accessible products with TypeScript and PostgreSQL.",
  label: "Targeted version",
  origin: "editor" as const,
  revision: 2,
  sourceFilename: null,
  sourceMimeType: null,
  sourceSizeBytes: null,
  targetCompany: "Example Ltd",
  targetJobId: null,
  targetRole: "Graduate Developer",
};

const olderVersion = {
  ...version,
  contentText: `${source} Earlier version.`,
  createdAt: new Date("2026-08-06T12:00:00Z"),
  id: "older-version-id",
  label: "Earlier version",
  revision: 1,
};

const versionSummaries = [version, olderVersion].map(({ createdAt, id, label, revision }) => ({
  createdAt,
  id,
  label,
  revision,
}));

const review: CareerReview = {
  documentChecks: {
    length: "Concise.",
    readability: "Clear.",
    specificity: "Specific.",
    targeting: "Targeted.",
  },
  matchedRequirements: ["TypeScript", "PostgreSQL"],
  missingRequirements: [],
  priorityActions: [
    {
      category: "Evidence",
      observation: "The evidence is concise.",
      suggestion: "Keep the supported project detail prominent.",
    },
  ],
  strengths: [
    {
      evidence: "TypeScript, PostgreSQL and automated testing",
      requirement: "TypeScript",
    },
    {
      evidence: "TypeScript, PostgreSQL and automated testing",
      requirement: "PostgreSQL",
    },
  ],
  suggestedContent: null,
  summary: "The selected evidence is relevant to the target.",
};

describe("career-document review application", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.events.length = 0;
    mocks.withApplicationUser.mockImplementation(
      async (_owner: string, operation: (database: TransactionSql) => Promise<unknown>) => {
        mocks.events.push("transaction:start");
        const result = await operation({} as TransactionSql);
        mocks.events.push("transaction:commit");
        return result;
      },
    );
    mocks.findCareerDocument.mockImplementation(async () => {
      mocks.events.push("document:read");
      return document;
    });
    mocks.findCareerDocumentVersion.mockImplementation(async () => {
      mocks.events.push("version:read");
      return version;
    });
    mocks.findCareerDocumentWorkspaceDocument.mockResolvedValue({
      archivedAt: document.archivedAt,
      id: document.id,
      kind: document.kind,
      title: document.title,
    });
    mocks.listCareerDocumentVersionSummaries.mockResolvedValue(versionSummaries);
    mocks.listCareerDocumentReviews.mockResolvedValue([]);
    mocks.readRuntime.mockReturnValue({
      modelAvailable: false,
      provider: { id: "local-test", mode: "local", review: vi.fn() },
      providerName: "Local review",
    });
    mocks.reserveUsage.mockImplementation(async () => {
      mocks.events.push("usage:reserved");
      return true;
    });
    mocks.reviewWithFallback.mockImplementation(async () => {
      mocks.events.push("provider:called");
      return {
        fallbackUsed: false,
        provider: { id: "local-test", mode: "local" },
        result: { review, usage: null },
      };
    });
    mocks.saveCareerDocumentReview.mockImplementation(async () => {
      mocks.events.push("review:saved");
      return { ...review, createdAt: new Date(), id: "review-id" };
    });
    mocks.readMembershipBenefits.mockResolvedValue({
      earlyAccess: false,
      reviewCapacityMultiplier: 1,
    });
  });

  afterEach(() => vi.unstubAllEnvs());

  describe("workspace selection", () => {
    it("loads full content and reviews only for the requested owner-scoped version", async () => {
      mocks.findCareerDocumentVersion.mockResolvedValue(olderVersion);
      mocks.listCareerDocumentReviews.mockResolvedValue([{ id: "older-review-id" }]);

      await expect(
        readCareerDocumentWorkspace("owner-id", document.id, olderVersion.id),
      ).resolves.toMatchObject({
        reviews: [{ id: "older-review-id" }],
        selectedVersion: { id: olderVersion.id },
        versionSummaries,
      });

      expect(mocks.findCareerDocumentVersion).toHaveBeenCalledOnce();
      expect(mocks.findCareerDocumentVersion).toHaveBeenCalledWith(
        expect.anything(),
        "owner-id",
        document.id,
        olderVersion.id,
      );
      expect(mocks.listCareerDocumentReviews).toHaveBeenCalledOnce();
      expect(mocks.listCareerDocumentReviews).toHaveBeenCalledWith(
        expect.anything(),
        "owner-id",
        olderVersion.id,
      );
      expect(mocks.listCareerDocumentVersionSummaries).toHaveBeenCalledOnce();
    });

    it.each(["not-a-uuid", "another-owner-version-id", undefined])(
      "falls back to the latest summary for an unavailable request (%s)",
      async (requestedVersionId) => {
        await readCareerDocumentWorkspace("owner-id", document.id, requestedVersionId);

        expect(mocks.findCareerDocumentVersion).toHaveBeenCalledWith(
          expect.anything(),
          "owner-id",
          document.id,
          version.id,
        );
        expect(mocks.listCareerDocumentReviews).toHaveBeenCalledWith(
          expect.anything(),
          "owner-id",
          version.id,
        );
      },
    );

    it("returns no workspace when the document has no owner-scoped versions", async () => {
      mocks.listCareerDocumentVersionSummaries.mockResolvedValue([]);

      await expect(readCareerDocumentWorkspace("owner-id", document.id)).resolves.toBeNull();
      expect(mocks.findCareerDocumentVersion).not.toHaveBeenCalled();
      expect(mocks.listCareerDocumentReviews).not.toHaveBeenCalled();
    });
  });

  it("commits a reservation after validation, releases the transaction, then calls the provider", async () => {
    await expect(
      reviewCareerDocument("owner-id", document.id, version.id, { modelConsent: false }),
    ).resolves.toMatchObject({ fallbackUsed: false, review: { id: "review-id" } });

    expect(mocks.events).toEqual([
      "transaction:start",
      "document:read",
      "version:read",
      "usage:reserved",
      "transaction:commit",
      "provider:called",
      "transaction:start",
      "document:read",
      "version:read",
      "review:saved",
      "transaction:commit",
    ]);
    expect(mocks.withApplicationUser).toHaveBeenCalledTimes(2);
  });

  it.each([
    { modelConsent: false, providerNoticeVersion: "test-notice-v1" },
    { modelConsent: true, providerNoticeVersion: null },
    { modelConsent: true },
    { modelConsent: true, providerNoticeVersion: "stale-notice-v0" },
  ])(
    "rejects unchecked, missing or stale hosted-provider consent before reserving usage (%o)",
    async (options) => {
      mocks.readRuntime.mockReturnValue({
        modelAvailable: true,
        provider: { id: "model-test", mode: "model", review: vi.fn() },
        providerName: "Hosted review",
      });

      await expect(
        reviewCareerDocument("owner-id", document.id, version.id, options),
      ).rejects.toThrow("career_document_review_consent_required");

      expect(mocks.withApplicationUser).not.toHaveBeenCalled();
      expect(mocks.reserveUsage).not.toHaveBeenCalled();
      expect(mocks.reviewWithFallback).not.toHaveBeenCalled();
    },
  );

  it("binds a hosted review to the exact current provider notice accepted for the request", async () => {
    mocks.readRuntime.mockReturnValue({
      modelAvailable: true,
      provider: { id: "model-test", mode: "model", review: vi.fn() },
      providerName: "Hosted review",
    });
    mocks.reviewWithFallback.mockResolvedValue({
      fallbackUsed: false,
      provider: { id: "model-test", mode: "model" },
      result: { review, usage: null },
    });

    await expect(
      reviewCareerDocument("owner-id", document.id, version.id, {
        modelConsent: true,
        providerNoticeVersion: "test-notice-v1",
      }),
    ).resolves.toMatchObject({ fallbackUsed: false, review: { id: "review-id" } });

    expect(mocks.reserveUsage).toHaveBeenCalledWith(
      expect.anything(),
      "owner-id",
      true,
      expect.anything(),
    );
    expect(mocks.saveCareerDocumentReview).toHaveBeenCalledWith(
      expect.anything(),
      "owner-id",
      version.id,
      expect.objectContaining({
        modelRequested: true,
        noticeVersion: "test-notice-v1",
      }),
      review,
    );
  });

  it("counts the committed reservation when the provider attempt fails", async () => {
    mocks.reviewWithFallback.mockImplementation(async () => {
      mocks.events.push("provider:called");
      throw new Error("career_document_review_failed");
    });

    await expect(
      reviewCareerDocument("owner-id", document.id, version.id, { modelConsent: false }),
    ).rejects.toThrow("career_document_review_failed");
    expect(mocks.events).toEqual([
      "transaction:start",
      "document:read",
      "version:read",
      "usage:reserved",
      "transaction:commit",
      "provider:called",
    ]);
    expect(mocks.saveCareerDocumentReview).not.toHaveBeenCalled();
  });

  it("does not reserve or invoke a provider before target validation succeeds", async () => {
    mocks.findCareerDocumentVersion.mockResolvedValue({ ...version, jobDescription: "" });

    await expect(
      reviewCareerDocument("owner-id", document.id, version.id, { modelConsent: false }),
    ).rejects.toThrow("career_document_target_required");
    expect(mocks.reserveUsage).not.toHaveBeenCalled();
    expect(mocks.reviewWithFallback).not.toHaveBeenCalled();
  });

  it("stops before provider invocation when no allowance can be reserved", async () => {
    mocks.reserveUsage.mockResolvedValue(false);

    await expect(
      reviewCareerDocument("owner-id", document.id, version.id, { modelConsent: false }),
    ).rejects.toThrow("career_document_review_limit_reached");
    expect(mocks.reviewWithFallback).not.toHaveBeenCalled();
  });

  it("uses bounded defaults and operational overrides for all review ceilings", () => {
    expect(readCareerDocumentReviewUsageLimits()).toEqual({
      hostedAccountMonthly: 400,
      memberDaily: 10,
      memberMonthly: 40,
    });
    vi.stubEnv("CAREER_DOCUMENT_REVIEW_HOSTED_ACCOUNT_MONTHLY_LIMIT", "600");
    vi.stubEnv("CAREER_DOCUMENT_REVIEW_MEMBER_DAILY_LIMIT", "12");
    vi.stubEnv("CAREER_DOCUMENT_REVIEW_MEMBER_MONTHLY_LIMIT", "48");
    expect(readCareerDocumentReviewUsageLimits()).toEqual({
      hostedAccountMonthly: 600,
      memberDaily: 12,
      memberMonthly: 48,
    });
    vi.stubEnv("CAREER_DOCUMENT_REVIEW_MEMBER_DAILY_LIMIT", "100001");
    expect(() => readCareerDocumentReviewUsageLimits()).toThrow(
      "career_document_review_usage_configuration_invalid",
    );
  });

  it("doubles member review ceilings for active membership and keeps free ceilings otherwise", async () => {
    mocks.readMembershipBenefits.mockResolvedValueOnce({
      earlyAccess: true,
      reviewCapacityMultiplier: 2,
    });
    await expect(readEffectiveReviewUsageLimits("owner-id")).resolves.toEqual({
      hostedAccountMonthly: 400,
      memberDaily: 20,
      memberMonthly: 80,
    });
    mocks.readMembershipBenefits.mockResolvedValueOnce({
      earlyAccess: false,
      reviewCapacityMultiplier: 1,
    });
    await expect(readEffectiveReviewUsageLimits("owner-id")).resolves.toEqual({
      hostedAccountMonthly: 400,
      memberDaily: 10,
      memberMonthly: 40,
    });
  });
});
