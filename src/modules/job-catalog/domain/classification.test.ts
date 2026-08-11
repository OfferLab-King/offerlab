import { describe, expect, it } from "vitest";

import { classifyJob, classificationRequiresReview } from "./classification";

describe("deterministic classification", () => {
  it("classifies software roles from the title with high confidence", () => {
    const result = classifyJob({ title: "Graduate Software Engineer" });
    expect(result.subsectorKey).toBe("software_development");
    expect(result.sectorKey).toBe("technology_it");
    expect(result.confidence).toBe("high");
    expect(result.source).toBe("deterministic");
  });

  it("classifies audit and banking roles", () => {
    expect(classifyJob({ title: "Audit Graduate Trainee" }).subsectorKey).toBe(
      "accounting_audit_tax",
    );
    expect(classifyJob({ title: "Investment Banking Analyst" }).subsectorKey).toBe(
      "investment_banking",
    );
    expect(classifyJob({ title: "Sales and Trading Graduate" }).subsectorKey).toBe("trading");
  });

  it("classifies from department/team when the title is generic", () => {
    const result = classifyJob({ department: "Data", title: "Graduate Analyst" });
    expect(result.subsectorKey).toBe("data_science_analytics");
  });

  it("returns needs-review for unknown titles", () => {
    const result = classifyJob({ title: "Operations Associate" });
    expect(result.subsectorKey).toBeNull();
    expect(result.sectorKey).toBeNull();
    expect(classificationRequiresReview(result)).toBe(true);
  });

  it("keeps weak ambiguous matches in review", () => {
    const result = classifyJob({ title: "Consultant" });
    expect(result.confidence).toBe("low");
    expect(classificationRequiresReview(result)).toBe(true);
  });

  it("does not let a consulting keyword override a strong software title", () => {
    const result = classifyJob({ title: "Senior Consultant – Software Engineering" });
    expect(result.subsectorKey).toBe("software_development");
  });
});
