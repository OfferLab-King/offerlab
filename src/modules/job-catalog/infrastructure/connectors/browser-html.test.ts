import { afterEach, describe, expect, it, vi } from "vitest";

import { createBrowserHtmlConnector, type BrowserPage } from "./browser-html";
import { stubContext, stubFetchResponses, stubHttpClient, stubRobotsGate } from "./test-helpers";
import type { ConnectorContext } from "./types";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

class FakePage implements BrowserPage {
  readonly visited: string[] = [];
  private readonly htmlByUrl: (url: string) => string;
  private readonly responses: Array<{ url: string; contentType?: string; body: string }>;
  private readonly dispatchedResponses = new Set<string>();
  private responseHandlers: Array<(url: string, contentType: string, body: string) => void> = [];

  constructor(
    htmlByUrl: (url: string) => string,
    responses: Array<{ url: string; contentType?: string; body: string }> = [],
  ) {
    this.htmlByUrl = htmlByUrl;
    this.responses = responses;
  }

  async goto(url: string): Promise<void> {
    const html = this.htmlByUrl(url);
    if (html === "__TIMEOUT__") {
      const error = new Error(`navigation timeout on ${url}`) as Error & { name: string };
      error.name = "TimeoutError";
      throw error;
    }
    this.visited.push(url);
    for (const response of this.responses) {
      if (this.dispatchedResponses.has(response.url)) continue;
      this.dispatchedResponses.add(response.url);
      for (const handler of this.responseHandlers) {
        handler(response.url, response.contentType ?? "application/json", response.body);
      }
    }
  }

  async waitForLoadState(): Promise<void> {}

  async waitForTimeout(): Promise<void> {}

  onResponse(handler: (url: string, contentType: string, body: string) => void): void {
    this.responseHandlers.push(handler);
  }

  async content(): Promise<string> {
    const url = this.visited[this.visited.length - 1]!;
    return this.htmlByUrl(url);
  }

  async close(): Promise<void> {}
}

function context(overrides: Partial<ConnectorContext> = {}): ConnectorContext {
  return {
    ...stubContext(),
    company: stubContext().company,
    httpClient: stubHttpClient(),
    maxDetailPages: 10,
    maxJobs: 100,
    robotsGate: stubRobotsGate(),
    ...overrides,
  } as ConnectorContext;
}

function listingHtml(): string {
  return `
    <html><body>
      <a href="/careers/software-engineer">Software Engineer</a>
      <a href="/careers/product-manager">Product Manager</a>
      <a href="/about">About us</a>
    </body></html>
  `;
}

function detailHtml(title: string, location: string): string {
  return `
    <html><body><main>
      <h1>${title}</h1>
      <p>Location: ${location}</p>
      <p>We are looking for a ${title} to join the team.</p>
    </main></body></html>
  `;
}

const CAREERS_URL = "https://boards.example.com";

function htmlByUrl(url: string): string {
  if (url.includes("/careers/software-engineer")) {
    return detailHtml("Software Engineer", "London");
  }
  if (url.includes("/careers/product-manager")) {
    return detailHtml("Product Manager", "Manchester");
  }
  if (url.includes("/careers") || url === CAREERS_URL) return listingHtml();
  return "<html><body></body></html>";
}

describe("browser-rendered HTML connector", () => {
  it("renders the listing and detail pages and normalizes the jobs", async () => {
    const browser = {
      newPage: vi.fn(async () => new FakePage(htmlByUrl)),
      close: vi.fn(async () => undefined),
    };
    const connector = createBrowserHtmlConnector({
      launchBrowser: async () => browser as never,
    });

    const jobs = await connector.discoverJobs(context());

    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({
      title: "Software Engineer",
      locationText: "London",
      applicationUrl: "https://boards.example.com/careers/software-engineer",
    });
    expect(jobs[1]!.title).toBe("Product Manager");
    expect(browser.close).toHaveBeenCalledTimes(1);
  });

  it("checks robots.txt before launching a browser", async () => {
    const launchBrowser = vi.fn(async () => {
      throw new Error("browser must not launch");
    });
    const connector = createBrowserHtmlConnector({ launchBrowser });
    const blocked = context({ robotsGate: stubRobotsGate(false) });

    await expect(connector.discoverJobs(blocked)).rejects.toMatchObject({
      code: "robots_blocked",
    });
    expect(launchBrowser).not.toHaveBeenCalled();
  });

  it("renders bot-walled sources even when robots.txt is unreadable", async () => {
    const browser = {
      newPage: vi.fn(async () => new FakePage(htmlByUrl)),
      close: vi.fn(async () => undefined),
    };
    const connector = createBrowserHtmlConnector({
      launchBrowser: async () => browser as never,
    });
    const unknown = context({
      robotsGate: { check: async () => "unknown" } as never,
    });

    const jobs = await connector.discoverJobs(unknown);

    expect(jobs).toHaveLength(2);
    expect(browser.newPage).toHaveBeenCalled();
  });

  it("reports parser_changed when the rendered listing has no job links", async () => {
    const connector = createBrowserHtmlConnector({
      launchBrowser: async () =>
        ({
          newPage: async () =>
            new FakePage(() => "<html><body><p>Careers coming soon</p></body></html>"),
          close: async () => undefined,
        }) as never,
    });

    await expect(connector.discoverJobs(context())).rejects.toMatchObject({
      code: "parser_changed",
    });
  });

  it("maps rendered navigation timeouts to network_timeout", async () => {
    const connector = createBrowserHtmlConnector({
      launchBrowser: async () =>
        ({
          newPage: async () =>
            new FakePage((url) => (url === CAREERS_URL ? "__TIMEOUT__" : "<html></html>")),
          close: async () => undefined,
        }) as never,
    });

    await expect(connector.discoverJobs(context())).rejects.toMatchObject({
      code: "network_timeout",
    });
  });

  it("caps detail pages at the configured limits", async () => {
    const browser = {
      newPage: vi.fn(async () => new FakePage(htmlByUrl)),
      close: vi.fn(async () => undefined),
    };
    const connector = createBrowserHtmlConnector({
      launchBrowser: async () => browser as never,
    });

    const jobs = await connector.discoverJobs(context({ maxDetailPages: 1, maxJobs: 1 }));

    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.title).toBe("Software Engineer");
  });

  it("closes the page and browser even when extraction fails", async () => {
    const page = new FakePage(() => "<html><body></body></html>");
    const pageClose = vi.spyOn(page, "close");
    const browser = {
      newPage: vi.fn(async () => page),
      close: vi.fn(async () => undefined),
    };
    const connector = createBrowserHtmlConnector({
      launchBrowser: async () => browser as never,
    });

    await expect(connector.discoverJobs(context())).rejects.toMatchObject({
      code: "parser_changed",
    });
    expect(pageClose).toHaveBeenCalledTimes(1);
    expect(browser.close).toHaveBeenCalledTimes(1);
  });

  it("captures job arrays from intercepted API responses when configured", async () => {
    const page = new FakePage(
      () => "<html><body>app shell</body></html>",
      [
        {
          url: "https://careers.db.com/ats/api/jobs?page=1",
          body: JSON.stringify({
            results: [
              {
                jobTitle: "Software Engineer",
                externalUrl: "/job/engineer-1",
                locations: [{ name: "London" }],
                jobId: "1",
              },
              {
                jobTitle: "Analyst",
                url: "https://careers.db.com/job/analyst-2",
                location: "Frankfurt",
                id: "2",
              },
            ],
          }),
        },
        {
          url: "https://careers.db.com/static/app.js",
          body: JSON.stringify({ unrelated: true }),
        },
      ],
    );
    const browser = {
      newPage: vi.fn(async () => page),
      close: vi.fn(async () => undefined),
    };
    const connector = createBrowserHtmlConnector({
      launchBrowser: async () => browser as never,
    });
    const capture = context({
      company: {
        ...context().company,
        configuration: { capture: { urlPatterns: ["**/ats/api/**"] } },
      },
    });

    const jobs = await connector.discoverJobs(capture);

    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({
      title: "Software Engineer",
      locationText: "London",
      applicationUrl: "https://boards.example.com/job/engineer-1",
    });
    expect(jobs[1]!.title).toBe("Analyst");
    expect(browser.close).toHaveBeenCalledTimes(1);
  });

  it("reports parser_changed when configured capture yields no job arrays", async () => {
    const page = new FakePage(
      () => "<html><body>app shell</body></html>",
      [{ url: "https://jobs.example.com/api/search", body: JSON.stringify({ results: [] }) }],
    );
    const connector = createBrowserHtmlConnector({
      launchBrowser: async () =>
        ({
          newPage: async () => page,
          close: async () => undefined,
        }) as never,
    });
    const capture = context({
      company: {
        ...context().company,
        configuration: { capture: { urlPatterns: ["**/api/**"] } },
      },
    });

    await expect(connector.discoverJobs(capture)).rejects.toMatchObject({
      code: "parser_changed",
    });
  });

  it("fetches a configured apiUrl with the HTTP client and captures its response", async () => {
    const page = new FakePage(() => "<html><body>app shell</body></html>");
    const connector = createBrowserHtmlConnector({
      launchBrowser: async () =>
        ({
          newPage: async () => page,
          close: async () => undefined,
        }) as never,
    });
    const apiBody = JSON.stringify({
      SearchResult: {
        SearchResultItems: [
          {
            MatchedObjectId: "66097",
            MatchedObjectDescriptor: {
              PositionTitle: "Automation QA Test Engineer",
              PositionLocation: [{ CityName: "London", CountryName: "United Kingdom" }],
              PositionURI: "/index.php?ac=jobad&id=66097",
            },
          },
        ],
      },
    });
    const fetchImplementation = stubFetchResponses([{ body: apiBody }]);
    vi.stubGlobal("fetch", fetchImplementation);
    const capture = context({
      company: {
        ...context().company,
        configuration: {
          capture: {
            urlPatterns: ["**beesite.de/search/**"],
            jobArrayPaths: ["SearchResult.SearchResultItems"],
            apiUrl: "https://api-deutschebank.beesite.de/search/?data=x",
          },
        },
      },
    });

    const jobs = await connector.discoverJobs(capture);

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      title: "Automation QA Test Engineer",
      locationText: "London, United Kingdom",
      applicationUrl: "https://boards.example.com/index.php?ac=jobad&id=66097",
    });
    expect(fetchImplementation.mock.calls[0]![0]).toBe(
      "https://api-deutschebank.beesite.de/search/?data=x",
    );
  });

  it("healthCheck requires job links on the rendered careers page", async () => {
    const connector = createBrowserHtmlConnector({
      launchBrowser: async () =>
        ({
          newPage: async () => new FakePage(htmlByUrl),
          close: async () => undefined,
        }) as never,
    });

    await expect(connector.healthCheck(context())).resolves.toBeUndefined();
    const empty = createBrowserHtmlConnector({
      launchBrowser: async () =>
        ({
          newPage: async () => new FakePage(() => "<html><body></body></html>"),
          close: async () => undefined,
        }) as never,
    });
    await expect(empty.healthCheck(context())).rejects.toMatchObject({
      code: "parser_changed",
    });
  });
});
