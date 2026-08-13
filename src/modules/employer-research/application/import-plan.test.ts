import { describe, expect, it } from "vitest";

import {
  buildEmployerImportPlan,
  existingCandidateKey,
  existingSnapshotKey,
  planTotals,
  type EmployerImportState,
} from "./import-plan";
import type { EmployerResearchRow } from "../domain/research-row";

const DATASET = "2026-08-12-enhanced-v2";
const RESEARCH_DATE = "2026-08-12";

function row(
  overrides: Partial<EmployerResearchRow> & { rank: number; canonicalEmployer: string },
): EmployerResearchRow {
  return {
    priorityTier: "P0",
    crawlerWave: "Wave 1",
    primarySponsorLegalEntity: null,
    townCity: null,
    identityConfidence: "High",
    identityMappingNote: null,
    employerValueScore: null,
    crawlerReadinessScore: null,
    crawlerPriorityScore: null,
    sponsorshipScore: null,
    earlyCareerScore: null,
    scaleScore: null,
    brandMarketScore: null,
    ukRelevanceScore: null,
    sectorScore: null,
    listingOwnershipScore: null,
    sourceLeverageScore: null,
    sector: null,
    subsector: null,
    financeAssetClass: null,
    employeeCount: null,
    employeeBand: null,
    employeeScope: null,
    employeeSource: null,
    employeeConfidence: null,
    ownership: null,
    ownershipConfidence: null,
    ticker: null,
    exchange: null,
    skilledWorkerSponsor: null,
    graduateTraineeRoute: null,
    seniorSpecialistRoute: null,
    sponsorRoutes: null,
    careerSearchUrl: null,
    atsPlatform: null,
    atsVerificationStatus: null,
    atsEvidenceNotes: null,
    sourceVerificationDate: null,
    currentJobsObserved: null,
    currentJobsScopeNote: null,
    recommendedDiscoveryStrategy: null,
    researchStatus: "not_researched",
    evidenceUrls: [],
    notes: null,
    ...overrides,
  };
}

function emptyState(): EmployerImportState {
  return {
    companies: [],
    aliases: [],
    existingSlugs: new Set(),
    existingSponsorKeys: new Set(),
    existingSnapshotKeys: new Set(),
    existingCandidateKeys: new Set(),
    liveSourceCompanyIds: new Set(),
  };
}

describe("buildEmployerImportPlan", () => {
  it("plans new employers for unknown high-confidence rows with deterministic slugs", () => {
    const rows = [
      row({ rank: 1, canonicalEmployer: "Amazon", careerSearchUrl: "https://www.amazon.jobs/" }),
      row({ rank: 2, canonicalEmployer: "Lloyds Banking Group" }),
    ];
    const plan = buildEmployerImportPlan(rows, emptyState(), DATASET, RESEARCH_DATE);
    expect(plan.newEmployers).toHaveLength(2);
    expect(plan.newEmployers[0]).toMatchObject({ proposedSlug: "amazon" });
    expect(plan.newEmployers[1]).toMatchObject({ proposedSlug: "lloyds-banking-group" });
    expect(plan.ambiguousIdentities).toHaveLength(0);
  });

  it("matches existing companies without proposing new slugs", () => {
    const rows = [row({ rank: 1, canonicalEmployer: "Monzo" })];
    const plan = buildEmployerImportPlan(
      rows,
      {
        ...emptyState(),
        companies: [{ id: "c1", name: "Monzo", slug: "monzo", websiteUrl: "https://monzo.com" }],
        existingSlugs: new Set(["monzo"]),
      },
      DATASET,
      RESEARCH_DATE,
    );
    expect(plan.matchedEmployers).toHaveLength(1);
    expect(plan.matchedEmployers[0]!.match.companyId).toBe("c1");
    expect(plan.newEmployers).toHaveLength(0);
    expect(plan.unchangedEmployers).toHaveLength(1);
  });

  it("plans website backfill only when the company has no website", () => {
    const rows = [
      row({
        rank: 1,
        canonicalEmployer: "Deutsche Bank",
        evidenceUrls: ["https://careers.db.com", "https://www.gov.uk/register"],
      }),
    ];
    const plan = buildEmployerImportPlan(
      rows,
      {
        ...emptyState(),
        companies: [{ id: "c3", name: "Deutsche Bank", slug: "deutsche-bank", websiteUrl: null }],
        existingSlugs: new Set(["deutsche-bank"]),
      },
      DATASET,
      RESEARCH_DATE,
    );
    expect(plan.updatedEmployers).toHaveLength(1);
    expect(plan.updatedEmployers[0]!.proposedWebsiteUrl).toBe("https://careers.db.com");
    expect(plan.unchangedEmployers).toHaveLength(0);
  });

  it("preserves ambiguous identities for review without creating companies", () => {
    const rows = [
      row({ rank: 1, canonicalEmployer: "BDO", identityConfidence: "Medium" }),
      row({ rank: 2, canonicalEmployer: "Monzo", identityConfidence: "Medium" }),
    ];
    const plan = buildEmployerImportPlan(
      rows,
      {
        ...emptyState(),
        companies: [{ id: "c1", name: "Monzo", slug: "monzo", websiteUrl: null }],
        existingSlugs: new Set(["monzo"]),
      },
      DATASET,
      RESEARCH_DATE,
    );
    expect(plan.ambiguousIdentities).toHaveLength(2);
    expect(plan.ambiguousIdentities.every((entry) => entry.match.companyId === null)).toBe(true);
    expect(plan.newEmployers).toHaveLength(0);
    expect(plan.matchedEmployers).toHaveLength(0);
  });

  it("keeps sponsor legal entities one-to-many with deterministic first-wins on duplicates", () => {
    const rows = [
      row({
        rank: 1,
        canonicalEmployer: "Coca-Cola Europacific Partners",
        primarySponsorLegalEntity: "COCA-COLA EUROPACIFIC PARTNERS HOLDINGS GREAT BRITIAN LIMITED",
      }),
      row({
        rank: 2,
        canonicalEmployer: "Coca-Cola",
        primarySponsorLegalEntity: "COCA-COLA EUROPACIFIC PARTNERS HOLDINGS GREAT BRITIAN LIMITED",
      }),
    ];
    const plan = buildEmployerImportPlan(rows, emptyState(), DATASET, RESEARCH_DATE);
    expect(plan.sponsorsAdded).toHaveLength(1);
    expect(plan.rejectedRows).toHaveLength(1);
    expect(plan.rejectedRows[0]!.reason).toContain("already mapped");
  });

  it("is idempotent: a second plan against applied state adds nothing", () => {
    const rows = [
      row({ rank: 1, canonicalEmployer: "Amazon", careerSearchUrl: "https://www.amazon.jobs/" }),
      row({ rank: 2, canonicalEmployer: "Monzo" }),
    ];
    buildEmployerImportPlan(rows, emptyState(), DATASET, RESEARCH_DATE);
    const appliedState: EmployerImportState = {
      companies: [
        { id: "p-amazon", name: "Amazon", slug: "amazon", websiteUrl: null },
        { id: "c1", name: "Monzo", slug: "monzo", websiteUrl: "https://monzo.com" },
      ],
      aliases: [{ alias: "Amazon", companyId: "p-amazon" }],
      existingSlugs: new Set(["amazon", "monzo"]),
      existingSponsorKeys: new Set(),
      existingSnapshotKeys: new Set(
        rows.map((r) => existingSnapshotKey(DATASET, RESEARCH_DATE, r.rank)),
      ),
      existingCandidateKeys: new Set([
        existingCandidateKey("p-amazon", "https://www.amazon.jobs/"),
      ]),
      liveSourceCompanyIds: new Set(["c1"]),
    };
    const second = buildEmployerImportPlan(rows, appliedState, DATASET, RESEARCH_DATE);
    expect(second.newEmployers).toHaveLength(0);
    expect(second.snapshotsAdded).toHaveLength(0);
    expect(second.snapshotsUnchanged).toHaveLength(2);
    expect(second.candidatesAdded).toHaveLength(0);
    expect(second.candidatesUnchanged).toHaveLength(1);
    expect(planTotals(second).matchedEmployers).toBe(2);
    expect(planTotals(second).updatedEmployers).toBe(0);
    expect(planTotals(second).unchangedEmployers).toBe(2);
  });

  it("never plans writes to the live source registry", () => {
    const rows = [
      row({ rank: 1, canonicalEmployer: "Amazon", careerSearchUrl: "https://www.amazon.jobs/" }),
      row({ rank: 2, canonicalEmployer: "Wise", careerSearchUrl: "https://wise.com/jobs" }),
    ];
    const state: EmployerImportState = {
      ...emptyState(),
      liveSourceCompanyIds: new Set(["c-wise"]),
    };
    const plan = buildEmployerImportPlan(rows, state, DATASET, RESEARCH_DATE);
    expect(plan.candidatesAdded).toHaveLength(2);
    expect(Object.keys(plan)).not.toContain("jobSources");
    expect(plan.rejectedRows).toHaveLength(0);
  });

  it("retains provenance and confidence in the plan", () => {
    const rows = [
      row({
        rank: 1,
        canonicalEmployer: "Reckitt",
        primarySponsorLegalEntity: "Reckitt Benckiser Group Plc",
        identityConfidence: "High",
        identityMappingNote: "Manual/exact group mapping",
        researchStatus: "verified_platform",
        evidenceUrls: ["https://www.gov.uk/register"],
        notes: "notes",
      }),
    ];
    const plan = buildEmployerImportPlan(rows, emptyState(), DATASET, RESEARCH_DATE);
    expect(plan.snapshotsAdded).toHaveLength(1);
    expect(plan.sponsorsAdded).toEqual(["Reckitt Benckiser Group Plc"]);
  });

  it("rejects invalid ranks", () => {
    const plan = buildEmployerImportPlan(
      [row({ rank: 0, canonicalEmployer: "Broken" })],
      emptyState(),
      DATASET,
      RESEARCH_DATE,
    );
    expect(plan.rejectedRows).toHaveLength(1);
    expect(planTotals(plan).newEmployers).toBe(0);
  });

  it("reports total rows across all buckets", () => {
    const rows = [
      row({ rank: 1, canonicalEmployer: "New Employer" }),
      row({ rank: 2, canonicalEmployer: "Monzo" }),
      row({ rank: 3, canonicalEmployer: "BDO", identityConfidence: "Medium" }),
    ];
    const plan = buildEmployerImportPlan(
      rows,
      {
        ...emptyState(),
        companies: [{ id: "c1", name: "Monzo", slug: "monzo", websiteUrl: null }],
        existingSlugs: new Set(["monzo"]),
      },
      DATASET,
      RESEARCH_DATE,
    );
    const totals = planTotals(plan);
    expect(totals.totalRows).toBe(3);
  });
});
