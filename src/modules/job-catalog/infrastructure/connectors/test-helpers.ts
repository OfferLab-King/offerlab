import { readFile } from "node:fs/promises";
import { vi } from "vitest";
import { fileURLToPath } from "node:url";

import type { HttpClient } from "./http-client";
import type { ConnectorContext } from "./types";

export type StubFetch = ReturnType<typeof vi.fn>;

export function fixturePath(name: string): string {
  return fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
}

export function readFixture(name: string): Promise<string> {
  return readFile(fixturePath(name), "utf8");
}

export function stubHttpClient(): HttpClient {
  return {
    retries: 0,
    timeoutMs: 5_000,
    userAgent: "test-agent",
    maxResponseBytes: 5_000_000,
    assertSafeUrl: async () => undefined,
  };
}

export function stubFetchResponses(
  responses: Array<{ body: string; status?: number }>,
  onUrl?: (url: string) => void,
): StubFetch {
  const calls: string[] = [];
  const fetchImplementation = vi.fn(async (input: RequestInfo | URL) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push(url);
    onUrl?.(url);
    const next = responses.shift() ?? { body: "{}", status: 200 };
    return {
      headers: new Headers({ "content-type": "application/json" }),
      ok: next.status === undefined || next.status < 400,
      status: next.status ?? 200,
      text: async () => next.body,
    };
  });
  return Object.assign(fetchImplementation, { calls });
}

export function stubRobotsGate(allowed = true) {
  return {
    check: async () => (allowed ? "allowed" : "blocked"),
  } as unknown as ConnectorContext["robotsGate"];
}

export function stubContext(companyOverrides: Partial<ConnectorContext["company"]> = {}): {
  company: ConnectorContext["company"];
} {
  return {
    company: {
      active: true,
      careersUrl: "https://boards.example.com",
      configuration: {},
      consecutiveFailures: 0,
      crawlAllowed: "allowed",
      crawlFrequencyMinutes: 1440,
      crawlStatus: "healthy",
      id: "company-1",
      lastCheckedAt: null,
      lastSuccessfulCheckAt: null,
      name: "Example Co",
      nextCheckAt: null,
      slug: "example-co",
      sourceType: "greenhouse",
      ...companyOverrides,
    },
  };
}
