import { describe, expect, it } from "vitest";
import { parseJobSearchRequest } from "./job-search";

describe("job search request", () => {
  it("normalizes POST input and applies conservative defaults", () => {
    expect(
      parseJobSearchRequest({
        employmentTypes: ["FULLTIME", "FULLTIME", "INTERN"],
        location: "  Greater   London ",
        role: " Graduate   software developer ",
      }),
    ).toEqual({
      datePosted: "all",
      employmentTypes: ["FULLTIME", "INTERN"],
      jobRequirements: [],
      location: "Greater London",
      remoteOnly: false,
      role: "Graduate software developer",
    });
  });

  it("rejects unknown POST properties and control characters", () => {
    expect(() =>
      parseJobSearchRequest({ location: "London", role: "Developer", country: "us" }),
    ).toThrow();
    expect(() =>
      parseJobSearchRequest({ location: "London", role: "Developer\nvia example" }),
    ).toThrow();
  });

  it("bounds cursor, radius, and filters", () => {
    expect(() =>
      parseJobSearchRequest({ location: "London", radiusKm: 201, role: "Developer" }),
    ).toThrow();
    expect(() =>
      parseJobSearchRequest({ cursor: "x".repeat(2049), location: "London", role: "Developer" }),
    ).toThrow();
    expect(() =>
      parseJobSearchRequest({ datePosted: "yesterday", location: "London", role: "Developer" }),
    ).toThrow();
  });
});
