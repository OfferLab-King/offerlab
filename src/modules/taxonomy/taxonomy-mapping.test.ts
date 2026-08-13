import { describe, expect, it } from "vitest";

import {
  careerLevelFromOpportunityAndSeniority,
  employerIndustryFromDirectorySector,
  jobFunctionFromLegacySubsector,
} from "./taxonomy-mapping";
import { jobFunctions } from "./job-function";
import { careerLevels } from "./career-level";
import { jobSubsectors, jobSectors } from "../job-catalog/domain/taxonomy";

describe("jobFunctionFromLegacySubsector", () => {
  it("maps every legacy subsector to a canonical function", () => {
    for (const subsector of jobSubsectors) {
      const mapped = jobFunctionFromLegacySubsector(subsector.key);
      expect(mapped, `subsector ${subsector.key}`).not.toBeNull();
      expect(jobFunctions).toContain(mapped);
    }
  });

  it("returns null for unknown values", () => {
    expect(jobFunctionFromLegacySubsector(null)).toBeNull();
    expect(jobFunctionFromLegacySubsector("not_a_key")).toBeNull();
  });

  it("never derives function from employer industry", () => {
    expect(jobFunctionFromLegacySubsector("software_development")).toBe("software_engineering");
    expect(jobFunctionFromLegacySubsector("trading")).toBe("markets_trading_research");
    expect(jobFunctionFromLegacySubsector("investment_banking")).toBe(
      "investment_banking_corporate_finance",
    );
  });
});

describe("careerLevelFromOpportunityAndSeniority", () => {
  it("derives career level from opportunity type first", () => {
    expect(careerLevelFromOpportunityAndSeniority("graduate_scheme", "mid")).toBe("graduate");
    expect(careerLevelFromOpportunityAndSeniority("internship", null)).toBe("intern");
    expect(careerLevelFromOpportunityAndSeniority("apprenticeship", null)).toBe("school_leaver");
    expect(careerLevelFromOpportunityAndSeniority("industrial_placement", null)).toBe("student");
    expect(careerLevelFromOpportunityAndSeniority("training_contract", null)).toBe("graduate");
    expect(careerLevelFromOpportunityAndSeniority("immediate_start", null)).toBe("entry_level");
  });

  it("falls back to seniority then unknown", () => {
    expect(careerLevelFromOpportunityAndSeniority("unknown", "senior")).toBe("experienced");
    expect(careerLevelFromOpportunityAndSeniority("unknown", "manager")).toBe("manager");
    expect(careerLevelFromOpportunityAndSeniority(null, null)).toBe("unknown");
  });

  it("keeps general and experienced roles valid", () => {
    expect(careerLevels).toContain("experienced");
    expect(careerLevelFromOpportunityAndSeniority("unknown", "mid")).toBe("experienced");
  });
});

describe("employerIndustryFromDirectorySector", () => {
  it("maps legacy directory sectors to employer industries", () => {
    expect(employerIndustryFromDirectorySector("financial_services")).toBe("financial_services");
    expect(employerIndustryFromDirectorySector("technology_it")).toBe("technology_software");
    expect(employerIndustryFromDirectorySector("law")).toBe("legal_services");
    expect(employerIndustryFromDirectorySector("consulting")).toBe(
      "professional_services_consulting",
    );
    expect(employerIndustryFromDirectorySector(null)).toBeNull();
    expect(employerIndustryFromDirectorySector("bogus")).toBeNull();
  });

  it("covers every legacy directory sector key", () => {
    for (const sector of jobSectors) {
      expect(
        employerIndustryFromDirectorySector(sector.key),
        `sector ${sector.key}`,
      ).not.toBeNull();
    }
  });
});
