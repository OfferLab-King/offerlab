import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchText, parseRetryAfterSeconds } from "./http-client";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function stubHttpClient() {
  return {
    assertSafeUrl: async () => undefined,
    maxResponseBytes: 5_000_000,
    retries: 1,
    timeoutMs: 5_000,
    userAgent: "test-agent",
  };
}

function response(body: string, status = 200, headers: Record<string, string> = {}) {
  return {
    headers: new Headers(headers),
    ok: status < 400,
    status,
    text: async () => body,
  } as Response;
}

describe("parseRetryAfterSeconds", () => {
  it("parses integer seconds", () => {
    expect(parseRetryAfterSeconds("5")).toBe(5);
    expect(parseRetryAfterSeconds("0")).toBe(0);
  });

  it("parses HTTP dates into seconds", () => {
    const value = parseRetryAfterSeconds(new Date(Date.now() + 10_000).toUTCString());
    expect(value).toBeGreaterThanOrEqual(9);
    expect(value).toBeLessThanOrEqual(11);
  });

  it("returns undefined for absent or malformed values", () => {
    expect(parseRetryAfterSeconds(null)).toBeUndefined();
    expect(parseRetryAfterSeconds("soon")).toBeUndefined();
  });
});

describe("fetchText", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("waits for Retry-After before retrying a 429", async () => {
    const fetchImplementation = vi
      .fn()
      .mockResolvedValueOnce(response("", 429, { "retry-after": "2" }))
      .mockResolvedValueOnce(response("ok"));
    vi.stubGlobal("fetch", fetchImplementation);

    const promise = fetchText("https://jobs.example.com/api", {
      httpClient: stubHttpClient(),
    });

    await vi.advanceTimersByTimeAsync(2_000);
    await expect(promise).resolves.toMatchObject({ status: 200 });
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });
});
