import { describe, expect, it } from "vitest";
import type { DiscoveredJob } from "../domain/deduplication";
import { classifyDiscoveredJob } from "./classification-pipeline";

function job(locationText: string): DiscoveredJob {
  return {
    applicationDeadline: null,
    applicationUrl: "https://example.com/apply",
    descriptionText: "An active professional opportunity.",
    employmentType: "full_time",
    externalJobId: "1",
    locationText,
    postedAt: null,
    remoteType: locationText === "Remote" ? "remote" : "on_site",
    salaryCurrency: null,
    salaryMax: null,
    salaryMin: null,
    salaryPeriod: null,
    sourcePayload: {},
    sourceUrl: "https://example.com/jobs/1",
    title: "Operations Manager",
  };
}

describe("classification pipeline UK admission", () => {
  it("publishes a confirmed UK experienced role", () => {
    const result = classifyDiscoveredJob(job("London, United Kingdom"));
    expect(result.eligibilityStatus).toBe("eligible");
    expect(result.publicationStatus).toBe("published");
    expect(result.eligibilityReasons).toContain("uk_location");
  });

  it("suppresses an explicit non-UK role", () => {
    const result = classifyDiscoveredJob(job("France"));
    expect(result.eligibilityStatus).toBe("ineligible");
    expect(result.publicationStatus).toBe("suppressed");
  });

  it("holds countryless remote work for administrator review", () => {
    const result = classifyDiscoveredJob(job("Remote"));
    expect(result.eligibilityStatus).toBe("needs_review");
    expect(result.publicationStatus).toBe("draft");
  });
});
