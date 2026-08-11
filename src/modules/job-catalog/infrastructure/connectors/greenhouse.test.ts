import { afterEach, describe, expect, it, vi } from "vitest";

import { createGreenhouseConnector } from "./greenhouse";
import { JobFetchError } from "./errors";
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
    ...stubContext({ configuration: { greenhouseBoardToken: "monzo" } }),
    company: stubContext({ configuration: { greenhouseBoardToken: "monzo" } }).company,
    httpClient: stubHttpClient(),
    maxDetailPages: 10,
    maxJobs: 100,
    robotsGate: stubRobotsGate(),
  } as ConnectorContext;
}

describe("Greenhouse connector", () => {
  it("normalizes the public board API payload", async () => {
    const fetchImplementation = stubFetchResponses([
      { body: await readFixture("greenhouse-jobs.json") },
    ]);
    vi.stubGlobal("fetch", fetchImplementation);
    const jobs = await createGreenhouseConnector().discoverJobs(context());

    expect(jobs).toHaveLength(2);
    const graduate = jobs[0]!;
    expect(graduate.title).toBe("Graduate Software Engineer");
    expect(graduate.externalJobId).toBe("7502994802");
    expect(graduate.locationText).toBe("London");
    expect(graduate.employmentType).toBe("full_time");
    expect(graduate.salaryMin).toBe(60000);
    expect(graduate.salaryMax).toBe(75000);
    expect(graduate.salaryCurrency).toBe("£");
    expect(graduate.descriptionText).toContain("Graduate Software Engineer");
    expect(graduate.descriptionText).not.toContain("<strong>");
    expect(graduate.applicationUrl).toBe("https://boards.greenhouse.io/monzo/jobs/7502994802");
    expect((graduate.sourcePayload as Readonly<Record<string, unknown>>).title).toBe(
      "Graduate Software Engineer",
    );
  });

  it("fails cleanly when the board token is missing", async () => {
    const bare = context();
    const company = { ...bare.company, configuration: {} };
    await expect(
      createGreenhouseConnector().discoverJobs({ ...bare, company }),
    ).rejects.toMatchObject({ code: "not_configured" });
  });

  it("classifies unparseable responses as parser_changed", async () => {
    const fetchImplementation = stubFetchResponses([{ body: "<html>blocked</html>" }]);
    vi.stubGlobal("fetch", fetchImplementation);
    await expect(createGreenhouseConnector().discoverJobs(context())).rejects.toMatchObject({
      code: "parser_changed",
    });
  });

  it("respects the per-source job limit", async () => {
    const fetchImplementation = stubFetchResponses([
      { body: await readFixture("greenhouse-jobs.json") },
    ]);
    vi.stubGlobal("fetch", fetchImplementation);
    const limited = { ...context(), maxJobs: 1 };
    const jobs = await createGreenhouseConnector().discoverJobs(limited);
    expect(jobs).toHaveLength(1);
  });

  it("surfaces HTTP 403 as a non-retryable forbidden error", async () => {
    const fetchImplementation = stubFetchResponses([{ body: "forbidden", status: 403 }]);
    vi.stubGlobal("fetch", fetchImplementation);
    await expect(createGreenhouseConnector().discoverJobs(context())).rejects.toMatchObject({
      code: "http_403",
    });
  });

  it("surfaces HTTP 404 as not found", async () => {
    const fetchImplementation = stubFetchResponses([{ body: "missing", status: 404 }]);
    vi.stubGlobal("fetch", fetchImplementation);
    await expect(createGreenhouseConnector().discoverJobs(context())).rejects.toMatchObject({
      code: "http_404",
    });
  });

  it("reports an unknown connector error type from JobFetchError", () => {
    expect(JobFetchError.name).toBe("JobFetchError");
    const error = new JobFetchError("network_timeout", "timed out", { retryable: true });
    expect(error.retryable).toBe(true);
  });
});
