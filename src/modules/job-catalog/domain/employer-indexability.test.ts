import { describe, expect, it } from "vitest";

import { isEmployerIndexable, type EmployerIndexabilityEvidence } from "./employer-indexability";

function evidence(
  overrides: Partial<EmployerIndexabilityEvidence> = {},
): EmployerIndexabilityEvidence {
  return {
    active: true,
    description: null,
    hasImportedJobs: false,
    hasOfficialEmployerInfo: true,
    ...overrides,
  };
}

describe("employer indexability policy", () => {
  it("indexes a profile with a curated original description even without jobs", () => {
    expect(
      isEmployerIndexable(evidence({ description: "Synthetic retailer used only for tests." })),
    ).toBe(true);
  });

  it("indexes a profile with current imported jobs and official employer information", () => {
    expect(
      isEmployerIndexable(
        evidence({
          hasImportedJobs: true,
          hasOfficialEmployerInfo: true,
        }),
      ),
    ).toBe(true);
  });

  it("indexes a permanent profile with only historical imported jobs and zero active jobs", () => {
    expect(
      isEmployerIndexable(
        evidence({
          hasImportedJobs: true,
          hasOfficialEmployerInfo: true,
        }),
      ),
    ).toBe(true);
  });

  it("does not index a blank employer merely because it exists in the registry", () => {
    expect(isEmployerIndexable(evidence())).toBe(false);
  });

  it("does not index an employer that exists with directory metadata but no jobs and no description", () => {
    expect(
      isEmployerIndexable(
        evidence({
          hasImportedJobs: false,
          hasOfficialEmployerInfo: true,
        }),
      ),
    ).toBe(false);
  });

  it("does not treat whitespace-only descriptions as curated content", () => {
    expect(isEmployerIndexable(evidence({ description: "   \n " }))).toBe(false);
  });

  it("does not index imported jobs without official employer information", () => {
    expect(
      isEmployerIndexable(
        evidence({
          hasImportedJobs: true,
          hasOfficialEmployerInfo: false,
        }),
      ),
    ).toBe(false);
  });

  it("does not index an employer with official information but no jobs and no description", () => {
    expect(
      isEmployerIndexable(
        evidence({
          hasImportedJobs: false,
        }),
      ),
    ).toBe(false);
  });

  it("does not index an inactive employer even when it otherwise has sufficient evidence", () => {
    expect(
      isEmployerIndexable(
        evidence({
          active: false,
          description: "Original curated description retained for audit history.",
          hasImportedJobs: true,
        }),
      ),
    ).toBe(false);
  });
});
