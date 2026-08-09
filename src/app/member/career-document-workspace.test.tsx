import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { StoredCareerReview } from "../../modules/career-documents/infrastructure/career-repository";

vi.mock("next/navigation", () => ({
  usePathname: () => "/member/cvs/document-id",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

import { CareerDocumentWorkspace } from "./career-document-workspace";

const selectedVersion = {
  contentText: "Selected CV content with TypeScript delivery evidence.",
  createdAt: new Date("2026-08-07T12:00:00Z"),
  id: "selected-version-id",
  jobDescription: "Build accessible products with TypeScript.",
  label: "Selected role",
  origin: "editor" as const,
  revision: 2,
  sourceFilename: null,
  sourceMimeType: null,
  sourceSizeBytes: null,
  targetCompany: "Example Ltd",
  targetJobId: null,
  targetRole: "Graduate Developer",
};

const review: StoredCareerReview = {
  createdAt: new Date("2026-08-07T13:00:00Z"),
  documentChecks: {
    length: "Concise.",
    readability: "Clear.",
    specificity: "Specific.",
    targeting: "Targeted.",
  },
  id: "review-id",
  matchedRequirements: ["TypeScript"],
  missingRequirements: ["Advanced SQL querying and data manipulation"],
  modelRequested: false,
  priorityActions: [
    {
      category: "Evidence",
      observation: "Evidence is relevant.",
      suggestion: "Keep it prominent.",
    },
  ],
  promptVersion: 1,
  providerId: "offerlab-career-rubric-v1",
  providerMode: "local" as const,
  strengths: [{ evidence: "TypeScript delivery", requirement: "typescript" }],
  suggestedContent: null,
  summary: "Selected-version review summary.",
};

describe("CareerDocumentWorkspace", () => {
  it("renders lightweight version choices with only the server-selected version and its reviews", () => {
    const html = renderToStaticMarkup(
      <CareerDocumentWorkspace
        configuration={{ modelAvailable: false, noticeVersion: null }}
        document={{
          archivedAt: null,
          id: "document-id",
          kind: "cv",
          title: "Developer CV",
        }}
        jobTargets={[]}
        reviews={[review]}
        selectedVersion={selectedVersion}
        versionSummaries={[
          {
            createdAt: selectedVersion.createdAt,
            id: selectedVersion.id,
            label: selectedVersion.label,
            revision: selectedVersion.revision,
          },
          {
            createdAt: new Date("2026-08-06T12:00:00Z"),
            id: "older-version-id",
            label: "Earlier role",
            revision: 1,
          },
        ]}
      />,
    );

    expect(html).toContain("Selected CV content with TypeScript delivery evidence.");
    expect(html).toContain("Selected-version review summary.");
    expect(html).toContain("v2 · Selected role");
    expect(html).toContain("v1 · Earlier role");
    expect(html).toContain("2 immutable versions");
    expect(html).toContain("Document evidence coverage");
    expect(html).toContain("50");
    expect(html).toContain("1 of 2 assessed requirements");
    expect(html).toContain("CV evidence");
    expect(html).toContain("Advanced SQL querying and data manipulation");
    expect(html).toContain("Build a SQL evidence project");
    expect(html).toContain("OfferLab currently receives no commission");
  });
});
