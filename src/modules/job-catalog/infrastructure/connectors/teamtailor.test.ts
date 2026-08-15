import { afterEach, describe, expect, it, vi } from "vitest";

import { createTeamtailorConnector } from "./teamtailor";
import {
  readFixture,
  stubContext,
  stubFetchResponses,
  stubHttpClient,
  stubRobotsGate,
} from "./test-helpers";
import type { ConnectorContext } from "./types";

afterEach(() => {
  vi.unstubAllGlobals();
});

function context(): ConnectorContext {
  const base = stubContext({ configuration: { teamtailorCompany: "keplercheuvreux" } });
  return {
    ...base,
    company: base.company,
    httpClient: stubHttpClient(),
    maxDetailPages: 10,
    maxJobs: 100,
    robotsGate: stubRobotsGate(),
  } as ConnectorContext;
}

describe("Teamtailor connector", () => {
  it("normalizes the public jobs feed with embedded JobPosting data", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetchResponses([{ body: await readFixture("teamtailor-feed.json") }]),
    );
    const jobs = await createTeamtailorConnector().discoverJobs(context());

    expect(jobs.length).toBeGreaterThan(0);
    const job = jobs[0]!;
    expect(job.externalJobId).toBe("87d3513f-ef67-4aa1-942f-10b8205f90a1");
    expect(job.title).toContain("PORTFOLIO ANALYST");
    expect(job.applicationUrl).toContain("teamtailor.com/jobs/");
    expect(job.sourceUrl).toBe(job.applicationUrl);
    expect(job.locationText).toContain("Paris");
    expect(job.postedAt).not.toBeNull();
    expect(job.descriptionText).not.toContain("<p>");
  });

  it("throws a typed error when configuration is missing", async () => {
    const base = stubContext({ configuration: {} });
    const unconfigured: ConnectorContext = {
      ...base,
      company: base.company,
      httpClient: stubHttpClient(),
      maxDetailPages: 10,
      maxJobs: 100,
      robotsGate: stubRobotsGate(),
    } as ConnectorContext;
    await expect(createTeamtailorConnector().discoverJobs(unconfigured)).rejects.toMatchObject({
      code: "not_configured",
    });
  });
});
