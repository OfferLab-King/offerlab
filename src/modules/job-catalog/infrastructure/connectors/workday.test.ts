import { afterEach, describe, expect, it, vi } from "vitest";

import { createWorkdayConnector } from "./workday";
import { stubContext, stubFetchResponses, stubHttpClient, stubRobotsGate } from "./test-helpers";
import type { ConnectorContext } from "./types";

afterEach(() => {
  vi.unstubAllGlobals();
});

function context(overrides: Partial<ConnectorContext> = {}): ConnectorContext {
  return {
    ...stubContext({
      configuration: { cxsEndpoint: "https://ghr.wd1.myworkdayjobs.com/wday/cxs/ghr/lateral-us" },
    }),
    company: stubContext({
      configuration: { cxsEndpoint: "https://ghr.wd1.myworkdayjobs.com/wday/cxs/ghr/lateral-us" },
    }).company,
    httpClient: stubHttpClient(),
    maxDetailPages: 10,
    maxJobs: 100,
    robotsGate: stubRobotsGate(),
    ...overrides,
  } as ConnectorContext;
}

function cxsPage(
  total: number,
  postings: Array<{ title: string; externalPath: string; locationsText?: string }>,
) {
  return JSON.stringify({
    total,
    jobPostings: postings.map((posting) => ({
      title: posting.title,
      externalPath: posting.externalPath,
      locationsText: posting.locationsText ?? "",
      timeType: "Full time",
      postedOn: "Posted Yesterday",
      bulletFields: [posting.externalPath.split("_").at(-1)],
    })),
  });
}

describe("Workday CXS connector", () => {
  it("normalizes CXS job postings into official application URLs", async () => {
    const body = cxsPage(2, [
      {
        title: "Wealth Planner - EGP",
        externalPath: "/job/Oklahoma-City/Wealth-Planner_26014403",
        locationsText: "Oklahoma City",
      },
      { title: "Software Engineer", externalPath: "/job/London/Software-Engineer_26014404" },
    ]);
    const fetchImplementation = stubFetchResponses([{ body }]);
    vi.stubGlobal("fetch", fetchImplementation);

    const jobs = await createWorkdayConnector().discoverJobs(context());

    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({
      title: "Wealth Planner - EGP",
      externalJobId: "26014403",
      locationText: "Oklahoma City",
      employmentType: "full_time",
      applicationUrl:
        "https://ghr.wd1.myworkdayjobs.com/lateral-us/job/Oklahoma-City/Wealth-Planner_26014403",
    });
    expect(jobs[1]!.applicationUrl).toBe(
      "https://ghr.wd1.myworkdayjobs.com/lateral-us/job/London/Software-Engineer_26014404",
    );
  });

  it("resolves ambiguous listing locations from Workday detail JSON-LD before ingestion", async () => {
    const listing = cxsPage(1, [
      {
        title: "Programme Analyst",
        externalPath: "/job/London/Programme-Analyst_42",
        locationsText: "2 Locations",
      },
    ]);
    const detail = `<script type="application/ld+json">${JSON.stringify({
      "@type": "JobPosting",
      jobLocation: {
        address: {
          "@type": "PostalAddress",
          addressCountry: "GB",
          addressLocality: "London",
        },
        "@type": "Place",
      },
    })}</script>`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => ({
        headers: new Headers({
          "content-type": init?.method === "POST" ? "application/json" : "text/html",
        }),
        ok: true,
        status: 200,
        text: async () => (init?.method === "POST" ? listing : detail),
      })),
    );

    const jobs = await createWorkdayConnector().discoverJobs(context());

    expect(jobs[0]).toMatchObject({
      locationText: "London, GB",
      locations: [{ city: "London", country: "GB" }],
    });
  });

  it("pages through the listing with offset and stops on an empty page", async () => {
    const pageOne = cxsPage(
      40,
      Array.from({ length: 20 }, (_, i) => ({
        title: `Role ${i}`,
        externalPath: `/job/X/Role-${i}_${i + 1}`,
        locationsText: "London",
      })),
    );
    const pageTwo = cxsPage(
      40,
      Array.from({ length: 20 }, (_, i) => ({
        title: `Role ${i + 20}`,
        externalPath: `/job/X/Role-${i + 20}_${i + 21}`,
        locationsText: "London",
      })),
    );
    const emptyPage = cxsPage(40, []);
    const calls: string[] = [];
    const fetchImplementation = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      calls.push(`${url} ${String(init?.body ?? "")}`);
      const offset = JSON.parse(String(init?.body ?? "{}")).offset ?? 0;
      const body = offset === 0 ? pageOne : offset < 40 ? pageTwo : emptyPage;
      return {
        headers: new Headers({ "content-type": "application/json" }),
        ok: true,
        status: 200,
        text: async () => body,
      };
    });
    vi.stubGlobal("fetch", fetchImplementation);

    const jobs = await createWorkdayConnector().discoverJobs(context({ maxJobs: 300 }));

    expect(jobs).toHaveLength(40);
    expect(calls).toHaveLength(3);
    expect(calls[0]).toContain('"offset":0');
    expect(calls[1]).toContain('"offset":20');
    expect(calls[2]).toContain('"offset":40');
    expect(JSON.parse(calls[0]!.split(" ").pop()!).limit).toBe(20);
  });

  it("stops at the per-source job cap", async () => {
    const body = cxsPage(
      5000,
      Array.from({ length: 100 }, (_, i) => ({
        title: `Role ${i}`,
        externalPath: `/job/X/Role-${i}_${i}`,
        locationsText: "London",
      })),
    );
    const fetchImplementation = stubFetchResponses([{ body }, { body }, { body }]);
    vi.stubGlobal("fetch", fetchImplementation);

    const jobs = await createWorkdayConnector().discoverJobs(context({ maxJobs: 150 }));

    expect(jobs).toHaveLength(150);
    expect(fetchImplementation.mock.calls).toHaveLength(2);
  });

  it("fails cleanly when no workday endpoint is configured", async () => {
    const bare = context();
    await expect(
      createWorkdayConnector().discoverJobs({
        ...bare,
        company: { ...bare.company, configuration: {} },
      }),
    ).rejects.toMatchObject({ code: "not_configured" });
  });

  it("reports parser_changed for unparseable CXS responses", async () => {
    const fetchImplementation = stubFetchResponses([{ body: "<html>blocked</html>" }]);
    vi.stubGlobal("fetch", fetchImplementation);
    await expect(createWorkdayConnector().discoverJobs(context())).rejects.toMatchObject({
      code: "parser_changed",
    });
  });

  it("reports parser_changed when the CXS payload has no postings", async () => {
    const fetchImplementation = stubFetchResponses([{ body: JSON.stringify({ total: 0 }) }]);
    vi.stubGlobal("fetch", fetchImplementation);
    await expect(createWorkdayConnector().discoverJobs(context())).rejects.toMatchObject({
      code: "parser_changed",
    });
  });
});
