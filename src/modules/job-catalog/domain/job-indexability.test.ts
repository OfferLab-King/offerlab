import { describe, expect, it } from "vitest";

import {
  hasSufficientFactualValue,
  isJobIndexable,
  type JobIndexabilityEvidence,
} from "./job-indexability";

function evidence(overrides: Partial<JobIndexabilityEvidence> = {}): JobIndexabilityEvidence {
  return {
    active: true,
    application_deadline: null,
    application_url: "https://employer.example.com/apply",
    degree_requirements: [],
    description_summary: null,
    eligibility_status: "eligible",
    employment_type: null,
    experience_requirements: null,
    first_seen_at: new Date("2026-08-01T00:00:00Z"),
    location_text: null,
    opportunity_type: "unknown",
    posted_at: null,
    preferred_skills: [],
    publication_status: "published",
    remote_type: null,
    requirements: [],
    salary_max: null,
    salary_min: null,
    responsibilities: [],
    sector_key: null,
    skills: [],
    subsector_key: null,
    visa_sponsorship_status: "unknown",
    ...overrides,
  };
}

const now = new Date("2026-08-10T00:00:00Z");

describe("job factual value policy", () => {
  it("treats a title-only role as thin", () => {
    expect(hasSufficientFactualValue(evidence())).toBe(false);
  });

  it("accepts each stored verified field as factual value", () => {
    expect(
      hasSufficientFactualValue(evidence({ description_summary: "A verified summary." })),
    ).toBe(true);
    expect(hasSufficientFactualValue(evidence({ responsibilities: ["Run projects"] }))).toBe(true);
    expect(hasSufficientFactualValue(evidence({ requirements: ["Strong maths"] }))).toBe(true);
    expect(hasSufficientFactualValue(evidence({ skills: ["SQL"] }))).toBe(true);
    expect(hasSufficientFactualValue(evidence({ preferred_skills: ["Python"] }))).toBe(true);
    expect(hasSufficientFactualValue(evidence({ degree_requirements: ["2:1 degree"] }))).toBe(true);
    expect(hasSufficientFactualValue(evidence({ experience_requirements: "Two years" }))).toBe(
      true,
    );
    expect(hasSufficientFactualValue(evidence({ location_text: "London" }))).toBe(true);
    expect(hasSufficientFactualValue(evidence({ employment_type: "full_time" }))).toBe(true);
    expect(hasSufficientFactualValue(evidence({ remote_type: "hybrid" }))).toBe(true);
    expect(hasSufficientFactualValue(evidence({ opportunity_type: "graduate_scheme" }))).toBe(true);
    expect(hasSufficientFactualValue(evidence({ sector_key: "technology_it" }))).toBe(true);
    expect(hasSufficientFactualValue(evidence({ subsector_key: "software_development" }))).toBe(
      true,
    );
    expect(hasSufficientFactualValue(evidence({ visa_sponsorship_status: "confirmed" }))).toBe(
      true,
    );
    expect(hasSufficientFactualValue(evidence({ salary_min: 30_000 }))).toBe(true);
    expect(hasSufficientFactualValue(evidence({ salary_max: 35_000 }))).toBe(true);
    expect(
      hasSufficientFactualValue(
        evidence({ application_deadline: new Date("2026-12-01T00:00:00Z") }),
      ),
    ).toBe(true);
    expect(
      hasSufficientFactualValue(evidence({ posted_at: new Date("2026-08-01T00:00:00Z") })),
    ).toBe(true);
  });

  it("does not treat placeholder or whitespace values as factual value", () => {
    expect(hasSufficientFactualValue(evidence({ employment_type: "unknown" }))).toBe(false);
    expect(hasSufficientFactualValue(evidence({ remote_type: "unknown" }))).toBe(false);
    expect(hasSufficientFactualValue(evidence({ opportunity_type: "unknown" }))).toBe(false);
    expect(hasSufficientFactualValue(evidence({ visa_sponsorship_status: "unknown" }))).toBe(false);
    expect(hasSufficientFactualValue(evidence({ description_summary: "   \n " }))).toBe(false);
    expect(hasSufficientFactualValue(evidence({ location_text: "" }))).toBe(false);
  });
});

describe("job indexability policy", () => {
  it("indexes a publicly visible role with an official posting date and substantive description", () => {
    expect(
      isJobIndexable(
        evidence({
          description_summary: "A factual summary of the employer's role.",
          posted_at: new Date("2026-08-01T00:00:00Z"),
        }),
        now,
      ),
    ).toBe(true);
  });

  it("keeps a thin but publicly valid role out of the index", () => {
    expect(isJobIndexable(evidence(), now)).toBe(false);
  });

  it("never indexes a role without an official application URL", () => {
    expect(
      isJobIndexable(evidence({ application_url: null, sector_key: "financial_services" }), now),
    ).toBe(false);
    expect(
      isJobIndexable(evidence({ application_url: "   ", sector_key: "financial_services" }), now),
    ).toBe(false);
  });

  it("does not index a role without the employer's original posting date", () => {
    expect(
      isJobIndexable(
        evidence({ description_summary: "A factual summary of the employer's role." }),
        now,
      ),
    ).toBe(false);
  });

  it("does not index taxonomy-only or location-only pages as complete job postings", () => {
    const posted_at = new Date("2026-08-01T00:00:00Z");
    expect(isJobIndexable(evidence({ location_text: "London", posted_at }), now)).toBe(false);
    expect(isJobIndexable(evidence({ posted_at, sector_key: "financial_services" }), now)).toBe(
      false,
    );
  });

  it("never indexes non-public lifecycle states even with full factual value", () => {
    const full = evidence({ description_summary: "Full verified description." });
    expect(isJobIndexable({ ...full, publication_status: "draft" }, now)).toBe(false);
    expect(isJobIndexable({ ...full, publication_status: "suppressed" }, now)).toBe(false);
    expect(isJobIndexable({ ...full, publication_status: "expired" }, now)).toBe(false);
    expect(isJobIndexable({ ...full, eligibility_status: "ineligible" }, now)).toBe(false);
    expect(isJobIndexable({ ...full, eligibility_status: "needs_review" }, now)).toBe(false);
    expect(isJobIndexable({ ...full, active: false }, now)).toBe(false);
  });

  it("never indexes an expired role whose deadline has passed", () => {
    expect(
      isJobIndexable(
        evidence({
          application_deadline: new Date("2020-01-01T00:00:00Z"),
          description_summary: "Full verified description.",
        }),
        now,
      ),
    ).toBe(false);
  });

  it("indexes a role whose deadline is in the future", () => {
    expect(
      isJobIndexable(
        evidence({
          application_deadline: new Date("2026-12-01T00:00:00Z"),
          description_summary: "A factual summary of the employer's role.",
          posted_at: new Date("2026-08-01T00:00:00Z"),
        }),
        now,
      ),
    ).toBe(true);
  });
});
