import { describe, expect, it } from "vitest";

import {
  jobFactualDescription,
  jobMetaDescription,
  jobPageTitle,
  META_DESCRIPTION_LIMIT,
} from "./job-detail-content";
import { jobDetailFixture } from "./job-detail-fixtures";

describe("job page title", () => {
  it("combines role, employer and location context", () => {
    expect(jobPageTitle(jobDetailFixture())).toBe(
      "Graduate Analyst at Example Bank in London | OfferLab",
    );
  });

  it("omits location when the source stores none", () => {
    expect(jobPageTitle(jobDetailFixture({ location_text: null }))).toBe(
      "Graduate Analyst at Example Bank | OfferLab",
    );
  });

  it("prefers the normalized role title", () => {
    expect(
      jobPageTitle(
        jobDetailFixture({ normalized_title: "Analyst", title: "Graduate Analyst (2027)" }),
      ),
    ).toBe("Analyst at Example Bank in London | OfferLab");
  });

  it("keeps unusually long source titles within a concise search-title budget", () => {
    const title = jobPageTitle(
      jobDetailFixture({
        company_name: "Example International Banking and Financial Services Group",
        location_text: "London and multiple United Kingdom locations",
        normalized_title:
          "Graduate Corporate and Institutional Banking Relationship Management Analyst Programme",
      }),
    );
    expect(title.length).toBeLessThanOrEqual(70);
    expect(title.endsWith(" | OfferLab")).toBe(true);
  });
});

describe("job meta description", () => {
  it("uses the verified summary when present", () => {
    const summary = "Support relationship managers and analyse corporate credit risk.";
    expect(jobMetaDescription(jobDetailFixture({ description_summary: summary }))).toBe(
      `Graduate Analyst at Example Bank: ${summary}`,
    );
  });

  it("includes every visible structured section when a summary is also present", () => {
    const description = jobFactualDescription(
      jobDetailFixture({
        degree_requirements: ["A relevant degree"],
        description_summary: "A verified role summary.",
        experience_requirements: "Prior analytical experience",
        preferred_skills: ["Python"],
        requirements: ["Strong communication"],
        responsibilities: ["Prepare reports"],
        skills: ["SQL"],
      }),
    );
    expect(description).toContain("A verified role summary.");
    expect(description).toContain("Key responsibilities: Prepare reports.");
    expect(description).toContain("Requirements: Strong communication.");
    expect(description).toContain("Preferred requirements: Python.");
    expect(description).toContain("Skills: SQL.");
    expect(description).toContain("Qualifications: A relevant degree.");
    expect(description).toContain("Experience required: Prior analytical experience.");
  });

  it("stays within the snippet budget", () => {
    const long = "x".repeat(META_DESCRIPTION_LIMIT + 100);
    const description = jobMetaDescription(jobDetailFixture({ description_summary: long }));
    expect(description.length).toBeLessThanOrEqual(META_DESCRIPTION_LIMIT);
    expect(description.endsWith("…")).toBe(true);
  });

  it("composes a factual fallback from stored context", () => {
    const description = jobMetaDescription(jobDetailFixture({ description_summary: null }));
    expect(description).toContain("Graduate Analyst at Example Bank");
    expect(description).toContain("London");
    expect(description).toContain("Graduate scheme / programme");
    expect(description.length).toBeLessThanOrEqual(META_DESCRIPTION_LIMIT);
  });

  it("never invents a location for the fallback", () => {
    const description = jobMetaDescription(
      jobDetailFixture({ description_summary: null, location_text: null }),
    );
    expect(description).not.toContain("in null");
  });
});

describe("job factual description", () => {
  it("uses the verified summary when present", () => {
    expect(
      jobFactualDescription(jobDetailFixture({ description_summary: "A verified summary." })),
    ).toBe("A verified summary.");
  });

  it("composes grounded facts from stored sections instead of the title alone", () => {
    const description = jobFactualDescription(
      jobDetailFixture({
        description_summary: null,
        experience_requirements: "Strong analytical skills",
        requirements: ["A 2:1 degree"],
        responsibilities: ["Support credit analysis", "Prepare reports"],
      }),
    );
    expect(description).toContain(
      "Key responsibilities: Support credit analysis; Prepare reports.",
    );
    expect(description).toContain("Requirements: A 2:1 degree.");
    expect(description).toContain("Experience required: Strong analytical skills.");
    expect(description).not.toBe("Graduate Analyst");
  });

  it("returns null rather than a title-only description", () => {
    expect(
      jobFactualDescription(
        jobDetailFixture({ description_summary: null, responsibilities: [], requirements: [] }),
      ),
    ).toBeNull();
  });
});
