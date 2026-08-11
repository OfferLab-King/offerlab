import { afterEach, describe, expect, it, vi } from "vitest";

import { createGenericHtmlConnector } from "./generic-html";
import { createWorkdayConnector } from "./workday";
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

function htmlContext(): ConnectorContext {
  return {
    ...stubContext({ sourceType: "direct_html" }),
    company: stubContext({
      sourceType: "direct_html",
      careersUrl: "https://careers.example-bank.example.com",
    }).company,
    httpClient: stubHttpClient(),
    maxDetailPages: 10,
    maxJobs: 100,
    robotsGate: stubRobotsGate(),
  } as ConnectorContext;
}

describe("generic HTML connector", () => {
  it("extracts jobs from a careers listing and detail pages", async () => {
    const fetchImplementation = stubFetchResponses([
      { body: await readFixture("generic-listing.html") },
      { body: await readFixture("generic-detail.html") },
      { body: await readFixture("generic-detail.html") },
      { body: await readFixture("generic-detail.html") },
    ]);
    vi.stubGlobal("fetch", fetchImplementation);
    const jobs = await createGenericHtmlConnector().discoverJobs(htmlContext());

    expect(jobs).toHaveLength(3);
    const analyst = jobs.find((job) => job.title === "Graduate Analyst 2026")!;
    expect(analyst.locationText).toBe("London");
    expect(analyst.applicationDeadline?.toISOString()).toContain("2026-10-31");
    expect(analyst.descriptionText).toContain("financial analysis");
    expect(analyst.descriptionText).not.toContain("xss");
    expect(analyst.descriptionText).not.toContain("<script>");
  });

  it("honours robots.txt before fetching", async () => {
    const context = htmlContext();
    await expect(
      createGenericHtmlConnector().discoverJobs({
        ...context,
        robotsGate: stubRobotsGate(false),
      }),
    ).rejects.toMatchObject({ code: "robots_blocked" });
  });

  it("skips detail pages disallowed by robots", async () => {
    const context = htmlContext();
    const fetchImplementation = stubFetchResponses([
      { body: await readFixture("generic-listing.html") },
    ]);
    vi.stubGlobal("fetch", fetchImplementation);
    const gate = {
      check: async (url: string) => (url.includes("/jobs/") ? "blocked" : "allowed"),
    } as unknown as ConnectorContext["robotsGate"];
    const jobs = await createGenericHtmlConnector().discoverJobs({ ...context, robotsGate: gate });
    expect(jobs).toHaveLength(0);
  });

  it("reports parser_changed when a listing has no job links", async () => {
    const fetchImplementation = stubFetchResponses([
      { body: "<html><body><h1>Careers</h1><a href='/about'>About</a></body></html>" },
    ]);
    vi.stubGlobal("fetch", fetchImplementation);
    await expect(createGenericHtmlConnector().discoverJobs(htmlContext())).rejects.toMatchObject({
      code: "parser_changed",
    });
  });
});

describe("Workday connector (scaffold)", () => {
  it("fails with not_configured until a RaaS endpoint is supplied", async () => {
    const bare = htmlContext();
    await expect(
      createWorkdayConnector().discoverJobs({
        ...bare,
        company: { ...bare.company, sourceType: "workday" },
      }),
    ).rejects.toMatchObject({ code: "not_configured" });
  });
});
