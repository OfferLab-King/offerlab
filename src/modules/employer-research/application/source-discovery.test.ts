import { describe, expect, it } from "vitest";

import type { PlatformCoverageSourceData } from "../infrastructure/discovery-repository";
import {
  computePlatformCoverage,
  planCandidateFingerprint,
  planCandidatePromotion,
} from "./source-discovery";
import type { DiscoveryCandidate } from "../infrastructure/discovery-repository";

function candidate(overrides: Partial<DiscoveryCandidate> = {}): DiscoveryCandidate {
  return {
    candidateId: "cand-1",
    companyId: "co-1",
    companyName: "Acme",
    companySlug: "acme",
    tier: "P0",
    crawlerPriorityScore: 90,
    candidateUrl: "https://acme.example.com/careers",
    candidateEndpoint: null,
    platformHint: null,
    channel: "general",
    status: "candidate_found",
    confidence: null,
    discoveryMethod: null,
    researchStatus: null,
    atsVerificationStatus: null,
    verifiedAt: null,
    liveSources: 0,
    atsProviders: null,
    ...overrides,
  };
}

describe("computePlatformCoverage", () => {
  const data: PlatformCoverageSourceData = {
    snapshots: [
      { companyId: "co-1", tier: "P0", atsPlatform: "Workday" },
      { companyId: "co-2", tier: "P1", atsPlatform: "Workday" },
      { companyId: "co-3", tier: "P2", atsPlatform: "Not researched" },
      { companyId: null, tier: "P0", atsPlatform: "Workday" },
    ],
    candidates: [
      { companyId: "co-1", platformHint: "Workday", status: "verified" },
      { companyId: "co-3", platformHint: null, status: "candidate_found" },
    ],
    jobSources: [{ companyId: "co-3", atsProvider: "greenhouse" }],
  };

  it("prefers live source evidence, then candidates, then research snapshots", () => {
    const coverage = computePlatformCoverage(data);
    const workday = coverage.rows.find((row) => row.platform === "workday")!;
    const greenhouse = coverage.rows.find((row) => row.platform === "greenhouse")!;
    expect(workday.employers).toBe(2);
    expect(workday.p0).toBe(1);
    expect(workday.p1).toBe(1);
    expect(workday.verified).toBe(1);
    expect(greenhouse.employers).toBe(1);
    expect(greenhouse.live).toBe(1);
  });

  it("counts totals across all platforms and ignores unresolved rows", () => {
    const coverage = computePlatformCoverage(data);
    expect(coverage.totals.employers).toBe(3);
    expect(coverage.totals.p0).toBe(1);
    expect(coverage.totals.p1).toBe(1);
    expect(coverage.totals.p2).toBe(1);
    expect(coverage.totals.verified).toBe(1);
    expect(coverage.totals.live).toBe(1);
  });
});

describe("planCandidateFingerprint", () => {
  it("identifies the platform from the candidate URL", () => {
    const plan = planCandidateFingerprint(
      candidate({ candidateUrl: "https://jobs.lever.co/acme" }),
    );
    expect(plan.changed).toBe(true);
    expect(plan.nextStatus).toBe("platform_identified");
    expect(plan.fingerprint).toMatchObject({ platform: "lever", confidence: "high" });
  });

  it("keeps the candidate unchanged when platform and status already match", () => {
    const plan = planCandidateFingerprint(
      candidate({
        candidateUrl: "https://boards.greenhouse.io/acme",
        platformHint: "Greenhouse",
        status: "platform_identified",
      }),
    );
    expect(plan.changed).toBe(false);
    expect(plan.nextStatus).toBe("platform_identified");
  });

  it("never downgrades a verified or promoted candidate", () => {
    const plan = planCandidateFingerprint(
      candidate({ candidateUrl: "https://careers.acme.com", status: "verified" }),
    );
    expect(plan.nextStatus).toBe("verified");
  });

  it("marks unknown platforms as candidate_found only when unresearched", () => {
    const plan = planCandidateFingerprint(
      candidate({ candidateUrl: "https://careers.acme.com", status: "not_researched" }),
    );
    expect(plan.nextStatus).toBe("candidate_found");
  });
});

describe("planCandidatePromotion", () => {
  it("promotes a verified high-confidence candidate", () => {
    const plan = planCandidatePromotion(
      candidate({
        candidateUrl: "https://jobs.smartrecruiters.com/Acme",
        status: "verified",
        verifiedAt: new Date(),
        atsVerificationStatus: "typed_api_verified",
      }),
    );
    expect(plan.promotable).toBe(true);
    expect(plan.platform).toBe("smartrecruiters");
    expect(plan.automation).toMatchObject({
      configuration: { smartRecruitersCompany: "Acme" },
      sourceType: "smartrecruiters",
    });
  });

  it("refuses to promote unverified candidates", () => {
    const plan = planCandidatePromotion(
      candidate({
        candidateUrl: "https://jobs.smartrecruiters.com/Acme",
        status: "candidate_found",
      }),
    );
    expect(plan.promotable).toBe(false);
    expect(plan.reason).toContain("not verified");
  });

  it("refuses to promote unknown or low-confidence platforms", () => {
    const plan = planCandidatePromotion(
      candidate({
        atsVerificationStatus: "typed_api_verified",
        candidateUrl: "https://careers.acme.com",
        status: "verified",
      }),
    );
    expect(plan.promotable).toBe(false);
    expect(plan.reason).toContain("not high confidence");
  });
});
