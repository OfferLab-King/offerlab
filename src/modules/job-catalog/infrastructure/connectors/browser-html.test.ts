import { afterEach, describe, expect, it, vi } from "vitest";

import { createBrowserHtmlConnector, type BrowserPage } from "./browser-html";
import { stubContext, stubHttpClient, stubRobotsGate } from "./test-helpers";
import type { ConnectorContext } from "./types";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

class FakePage implements BrowserPage {
  readonly visited: string[] = [];
  private readonly htmlByUrl: (url: string) => string;

  constructor(htmlByUrl: (url: string) => string) {
    this.htmlByUrl = htmlByUrl;
  }

  async goto(url: string): Promise<void> {
    const html = this.htmlByUrl(url);
    if (html === "__TIMEOUT__") {
      const error = new Error(`navigation timeout on ${url}`) as Error & { name: string };
      error.name = "TimeoutError";
      throw error;
    }
    this.visited.push(url);
  }

  async waitForLoadState(): Promise<void> {}

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
