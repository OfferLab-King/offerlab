import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/modules/job-catalog/application/catalog", () => ({
  isJobSavedForMember: vi.fn(async () => false),
  readJobDetail: vi.fn(async () => null),
  readRelatedJobs: vi.fn(async () => ({ sameEmployer: [], similar: [] })),
}));
vi.mock("../../src/modules/identity-access/application/authorization", () => ({
  currentMemberAccess: vi.fn(async () => ({ status: "not_eligible" })),
}));
vi.mock("../../src/app/components/site-header", () => ({ SiteHeader: () => null }));
vi.mock("../../src/app/jobs/job-card", () => ({ JobCard: () => null }));
vi.mock("../../src/app/jobs/employer-mark", () => ({ EmployerMark: () => null }));
vi.mock("../../src/app/jobs/[slug]/apply-tracking", () => ({ ApplyTrackingLink: () => null }));
vi.mock("../../src/app/jobs/[slug]/save-job-button", () => ({ SaveJobButton: () => null }));

import { generateMetadata } from "../../src/app/jobs/[slug]/page";
import { readJobDetail } from "../../src/modules/job-catalog/application/catalog";
import type { JobDetailRow } from "../../src/modules/job-catalog/application/catalog";

const readJobDetailMock = vi.mocked(readJobDetail);

function job(overrides: Partial<JobDetailRow> = {}): JobDetailRow {
  return {
    active: true,
    application_deadline: new Date("2026-12-01T00:00:00Z"),
    application_url: "https://employer.example.com/apply/1",
    career_level_key: "graduate",
    classification_source: "deterministic",
    classification_version: 1,
    company_careers_url: "https://employer.example.com/careers",
    company_employee_band: "10,000–49,999",
    company_has_sponsor: true,
    company_id: "30000000-0000-4000-8000-000000000001",
    company_logo_url: null,
    company_name: "Example Bank",
    company_ownership_type: "Listed parent/company",
    company_slug: "example-bank",
    company_sponsor_snapshot_date: new Date("2026-08-12T00:00:00Z"),
    company_website_url: null,
    degree_requirements: [],
    description_summary: "Verified summary of the role.",
    eligibility_evidence: null,
    eligibility_reasons: [],
    eligibility_status: "eligible",
    employer_industry_key: "financial_services",
    employment_type: "full_time",
    enrichment_model: null,
    enrichment_version: null,
    experience_requirements: null,
    external_job_id: null,
    first_seen_at: new Date("2026-08-01T00:00:00Z"),
    id: "30000000-0000-4000-8000-000000000002",
    job_function_key: "finance_accounting",
    job_subfunction_key: "audit",
    last_changed_at: new Date("2026-08-01T00:00:00Z"),
    last_seen_at: new Date("2026-08-09T00:00:00Z"),
    last_successful_check_at: null,
    location_text: "London",
    locations: [],
    normalized_title: "Graduate Analyst",
    opportunity_type: "graduate_scheme",
    posted_at: new Date("2026-08-01T00:00:00Z"),
    preferred_skills: [],
    publication_status: "published",
    remote_type: "on_site",
    requirements: [],
    responsibilities: [],
    salary_currency: null,
    salary_max: null,
    salary_min: null,
    salary_period: null,
    sector_key: "financial_services",
    seniority_level: null,
    skills: [],
    slug: "example-bank-graduate-analyst",
    source_url: null,
    subsector_key: "retail_corporate_banking",
    title: "Graduate Analyst",
    updated_at: new Date("2026-08-01T00:00:00Z"),
    visa_sponsorship_evidence: null,
    visa_sponsorship_status: "unknown",
    ...overrides,
  };
}

describe("job detail route metadata", () => {
  it("emits a canonical and indexable metadata for an eligible role", async () => {
    readJobDetailMock.mockResolvedValue(job({}));
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "example-bank-graduate-analyst" }),
    });
    expect(metadata.alternates?.canonical).toBe("/jobs/example-bank-graduate-analyst");
    expect(metadata.title).toBe("Graduate Analyst at Example Bank in London | OfferLab");
    expect(metadata.robots).toBeUndefined();
  });

  it("does not index a thin public role while keeping follow enabled", async () => {
    readJobDetailMock.mockResolvedValue(
      job({
        application_deadline: null,
        description_summary: null,
        employment_type: null,
        experience_requirements: null,
        location_text: null,
        locations: [],
        normalized_title: null,
        opportunity_type: "unknown",
        posted_at: null,
        preferred_skills: [],
        remote_type: null,
        requirements: [],
        responsibilities: [],
        salary_currency: null,
        salary_max: null,
        salary_min: null,
        salary_period: null,
        sector_key: null,
        skills: [],
        slug: "example-bank-thin-role",
        subsector_key: null,
        visa_sponsorship_status: "unknown",
      }),
    );
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "example-bank-thin-role" }),
    });
    expect(metadata.robots).toEqual({ follow: true, index: false });
    expect(metadata.alternates?.canonical).toBe("/jobs/example-bank-thin-role");
  });

  it("does not index a missing role or leak details", async () => {
    readJobDetailMock.mockResolvedValue(null);
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "no-such-role" }),
    });
    expect(metadata.robots).toEqual({ follow: false, index: false });
    expect(metadata.title).toBe("Role not available | OfferLab");
    expect(metadata.alternates).toBeUndefined();
    expect(metadata.description).toBeUndefined();
  });

  it.each([
    ["draft", { publication_status: "draft" }],
    ["suppressed", { publication_status: "suppressed" }],
    ["ineligible", { eligibility_status: "ineligible" }],
    ["needs review", { eligibility_status: "needs_review" }],
    ["inactive", { active: false }],
    ["expired deadline", { application_deadline: new Date("2020-01-01T00:00:00Z") }],
  ])("keeps a %s role out of the index", async (_label, overrides) => {
    readJobDetailMock.mockResolvedValue(job(overrides));
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "example-bank-graduate-analyst" }),
    });
    expect(metadata.robots).toEqual({ follow: false, index: false });
    expect(metadata.title).toBe("Role not available | OfferLab");
  });
});
