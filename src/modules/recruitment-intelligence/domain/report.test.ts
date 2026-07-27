import { describe, expect, it } from "vitest";
import { createReportSlug, parseReport, parseReportFilters } from "./report";

const valid = {
  approximateDate: "2026-07-20",
  assessedSkills: ["Communication", "Prioritisation"],
  companyName: "EY",
  confidentialityConfirmed: true,
  formatSummary: "A timed group discussion followed by a short presentation",
  industry: "consulting",
  location: "London",
  opportunityType: "graduate_scheme",
  outcome: null,
  preparationAdvice: "Practise comparing options against explicit criteria.",
  recruitmentCycle: "2026/27",
  recruitmentStage: "assessment_centre",
  reflection: "Practise stating decision criteria early and making space for quieter contributors.",
  roleTitle: "Audit graduate programme",
  themes: "Prioritising options, explaining trade-offs and reaching a group recommendation.",
};

describe("recruitment intelligence report", () => {
  it("accepts controlled taxonomy and normalises skills", () => {
    expect(parseReport({ ...valid, assessedSkills: [" Communication ", "Communication"] })).toEqual(
      expect.objectContaining({
        ok: true,
        value: expect.objectContaining({ assessedSkills: ["Communication"] }),
      }),
    );
  });

  it.each([
    ["cycle", { recruitmentCycle: "current" }],
    ["stage", { recruitmentStage: "secret_stage" }],
    ["empty reflection", { reflection: "" }],
    [
      "too many skills",
      { assessedSkills: Array.from({ length: 11 }, (_, index) => `Skill ${index}`) },
    ],
    ["missing confidentiality confirmation", { confidentialityConfirmed: false }],
  ])("rejects %s", (_name, change) => {
    expect(parseReport({ ...valid, ...change }).ok).toBe(false);
  });

  it("creates stable, search-friendly slugs without exposing identity", () => {
    expect(
      createReportSlug("EY (UK)", "assessment_centre", "12345678-abcd-4000-8000-000000000001"),
    ).toBe("ey-uk-assessment-centre-12345678abcd");
  });

  it("accepts only controlled public filters", () => {
    expect(
      parseReportFilters(
        new URLSearchParams(
          "q=EY+audit&stage=assessment_centre&industry=technology&cycle=2026%2F27",
        ),
      ),
    ).toEqual({
      cycle: "2026/27",
      industry: "technology",
      query: "EY audit",
      stage: "assessment_centre",
    });
  });
});
