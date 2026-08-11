import { afterEach, describe, expect, it, vi } from "vitest";

import { createAshbyConnector } from "./ashby";
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
  return {
    ...stubContext({ configuration: { ashbyOrg: "exampleorg" } }),
    company: stubContext({ configuration: { ashbyOrg: "exampleorg" } }).company,
    httpClient: stubHttpClient(),
    maxDetailPages: 10,
    maxJobs: 100,
    robotsGate: stubRobotsGate(),
  } as ConnectorContext;
}

describe("Ashby connector", () => {
  it("normalizes the posting API payload including salary", async () => {
    const fetchImplementation = stubFetchResponses([
      { body: await readFixture("ashby-board.json") },
    ]);
    vi.stubGlobal("fetch", fetchImplementation);
    const jobs = await createAshbyConnector().discoverJobs(context());

    expect(jobs).toHaveLength(2);
    const analyst = jobs[0]!;
    expect(analyst.title).toBe("Graduate Analyst");
    expect(analyst.externalJobId).toBe("7f2d3c4b-5a6b-4c7d-8e9f-0123456789ab");
    expect(analyst.employmentType).toBe("full_time");
    expect(analyst.remoteType).toBeNull();
    expect(analyst.salaryMin).toBe(50000);
    expect(analyst.salaryMax).toBe(65000);
    expect(analyst.locationText).toBe("London");
    expect(analyst.descriptionText).not.toContain("<p>");

    const intern = jobs[1]!;
    expect(intern.employmentType).toBe("internship");
    expect(intern.remoteType).toBe("remote");
    expect(intern.salaryMin).toBeNull();
  });

  it("fails cleanly when the org token is missing", async () => {
    const bare = context();
    await expect(
      createAshbyConnector().discoverJobs({
        ...bare,
        company: { ...bare.company, configuration: {} },
      }),
    ).rejects.toMatchObject({ code: "not_configured" });
  });
});
