import { describe, expect, it } from "vitest";

import { evaluateEligibility } from "./eligibility";

function evaluate(overrides: Partial<Parameters<typeof evaluateEligibility>[0]> = {}) {
  return evaluateEligibility({
    applicationDeadline: null,
    description: "",
    title: "",
    ...overrides,
  });
}

describe("eligibility pipeline", () => {
  it("marks clear graduate schemes as eligible", () => {
    const result = evaluate({
      title: "Graduate Software Engineer",
      description: "Recent graduates are encouraged to apply.",
    });
    expect(result.status).toBe("eligible");
    expect(result.opportunityType).toBe("graduate_job");
    expect(result.reasons).toContain("title_early_career");
    expect(result.evidence.length).toBeGreaterThan(0);
  });

  it("recognises a graduate scheme from the title", () => {
    expect(evaluate({ title: "Graduate Scheme – Audit" }).opportunityType).toBe("graduate_scheme");
    expect(evaluate({ title: "Graduate Programme 2027" }).opportunityType).toBe("graduate_scheme");
  });

  it("recognises internships, placements, apprenticeships and vacation schemes", () => {
    expect(evaluate({ title: "Summer Internship – Investment Banking" }).opportunityType).toBe(
      "internship",
    );
    expect(evaluate({ title: "Industrial Placement – Engineering" }).opportunityType).toBe(
      "industrial_placement",
    );
    expect(evaluate({ title: "Degree Apprenticeship – Software" }).opportunityType).toBe(
      "degree_apprenticeship",
    );
    expect(evaluate({ title: "Vacation Scheme – Commercial Law" }).opportunityType).toBe(
      "vacation_scheme",
    );
    expect(evaluate({ title: "Training Contract 2027" }).opportunityType).toBe("training_contract");
    expect(evaluate({ title: "KTP Associate" }).opportunityType).toBe(
      "knowledge_transfer_partnership",
    );
  });

  it("keeps staff roles eligible while retaining the senior signal", () => {
    const result = evaluate({ title: "Staff Product Designer", description: "A key design role." });
    expect(result.status).toBe("eligible");
    expect(result.reasons).toContain("title_senior_signal");
  });

  it("keeps senior-only roles eligible with level evidence", () => {
    const result = evaluate({
      title: "Senior Manager, Client Delivery",
      description: "Experienced hire required.",
    });
    expect(result.status).toBe("eligible");
    expect(result.reasons).toContain("title_senior_signal");
    expect(result.reasons).toContain("description_senior_signal");
  });

  it("keeps roles requiring experience eligible", () => {
    const result = evaluate({
      description: "Candidates need at least 5 years of professional experience in risk.",
      title: "Risk Analyst",
    });
    expect(result.status).toBe("eligible");
    expect(result.reasons).toContain("experience_years_required");
    expect(result.evidence.some((phrase) => phrase.includes("5 years"))).toBe(true);
  });

  it("does not treat 1-2 years experience as a senior signal", () => {
    const result = evaluate({
      description: "Graduate role; up to 2 years experience considered.",
      title: "Graduate Risk Analyst",
    });
    expect(result.status).toBe("eligible");
  });

  it("does not exclude roles with both graduate and senior wording", () => {
    const result = evaluate({
      description: "Graduate programme; candidates must have 6 years of consulting experience.",
      title: "Senior Consultant",
    });
    expect(result.status).toBe("eligible");
  });

  it("does not use experienced wording as a publication gate", () => {
    const result = evaluate({
      description: "This is a good fit for a recent graduate or an experienced writer.",
      title: "Contract Writer",
    });
    expect(result.status).toBe("eligible");
  });

  it("keeps a general role eligible even without an early-career label", () => {
    const result = evaluate({
      title: "Commercial Executive",
      description: "Join our growing team.",
    });
    expect(result.status).toBe("eligible");
    expect(result.reasons).toContain("active_job_listing");
  });

  it("marks expired or closed applications as ineligible", () => {
    const result = evaluate({
      applicationDeadline: new Date("2020-01-01T00:00:00Z"),
      now: new Date("2026-01-01T00:00:00Z"),
      title: "Graduate Analyst",
    });
    expect(result.status).toBe("ineligible");
    expect(result.reasons).toContain("closed_or_expired");
  });

  it("keeps postgraduate opportunities eligible", () => {
    const result = evaluate({ title: "PhD Programme in Economics" });
    expect(result.status).toBe("eligible");
    expect(result.opportunityType).toBe("postgraduate_opportunity");
  });

  it("uses source-provided opportunity type as a strong signal", () => {
    const result = evaluate({
      sourceOpportunityType: "internship",
      title: "Data Analyst",
    });
    expect(result.status).toBe("eligible");
    expect(result.opportunityType).toBe("internship");
    expect(result.reasons).toContain("source_opportunity_type");
  });
});
