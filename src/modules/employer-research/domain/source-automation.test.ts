import { describe, expect, it } from "vitest";

import {
  deriveSourceAutomationCandidates,
  deriveSourceAutomationPlan,
  sourceAutomationProbeMatches,
} from "./source-automation";

describe("source automation", () => {
  it.each([
    ["https://boards.greenhouse.io/acme", "greenhouseBoardToken", "acme"],
    ["https://jobs.lever.co/acme", "leverCompany", "acme"],
    ["https://jobs.ashbyhq.com/acme", "ashbyOrg", "acme"],
    ["https://jobs.smartrecruiters.com/Acme", "smartRecruitersCompany", "Acme"],
    ["https://apply.workable.com/acme", "workableAccount", "acme"],
    ["https://acme.teamtailor.com/jobs", "teamtailorCompany", "acme"],
  ])("derives a complete connector plan from %s", (url, key, value) => {
    const result = deriveSourceAutomationPlan(url);
    expect(result?.configuration).toMatchObject({ [key]: value });
    expect(result?.crawlEndpointUrl).toMatch(/^https:\/\//u);
  });

  it("derives and validates a Workday CXS plan", () => {
    const result = deriveSourceAutomationPlan("https://acme.wd3.myworkdayjobs.com/en-US/Careers");
    expect(result).toMatchObject({
      configuration: {
        cxsEndpoint: "https://acme.wd3.myworkdayjobs.com/wday/cxs/acme/Careers/jobs",
      },
      probe: { method: "POST" },
    });
    expect(sourceAutomationProbeMatches(result!, 200, '{"jobPostings":[]}')).toBe(true);
  });

  it("generates bounded Workday site hypotheses when research has only the tenant root", () => {
    const candidates = deriveSourceAutomationCandidates(
      "https://accenture.wd103.myworkdayjobs.com/",
      null,
      "Accenture",
    );
    expect(candidates.length).toBeGreaterThan(1);
    expect(
      candidates.some((candidate) => candidate.crawlEndpointUrl.includes("AccentureCareers")),
    ).toBe(true);
    expect(new Set(candidates.map((candidate) => candidate.crawlEndpointUrl)).size).toBe(
      candidates.length,
    );
  });

  it("does not automate an unsupported or weakly fingerprinted source", () => {
    expect(deriveSourceAutomationPlan("https://careers.acme.example/jobs")).toBeNull();
  });

  it("requires the expected provider response shape", () => {
    const plan = deriveSourceAutomationPlan("https://boards.greenhouse.io/acme")!;
    expect(sourceAutomationProbeMatches(plan, 200, '{"jobs":[]}')).toBe(true);
    expect(sourceAutomationProbeMatches(plan, 200, '{"content":[]}')).toBe(false);
    expect(sourceAutomationProbeMatches(plan, 500, '{"jobs":[]}')).toBe(false);
  });
});
