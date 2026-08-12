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

function context(overrides: Partial<ConnectorContext> = {}): ConnectorContext {
  return {
    ...stubContext({ configuration: { greenhouseBoardToken: "monzo" } }),
    company: stubContext({ configuration: { greenhouseBoardToken: "monzo" } }).company,
    httpClient: stubHttpClient(),
    maxDetailPages: 10,
    maxJobs: 100,
    robotsGate: stubRobotsGate(),
    ...overrides,
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

  it("deduplicates repeated pages and stops when a page adds nothing new", async () => {
    const page = (ids: number[]) =>
      JSON.stringify({
        meta: { total: ids.length },
        jobs: ids.map((id) => ({ id, title: `Role ${id}` })),
      });
    const fullPage = Array.from({ length: 500 }, (_, index) => index + 1);
    const fetchImplementation = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      const pageNumber = Number(new URL(url).searchParams.get("page") ?? "1");
      const body = pageNumber === 1 ? page(fullPage) : page(fullPage.slice(0, 100));
      return {
        headers: new Headers({ "content-type": "application/json" }),
        ok: true,
        status: 200,
        text: async () => body,
      };
    });
    vi.stubGlobal("fetch", fetchImplementation);

    const jobs = await createGreenhouseConnector().discoverJobs(context({ maxJobs: 600 }));

    expect(jobs).toHaveLength(500);
    const ids = jobs.map((job) => job.externalJobId);
    expect(new Set(ids).size).toBe(500);
    const listRequests = fetchImplementation.mock.calls
      .map((call) => String(call[0]))
      .filter((url) => url.includes("/jobs?"));
    expect(listRequests).toHaveLength(2);
  });

  it("deduplicates duplicate external IDs within a single page", async () => {
    const page = JSON.stringify({
      meta: { total: 2 },
      jobs: [
        { id: 1, title: "Role One" },
        { id: 2, title: "Role Two" },
        { id: 1, title: "Role One (duplicate)" },
      ],
    });
    const fetchImplementation = stubFetchResponses([{ body: page }]);
    vi.stubGlobal("fetch", fetchImplementation);
    const jobs = await createGreenhouseConnector().discoverJobs(context({ maxJobs: 500 }));
    expect(jobs).toHaveLength(2);
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
