import { describe, expect, it } from "vitest";

import { jobDetailFixture, thinJobFixture } from "./job-detail-fixtures";
import { buildJobDetailMetadata, ROLE_UNAVAILABLE_TITLE } from "./job-detail-metadata";

const now = new Date("2026-08-10T00:00:00Z");

describe("job detail metadata", () => {
  it("indexes an eligible indexable role with one canonical and factual description", () => {
    const metadata = buildJobDetailMetadata(jobDetailFixture(), now);
    expect(metadata.alternates?.canonical).toBe("/jobs/example-bank-graduate-analyst");
    expect(metadata.robots).toBeUndefined();
    expect(metadata.title).toBe("Graduate Analyst at Example Bank in London | OfferLab");
    expect(String(metadata.description)).toContain("Example Bank");
  });

  it("marks a thin but publicly valid role noindex, follow with a clean canonical", () => {
    const metadata = buildJobDetailMetadata(thinJobFixture(), now);
    expect(metadata.robots).toEqual({ follow: true, index: false });
    expect(metadata.alternates?.canonical).toBe("/jobs/example-bank-graduate-analyst");
    expect(metadata.title).not.toBe(ROLE_UNAVAILABLE_TITLE);
  });

  it("keeps missing roles noindex, nofollow without leaking role details", () => {
    const metadata = buildJobDetailMetadata(null, now);
    expect(metadata.robots).toEqual({ follow: false, index: false });
    expect(metadata.title).toBe(ROLE_UNAVAILABLE_TITLE);
    expect(metadata.alternates).toBeUndefined();
    expect(metadata.description).toBeUndefined();
  });

  it.each([
    ["draft", { publication_status: "draft" }],
    ["suppressed", { publication_status: "suppressed" }],
    ["expired status", { publication_status: "expired" }],
    ["ineligible", { eligibility_status: "ineligible" }],
    ["needs review", { eligibility_status: "needs_review" }],
    ["inactive", { active: false }],
    ["deadline passed", { application_deadline: new Date("2020-01-01T00:00:00Z") }],
  ])("keeps a %s role out of the index and without role details", (_label, overrides) => {
    const metadata = buildJobDetailMetadata(jobDetailFixture(overrides), now);
    expect(metadata.robots).toEqual({ follow: false, index: false });
    expect(metadata.title).toBe(ROLE_UNAVAILABLE_TITLE);
    expect(metadata.alternates).toBeUndefined();
    expect(metadata.description).toBeUndefined();
  });
});
