import { describe, expect, it } from "vitest";

import {
  parseSponsorRegister,
  sponsorRegisterNameKey,
  uniqueSponsorCompanySlug,
} from "./sponsor-register";

describe("sponsor register parsing", () => {
  it("aggregates repeated legal organisations, locations and routes", () => {
    const result = parseSponsorRegister([
      {
        "Organisation Name": " Example Limited ",
        "Town/City": "London",
        County: "",
        "Type & Rating": "Worker (A rating)",
        Route: "Skilled Worker",
      },
      {
        "Organisation Name": "EXAMPLE   LIMITED",
        "Town/City": "Leeds",
        County: "West Yorkshire",
        "Type & Rating": "Worker (A rating)",
        Route: "Global Business Mobility: Graduate Trainee",
      },
    ]);

    expect(result.organisations).toEqual([
      {
        legalName: "Example Limited",
        locations: ["Leeds, West Yorkshire", "London"],
        ratings: ["Worker (A rating)"],
        routes: ["Global Business Mobility: Graduate Trainee", "Skilled Worker"],
        rowCount: 2,
      },
    ]);
  });

  it("rejects missing names and produces stable collision-safe slugs", () => {
    expect(parseSponsorRegister([{ "Organisation Name": "" }]).rejected).toEqual([
      { row: 2, reason: "missing_name" },
    ]);
    const used = new Set(["example-limited", "employer"]);
    const first = uniqueSponsorCompanySlug("Example Limited", used);
    const unicode = uniqueSponsorCompanySlug("東京会社", used);
    expect(first).toMatch(/^example-limited-/u);
    expect(unicode).toMatch(/^employer-/u);
    expect(sponsorRegisterNameKey(" A   LIMITED ")).toBe("a limited");
  });
});
