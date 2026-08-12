import { describe, expect, it } from "vitest";
import { isCrawlable, sourceKey, type JobSource } from "./source";

function source(status: JobSource["status"]): JobSource {
  return {
    careersUrl: "https://example.com/careers",
    channel: "general",
    companyId: "company",
    companyName: "Example",
    companySlug: "example",
    configuration: {},
    consecutiveFailures: 0,
    crawlEndpointUrl: null,
    crawlFrequencyMinutes: 1440,
    id: "source",
    lastCheckedAt: null,
    lastSuccessfulCheckAt: null,
    nextCheckAt: null,
    runRequestedAt: null,
    sourceName: "Careers",
    sourceSlug: "careers",
    sourceType: "greenhouse",
    status,
  };
}

describe("job source", () => {
  it("only crawls active sources", () => {
    expect(isCrawlable(source("active"))).toBe(true);
    expect(isCrawlable(source("paused"))).toBe(false);
    expect(isCrawlable(source("archived"))).toBe(false);
  });

  it("uses an employer/source compound key", () => {
    expect(sourceKey(source("active"))).toBe("example/careers");
  });
});
