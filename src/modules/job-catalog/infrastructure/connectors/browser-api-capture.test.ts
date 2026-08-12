import { describe, expect, it } from "vitest";

import { findJobArrays, matchesCapturePattern, normalizeCapturedJob } from "./browser-api-capture";

describe("matchesCapturePattern", () => {
  it("matches literal and wildcard URL patterns", () => {
    expect(
      matchesCapturePattern("**/ats/api/**", "https://careers.db.com/ats/api/jobs?page=1"),
    ).toBe(true);
    expect(matchesCapturePattern("**/api/**", "https://jobs.example.com/api/search?x=1")).toBe(
      true,
    );
    expect(
      matchesCapturePattern("**/jobPostings", "https://jobs.example.com/api/jobPostings"),
    ).toBe(true);
    expect(matchesCapturePattern("**/api/**", "https://jobs.example.com/static/app.js")).toBe(
      false,
    );
  });
});

describe("findJobArrays", () => {
  it("extracts arrays via explicit dotted paths", () => {
    const payload = { data: { jobs: [{ title: "A" }, { title: "B" }] } };
    expect(findJobArrays(payload, ["data.jobs"])).toHaveLength(2);
  });

  it("extracts top-level items and results arrays", () => {
    expect(findJobArrays({ items: [{ title: "A" }] }, ["items"])).toHaveLength(1);
    expect(findJobArrays({ results: [{ title: "A" }] }, ["results"])).toHaveLength(1);
    expect(findJobArrays({ jobPostings: [{ title: "A" }] }, ["jobPostings"])).toHaveLength(1);
  });

  it("auto-detects job-shaped arrays when no paths are configured", () => {
    const payload = { other: "x", jobs: [{ title: "Engineer", url: "https://x/jobs/1" }] };
    expect(findJobArrays(payload, [])).toHaveLength(1);
    expect(findJobArrays({ unrelated: [{ foo: "bar" }] }, [])).toHaveLength(0);
  });
});

describe("normalizeCapturedJob", () => {
  it("maps common ATS field names into a discovered job", () => {
    const job = normalizeCapturedJob(
      {
        jobTitle: "Software Engineer",
        externalUrl: "/job/123",
        locations: [{ name: "London" }],
        jobId: "123",
      },
      "https://careers.db.com",
    );
    expect(job).toMatchObject({
      title: "Software Engineer",
      externalJobId: "123",
      locationText: "London",
      applicationUrl: "https://careers.db.com/job/123",
    });
  });

  it("handles alternate field names and string locations", () => {
    const job = normalizeCapturedJob(
      {
        title: "Analyst",
        url: "https://jobs.example.com/x/42",
        location: "Manchester, UK",
        id: "42",
      },
      "https://jobs.example.com",
    );
    expect(job).toMatchObject({
      title: "Analyst",
      externalJobId: "42",
      locationText: "Manchester, UK",
      applicationUrl: "https://jobs.example.com/x/42",
    });
  });

  it("drops items without a title or url", () => {
    expect(normalizeCapturedJob({ foo: "bar" }, "https://x.example.com").title).toBe("");
  });

  it("unwraps MatchedObjectDescriptor postings such as Deutsche Bank's beesite API", () => {
    const job = normalizeCapturedJob(
      {
        MatchedObjectId: "66097",
        MatchedObjectDescriptor: {
          PositionTitle: "Automation QA Test Engineer",
          PositionLocation: [{ CityName: "Pune", CountryName: "Indien" }],
          PositionURI: "/index.php?ac=jobad&id=66097",
          PositionID: "66097",
        },
      },
      "https://careers.db.com",
    );
    expect(job).toMatchObject({
      title: "Automation QA Test Engineer",
      externalJobId: "66097",
      locationText: "Pune, Indien",
      applicationUrl: "https://careers.db.com/index.php?ac=jobad&id=66097",
    });
  });
});
