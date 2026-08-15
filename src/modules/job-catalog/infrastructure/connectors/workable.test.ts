import { afterEach, describe, expect, it, vi } from "vitest";

import { createWorkableConnector } from "./workable";
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
  const base = stubContext({ configuration: { workableAccount: "accessfintech" } });
  return {
    ...base,
    company: base.company,
    httpClient: stubHttpClient(),
    maxDetailPages: 10,
    maxJobs: 100,
    robotsGate: stubRobotsGate(),
  } as ConnectorContext;
}

describe("Workable connector", () => {
  it("normalizes the widget API payload", async () => {
    vi.stubGlobal("fetch", stubFetchResponses([{ body: await readFixture("workable-jobs.json") }]));
    const jobs = await createWorkableConnector().discoverJobs(context());

    expect(jobs.length).toBeGreaterThan(0);
    const job = jobs[0]!;
    expect(job.externalJobId).toBe("AE891835A8");
    expect(job.title).toBe("Global Account Manager");
    expect(job.employmentType).toBe("full_time");
    expect(job.applicationUrl).toContain("apply.workable.com/j/");
    expect(job.sourceUrl).toContain("apply.workable.com/j/");
    expect(job.locationText).toContain("London");
    expect(job.postedAt).not.toBeNull();
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
    await expect(createWorkableConnector().discoverJobs(unconfigured)).rejects.toMatchObject({
      code: "not_configured",
    });
  });
});
