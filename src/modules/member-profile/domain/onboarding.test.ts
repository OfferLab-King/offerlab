import { describe, expect, it } from "vitest";

import {
  canonicalIndustriesFromLegacy,
  completionErrors,
  isOnboardingComplete,
  parseOnboardingInput,
} from "./onboarding";

const validInput = {
  confidence: null,
  educationStage: "undergraduate",
  industries: ["consulting"],
  intent: "complete",
  opportunityTypes: ["graduate_scheme"],
  preparationPriorities: ["application_cv"],
  supportNeeds: [],
  targetCompanies: [],
} as const;

describe("onboarding validation", () => {
  it.each([
    ["educationStage", { educationStage: null }],
    ["opportunityTypes", { opportunityTypes: [] }],
    ["industries", { industries: [] }],
    ["preparationPriorities", { preparationPriorities: [] }],
  ] as const)("identifies a missing required %s", (field, replacement) => {
    const parsed = parseOnboardingInput({ ...validInput, ...replacement });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(completionErrors(parsed.value.answers)[field]).toBeDefined();
    expect(isOnboardingComplete(parsed.value.answers)).toBe(false);
  });

  it.each([
    ["educationStage", "unknown"],
    ["opportunityTypes", ["unknown"]],
    ["industries", ["unknown"]],
    ["preparationPriorities", ["unknown"]],
    ["supportNeeds", ["unknown"]],
    ["confidence", "unknown"],
  ])("rejects an unknown controlled %s value", (field, value) => {
    const parsed = parseOnboardingInput({ ...validInput, [field]: value });
    expect(parsed.ok).toBe(false);
  });

  it.each([
    ["opportunityTypes", Array(5).fill("internship")],
    ["industries", Array(9).fill("technology")],
    ["preparationPriorities", Array(9).fill("online_tests")],
    ["supportNeeds", Array(7).fill("feedback")],
    ["targetCompanies", Array(11).fill("Company")],
  ])("enforces the %s array limit", (field, value) => {
    expect(parseOnboardingInput({ ...validInput, [field]: value }).ok).toBe(false);
  });

  it("normalizes and deduplicates target companies", () => {
    const parsed = parseOnboardingInput({
      ...validInput,
      targetCompanies: ["  Acme   UK ", "acme uk", "", " Example Plc ", "Cafe\u0301"],
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.answers.targetCompanies).toEqual(["Acme UK", "Example Plc", "Café"]);
    }
  });

  it("rejects extra fields and oversized company names", () => {
    expect(parseOnboardingInput({ ...validInput, internalUserId: "secret" }).ok).toBe(false);
    expect(parseOnboardingInput({ ...validInput, targetCompanies: ["x".repeat(81)] }).ok).toBe(
      false,
    );
  });
});

describe("Phase G onboarding dimensions", () => {
  it("derives canonical target industries from legacy choices", () => {
    expect(canonicalIndustriesFromLegacy(["technology", "financial_services"])).toEqual([
      "technology_software",
      "financial_services",
    ]);
    expect(canonicalIndustriesFromLegacy(["consulting"])).toEqual([
      "professional_services_consulting",
    ]);
    expect(canonicalIndustriesFromLegacy([])).toEqual([]);
  });

  it("accepts explicit canonical preferences and normalizes locations", () => {
    const result = parseOnboardingInput({
      ...validInput,
      targetIndustries: ["technology_software"],
      targetFunctions: ["software_engineering", "data_analytics_ai"],
      preferredLocations: ["  London ", "Manchester"],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.answers.targetIndustries).toEqual(["technology_software"]);
    expect(result.value.answers.targetFunctions).toEqual([
      "software_engineering",
      "data_analytics_ai",
    ]);
    expect(result.value.answers.preferredLocations).toEqual(["london", "manchester"]);
  });

  it("falls back to legacy-derived industries when no canonical preference is given", () => {
    const result = parseOnboardingInput({ ...validInput, industries: ["technology"] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.answers.targetIndustries).toEqual(["technology_software"]);
  });
});
