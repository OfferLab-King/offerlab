import { describe, expect, it } from "vitest";

import {
  employerIndustries,
  employerIndustryFromResearchSector,
  employerIndustrySubindustries,
} from "./employer-industry";
import { jobFunctions, jobSubfunctionFamilies } from "./job-function";

describe("employer industry taxonomy contract", () => {
  it("defines the canonical industry keys with labels and subindustries", () => {
    expect(employerIndustries).toContain("financial_services");
    expect(employerIndustries).toContain("professional_services_consulting");
    expect(employerIndustries).toContain("technology_software");
    expect(employerIndustries).toContain("other");
    expect(new Set(employerIndustries).size).toBe(employerIndustries.length);
    for (const key of employerIndustries) {
      expect(Array.isArray(employerIndustrySubindustries[key])).toBe(true);
    }
  });

  it("maps Top 1,000 workbook sectors deterministically", () => {
    expect(employerIndustryFromResearchSector("Financial Services")).toBe("financial_services");
    expect(employerIndustryFromResearchSector("Technology")).toBe("technology_software");
    expect(employerIndustryFromResearchSector("Professional Services")).toBe(
      "professional_services_consulting",
    );
    expect(employerIndustryFromResearchSector("Consumer")).toBe("consumer_retail_fmcg");
    expect(employerIndustryFromResearchSector("Energy & Utilities")).toBe(
      "energy_utilities_infrastructure",
    );
    expect(employerIndustryFromResearchSector(null)).toBe("other");
    expect(employerIndustryFromResearchSector("Something Unknown")).toBe("other");
  });
});

describe("job function taxonomy contract", () => {
  it("defines the canonical job function keys with subfunctions", () => {
    expect(jobFunctions).toContain("software_engineering");
    expect(jobFunctions).toContain("investment_banking_corporate_finance");
    expect(new Set(jobFunctions).size).toBe(jobFunctions.length);
    for (const key of jobFunctions) {
      expect(Array.isArray(jobSubfunctionFamilies[key])).toBe(true);
    }
  });
});
