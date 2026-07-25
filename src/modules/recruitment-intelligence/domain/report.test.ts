import { describe, expect, it } from "vitest";
import { parseReport } from "./report";

const valid = {
  approximateDate: "2026-07-20",
  assessedSkills: ["Communication", "Prioritisation"],
  formatSummary: "A timed group discussion followed by a short presentation",
  industry: "consulting",
  opportunityType: "graduate_scheme",
  recruitmentCycle: "2026/27",
  recruitmentStage: "assessment_centre",
  reflection: "Practise stating decision criteria early and making space for quieter contributors.",
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
  ])("rejects %s", (_name, change) => {
    expect(parseReport({ ...valid, ...change }).ok).toBe(false);
  });
});
