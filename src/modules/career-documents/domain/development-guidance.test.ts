import { describe, expect, it } from "vitest";
import { developmentRecommendations } from "./development-guidance";

describe("career-document development guidance", () => {
  it("maps explicit gaps to bounded projects and curated learning", () => {
    const result = developmentRecommendations([
      "Advanced SQL querying and data manipulation",
      "Dashboard development using Power BI or Tableau",
      "Python for statistical analysis",
    ]);

    expect(result.map(({ skill }) => skill)).toEqual([
      "SQL and data querying",
      "Dashboards and data visualisation",
      "Python data analysis",
    ]);
    expect(result[0]?.offerLab.path).toBe("/member/learn/sql-evidence-project");
    expect(result[0]?.external?.url).toBe("https://www.coursera.org/learn/sql-for-data-science");
  });

  it("returns one generic evidence project for an unmapped requirement", () => {
    expect(developmentRecommendations(["Experience planning regulated fieldwork"])).toEqual([
      expect.objectContaining({
        skill: "Role-relevant evidence",
        offerLab: expect.objectContaining({ path: "/member/learn/role-evidence-project" }),
      }),
    ]);
  });

  it("keeps an evidence-building explanation for every unmapped gap", () => {
    const result = developmentRecommendations([
      "Advanced SQL querying and data manipulation",
      "Experience planning regulated fieldwork",
    ]);

    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({
      gap: "Experience planning regulated fieldwork",
      skill: "Role-relevant evidence",
    });
    expect(result[1]?.project).toContain("Experience planning regulated fieldwork");
  });
});
