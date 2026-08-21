import { describe, expect, it } from "vitest";

import type { DiscoveredJob } from "../domain/deduplication";
import { validateDiscoveredJobs } from "./ingestion";

function discovered(overrides: Partial<DiscoveredJob> = {}): DiscoveredJob {
  return {
    applicationDeadline: null,
    applicationUrl: "https://jobs.example.com/roles/1",
    descriptionText: "A current official vacancy.",
    employmentType: "full_time",
    externalJobId: "1",
    locationText: "London",
    postedAt: null,
    remoteType: null,
    salaryCurrency: null,
    salaryMax: null,
    salaryMin: null,
    salaryPeriod: null,
    sourcePayload: {},
    sourceUrl: "https://jobs.example.com/roles/1",
    title: "Analyst",
    ...overrides,
  };
}

describe("crawler record validation", () => {
  it("quarantines malformed records without discarding valid jobs from the same feed", () => {
    const result = validateDiscoveredJobs([
      discovered(),
      discovered({ applicationUrl: "not a URL", externalJobId: "2" }),
      discovered({ title: "  ", externalJobId: "3" }),
    ]);

    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0]!.title).toBe("Analyst");
    expect(result.rejected).toBe(2);
  });
});
