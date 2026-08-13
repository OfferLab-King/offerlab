import { describe, expect, it } from "vitest";

import { mapWithConcurrency } from "./types";

describe("mapWithConcurrency", () => {
  it("maps every item exactly once with bounded concurrency", async () => {
    let active = 0;
    let maxActive = 0;
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const mapped = await mapWithConcurrency(
      Array.from({ length: 25 }, (_, index) => index),
      5,
      async (value) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await delay(2);
        active -= 1;
        return value * 2;
      },
    );
    expect(mapped).toEqual(Array.from({ length: 25 }, (_, index) => index * 2));
    expect(maxActive).toBeLessThanOrEqual(5);
  });

  it("handles empty input and a concurrency larger than the input", async () => {
    expect(await mapWithConcurrency([], 4, async (value) => value)).toEqual([]);
    expect(await mapWithConcurrency([1, 2], 10, async (value) => value + 1)).toEqual([2, 3]);
  });
});
