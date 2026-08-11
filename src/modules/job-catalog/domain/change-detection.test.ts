import { describe, expect, it } from "vitest";

import {
  contentHashForDiscovered,
  DEFAULT_MISSING_CRAWL_THRESHOLD,
  planCrawlChanges,
  type ExistingJobRecord,
} from "./change-detection";
import type { DiscoveredJob } from "./deduplication";

function discovered(
  externalJobId: string,
  title: string,
  overrides: Partial<DiscoveredJob> = {},
): DiscoveredJob {
  return {
    applicationDeadline: null,
    applicationUrl: `https://jobs.example.com/${externalJobId}/apply`,
    descriptionText: `Description of ${title}.`,
    employmentType: null,
    externalJobId,
    locationText: "London",
    postedAt: null,
    remoteType: null,
    salaryCurrency: null,
    salaryMax: null,
    salaryMin: null,
    salaryPeriod: null,
    sourcePayload: {},
    sourceUrl: `https://jobs.example.com/${externalJobId}`,
    title,
    ...overrides,
  };
}

function existing(id: string, overrides: Partial<ExistingJobRecord> = {}): ExistingJobRecord {
  return {
    active: true,
    applicationUrl: `https://jobs.example.com/${id}/apply`,
    contentHash: "a".repeat(64),
    externalJobId: id,
    id,
    lastSeenAt: new Date("2026-08-01T00:00:00.000Z"),
    locationText: "London",
    missedCrawls: 0,
    sourceUrl: `https://jobs.example.com/${id}`,
    title: `Role ${id}`,
    ...overrides,
  };
}

describe("crawl change detection", () => {
  it("plans inserts for new jobs", () => {
    const plan = planCrawlChanges([], [discovered("1", "New Role")]);
    expect(plan.insert).toHaveLength(1);
    expect(plan.update).toHaveLength(0);
  });

  it("coalesces duplicate records returned in one listing", () => {
    const duplicate = discovered("1", "New Role");
    const plan = planCrawlChanges([], [duplicate, duplicate]);
    expect(plan.insert).toHaveLength(1);
  });

  it("does not apply the same existing job twice", () => {
    const same = discovered("1", "Role 1");
    const job = existing("1", { contentHash: contentHashForDiscovered(same), title: "Role 1" });
    const plan = planCrawlChanges([job], [same, same]);
    expect(plan.touch).toHaveLength(1);
  });

  it("plans updates only when the content hash changes", () => {
    const same = discovered("1", "Role 1");
    const job = existing("1", {
      contentHash: contentHashForDiscovered(same),
      title: "Role 1",
    });
    const changed = discovered("1", "Role 1", {
      descriptionText: "A materially different description.",
    });
    expect(planCrawlChanges([job], [same]).update).toHaveLength(0);
    expect(planCrawlChanges([job], [same]).touch).toHaveLength(1);
    expect(planCrawlChanges([job], [changed]).update).toHaveLength(1);
    expect(planCrawlChanges([job], [changed]).touch).toHaveLength(0);
  });

  it("does not deactivate jobs after a failed or empty crawl", () => {
    const job = existing("1");
    expect(planCrawlChanges([job], [], { fullListing: false }).deactivate).toHaveLength(0);
    expect(planCrawlChanges([job], []).deactivate).toHaveLength(0);
  });

  it("increments missed crawls and deactivates only after the threshold", () => {
    const job = existing("1", { missedCrawls: 0 });
    const otherJob = discovered("2", "Other Role");
    const first = planCrawlChanges([job], [otherJob]);
    expect(first.incrementMissed).toHaveLength(1);
    expect(first.deactivate).toHaveLength(0);

    const second = planCrawlChanges([existing("1", { missedCrawls: 1 })], [otherJob], {
      missingCrawlThreshold: DEFAULT_MISSING_CRAWL_THRESHOLD,
    });
    expect(second.incrementMissed).toHaveLength(0);
    expect(second.deactivate).toHaveLength(1);
  });

  it("reactivates jobs that were previously deactivated", () => {
    const job = existing("1", { active: false });
    const plan = planCrawlChanges([job], [discovered("1", "Role 1")]);
    expect(plan.reactivate).toHaveLength(1);
    expect(plan.insert).toHaveLength(0);
    expect(plan.update).toHaveLength(0);
  });

  it("keeps a partial listing from deactivating anything", () => {
    const plan = planCrawlChanges([existing("1"), existing("2")], [discovered("1", "Role 1")], {
      fullListing: false,
    });
    expect(plan.deactivate).toHaveLength(0);
    expect(plan.incrementMissed).toHaveLength(0);
  });

  it("does not re-run LLM work for unchanged jobs (no update planned)", () => {
    const same = discovered("1", "Role 1");
    const plan = planCrawlChanges(
      [existing("1", { contentHash: contentHashForDiscovered(same), title: "Role 1" })],
      [same],
    );
    expect(plan.update).toHaveLength(0);
    expect(plan.touch).toHaveLength(1);
  });
});
