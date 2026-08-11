import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/modules/job-catalog/application/catalog", () => ({
  readEmployerActiveJobs: vi.fn(async () => []),
  readEmployerDirectory: vi.fn(async () => []),
  readEmployerProfile: vi.fn(async () => null),
  readSectorJobCounts: vi.fn(async () => []),
}));
vi.mock("../../src/app/jobs/job-card", () => ({ JobCard: () => null }));
vi.mock("../../src/app/jobs/employer-mark", () => ({ EmployerMark: () => null }));
vi.mock("../../src/app/components/site-header", () => ({ SiteHeader: () => null }));
vi.mock("../../src/app/employers/employer-directory-view", () => ({
  EmployerDirectoryView: () => null,
}));

import { generateMetadata as employerMetadata } from "../../src/app/employers/[slug]/page";
import { generateMetadata as directoryMetadata } from "../../src/app/employers/page";
import { readEmployerProfile } from "../../src/modules/job-catalog/application/catalog";
import type { EmployerProfileView } from "../../src/modules/job-catalog/application/catalog";

const readEmployerProfileMock = vi.mocked(readEmployerProfile);

function profile(overrides: Partial<EmployerProfileView>): EmployerProfileView {
  return {
    active: true,
    active_jobs: 3,
    ats_provider: "greenhouse",
    careers_url: "https://careers.example.com",
    description: "Original curated description for tests.",
    has_imported_jobs: true,
    id: "30000000-0000-4000-8000-000000000001",
    indexable: true,
    industry: "Technology",
    imported_jobs: 3,
    logo_url: null,
    name: "Example Bank",
    slug: "example-bank",
    website_url: "https://www.example-bank.com",
    ...overrides,
  };
}

describe("employer profile metadata", () => {
  it("emits canonical, UK-focused title and factual description for an eligible profile", async () => {
    readEmployerProfileMock.mockResolvedValue(profile({}));
    const metadata = await employerMetadata({ params: Promise.resolve({ slug: "example-bank" }) });
    expect(metadata.alternates?.canonical).toBe("/employers/example-bank");
    expect(metadata.title).toContain("UK Employer Profile and Jobs");
    expect(metadata.description).toBe("Original curated description for tests.");
    expect(metadata.robots).toBeUndefined();
  });

  it("does not index a thin profile while keeping follow enabled", async () => {
    readEmployerProfileMock.mockResolvedValue(
      profile({
        active_jobs: 0,
        description: null,
        has_imported_jobs: false,
        indexable: false,
      }),
    );
    const metadata = await employerMetadata({ params: Promise.resolve({ slug: "example-bank" }) });
    expect(metadata.robots).toEqual({ follow: true, index: false });
    expect(metadata.alternates?.canonical).toBe("/employers/example-bank");
  });

  it("does not index a missing profile", async () => {
    readEmployerProfileMock.mockResolvedValue(null);
    const metadata = await employerMetadata({
      params: Promise.resolve({ slug: "no-such-employer" }),
    });
    expect(metadata.robots).toEqual({ follow: false, index: false });
    expect(metadata.alternates).toBeUndefined();
  });

  it("does not index an inactive employer profile", async () => {
    readEmployerProfileMock.mockResolvedValue(
      profile({
        active: false,
        indexable: false,
      }),
    );
    const metadata = await employerMetadata({ params: Promise.resolve({ slug: "example-bank" }) });
    expect(metadata.robots).toEqual({ follow: true, index: false });
  });
});

describe("employer directory metadata", () => {
  it("indexes the clean directory URL", async () => {
    const metadata = await directoryMetadata({ searchParams: Promise.resolve({}) });
    expect(metadata.alternates?.canonical).toBe("/employers");
    expect(metadata.robots).toBeUndefined();
  });

  it.each([
    [{ sector: "financial_services" }],
    [{ sector: "financial_services", subsector: "retail_corporate_banking" }],
    [{ q: "bank" }],
  ])("marks filtered directory URLs as noindex, follow for %o", async (params) => {
    const metadata = await directoryMetadata({ searchParams: Promise.resolve(params) });
    expect(metadata.robots).toEqual({ follow: true, index: false });
  });
});
