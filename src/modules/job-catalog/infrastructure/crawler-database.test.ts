import { describe, expect, it } from "vitest";

import { crawlerConnectionPoolSize } from "./crawler-database";

describe("crawlerConnectionPoolSize", () => {
  it("sizes the pool for the global lock plus concurrent workers holding advisory reservations and transactions", () => {
    expect(crawlerConnectionPoolSize({})).toBe(6);
  });

  it("scales with the configured crawler concurrency", () => {
    expect(crawlerConnectionPoolSize({ JOB_CRAWLER_MAX_CONCURRENCY: "1" })).toBe(4);
    expect(crawlerConnectionPoolSize({ JOB_CRAWLER_MAX_CONCURRENCY: "4" })).toBe(10);
  });

  it.each([
    ["0", 6],
    ["-2", 6],
    ["not-a-number", 6],
    ["", 6],
  ])("falls back to the default for invalid value %s", (value, expected) => {
    expect(crawlerConnectionPoolSize({ JOB_CRAWLER_MAX_CONCURRENCY: value })).toBe(expected);
  });
});
