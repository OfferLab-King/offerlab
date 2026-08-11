import { describe, expect, it } from "vitest";

import { resolveJobIdentity, type DiscoveredJob, type ExistingJobIdentity } from "./deduplication";

function discovered(overrides: Partial<DiscoveredJob> = {}): DiscoveredJob {
  return {
    applicationDeadline: null,
    applicationUrl: "https://jobs.example.com/123/apply",
    descriptionText: "A role description.",
    employmentType: null,
    externalJobId: "EXT-1",
    locationText: "London",
    postedAt: null,
    remoteType: null,
    salaryCurrency: null,
    salaryMax: null,
    salaryMin: null,
    salaryPeriod: null,
    sourcePayload: {},
    sourceUrl: "https://jobs.example.com/123",
    title: "Graduate Analyst",
    ...overrides,
  };
}

function existing(overrides: Partial<ExistingJobIdentity> = {}): ExistingJobIdentity {
  return {
    applicationUrl: "https://jobs.example.com/123/apply",
    externalJobId: "EXT-1",
    id: "job-1",
    locationText: "London",
    sourceUrl: "https://jobs.example.com/123",
    title: "Graduate Analyst",
    ...overrides,
  };
}

describe("deduplication identity resolution", () => {
  it("prefers the same company external job id", () => {
    const match = resolveJobIdentity(discovered(), [existing({ externalJobId: "EXT-1" })]);
    expect(match?.strategy).toBe("external_job_id");
  });

  it("matches by canonical source URL when ids differ", () => {
    const match = resolveJobIdentity(discovered({ externalJobId: "NEW-ID" }), [
      existing({ externalJobId: "OLD-ID" }),
    ]);
    expect(match?.strategy).toBe("source_url");
  });

  it("matches by canonical application URL", () => {
    const match = resolveJobIdentity(discovered({ externalJobId: null, sourceUrl: null }), [
      existing({ externalJobId: null, sourceUrl: null }),
    ]);
    expect(match?.strategy).toBe("application_url");
  });

  it("matches by normalized title, location and apply host as a last resort", () => {
    const match = resolveJobIdentity(
      discovered({
        applicationUrl: "https://jobs.example.com/different-path/apply",
        externalJobId: null,
        sourceUrl: "https://jobs.example.com/different-path",
        title: "Graduate  Analyst",
      }),
      [
        existing({
          applicationUrl: "https://jobs.example.com/123/apply",
          externalJobId: null,
          sourceUrl: "https://jobs.example.com/123",
          title: "graduate analyst",
        }),
      ],
    );
    expect(match?.strategy).toBe("normalized_fields");
  });

  it("does not match across hosts for the fuzzy strategy", () => {
    const match = resolveJobIdentity(
      discovered({
        applicationUrl: "https://apply.other.com/x/apply",
        externalJobId: null,
        sourceUrl: "https://apply.other.com/x",
        title: "Graduate Analyst",
      }),
      [
        existing({
          applicationUrl: "https://jobs.example.com/123/apply",
          externalJobId: null,
          sourceUrl: "https://jobs.example.com/123",
        }),
      ],
    );
    expect(match).toBeNull();
  });

  it("does not fuzzy-match different authoritative requisition ids", () => {
    const match = resolveJobIdentity(
      discovered({
        applicationUrl: "https://jobs.example.com/new/apply",
        externalJobId: "EXT-2",
        sourceUrl: "https://jobs.example.com/new",
      }),
      [existing({ externalJobId: "EXT-1" })],
    );
    expect(match).toBeNull();
  });

  it("returns null when nothing matches", () => {
    expect(
      resolveJobIdentity(
        discovered({
          applicationUrl: "https://apply.other.com/x/apply",
          externalJobId: "ZZZ",
          sourceUrl: "https://apply.other.com/x",
          title: "Something else",
        }),
        [existing({ externalJobId: "EXT-1" })],
      ),
    ).toBeNull();
  });
});
