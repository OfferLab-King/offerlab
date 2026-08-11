import { afterEach, describe, expect, it, vi } from "vitest";

import { createLeverConnector } from "./lever";
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
    ...stubContext({ configuration: { leverCompany: "skyscanner" } }),
    company: stubContext({ configuration: { leverCompany: "skyscanner" } }).company,
    httpClient: stubHttpClient(),
    maxDetailPages: 10,
    maxJobs: 100,
    robotsGate: stubRobotsGate(),
  } as ConnectorContext;
}

describe("Lever connector", () => {
  it("normalizes the public postings payload", async () => {
    const fetchImplementation = stubFetchResponses([
      { body: await readFixture("lever-postings.json") },
    ]);
    vi.stubGlobal("fetch", fetchImplementation);
    const jobs = await createLeverConnector().discoverJobs(context());

    expect(jobs).toHaveLength(2);
    const dataScientist = jobs[0]!;
    expect(dataScientist.title).toBe("Graduate Data Scientist");
    expect(dataScientist.externalJobId).toBe("80f1f2a3-9f0e-4b5c-8a9b-1234567890ab");
    expect(dataScientist.employmentType).toBe("full_time");
    expect(dataScientist.remoteType).toBe("hybrid");
    expect(dataScientist.locationText).toBe("London");
    expect(dataScientist.postedAt?.toISOString()).toBe("2026-07-21T00:00:00.000Z");
    expect(dataScientist.descriptionText).toContain("Graduate Data Scientist");
    expect(dataScientist.descriptionText).not.toContain("<strong>");

    const remote = jobs[1]!;
    expect(remote.remoteType).toBe("remote");
    expect(remote.locationText).toBe("Remote");
  });

  it("fails cleanly when the company token is missing", async () => {
    const bare = context();
    await expect(
      createLeverConnector().discoverJobs({
        ...bare,
        company: { ...bare.company, configuration: {} },
      }),
    ).rejects.toMatchObject({ code: "not_configured" });
  });
});
