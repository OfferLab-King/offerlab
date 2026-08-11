import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { canonicalJobContent, hashJobContent, JOB_CONTENT_HASH_VERSION } from "./content-hash";

const base = {
  applicationDeadline: "2026-10-31T23:59:00.000Z",
  applicationUrl: "https://jobs.example.com/123",
  descriptionText: "Support the team with financial analysis and reporting.",
  employmentType: "full_time",
  externalJobId: "EXT-1",
  locationText: "London",
  postedAt: "2026-08-01T09:00:00.000Z",
  remoteType: null,
  salaryCurrency: "GBP",
  salaryMax: 75000,
  salaryMin: 60000,
  salaryPeriod: "year",
  title: "Graduate Analyst",
};

describe("content hashing", () => {
  it("produces a stable 64-character sha256 digest", () => {
    const digest = hashJobContent(base);
    expect(digest).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("ignores irrelevant whitespace and normalised punctuation differences", () => {
    const spaced = hashJobContent({ ...base, title: "  Graduate   Analyst " });
    const tight = hashJobContent({ ...base, title: "Graduate Analyst" });
    expect(spaced).toBe(tight);
  });

  it("changes when meaningful content changes", () => {
    const original = hashJobContent(base);
    expect(hashJobContent({ ...base, descriptionText: "A different description." })).not.toBe(
      original,
    );
    expect(hashJobContent({ ...base, salaryMax: 80000 })).not.toBe(original);
    expect(hashJobContent({ ...base, applicationUrl: "https://jobs.example.com/456" })).not.toBe(
      original,
    );
  });

  it("ignores unknown dates instead of crashing", () => {
    expect(() => hashJobContent({ ...base, applicationDeadline: "not-a-date" })).not.toThrow();
  });

  it("canonical content is deterministic JSON including a version prefix", () => {
    const first = canonicalJobContent(base);
    const second = canonicalJobContent({ ...base, remoteType: undefined as never });
    expect(first).toBe(second);
    expect(first.startsWith(`[${JOB_CONTENT_HASH_VERSION},`)).toBe(true);
  });

  it("matches the reference digest for a fixed input", () => {
    const reference = createHash("sha256").update(canonicalJobContent(base)).digest("hex");
    expect(hashJobContent(base)).toBe(reference);
  });
});
