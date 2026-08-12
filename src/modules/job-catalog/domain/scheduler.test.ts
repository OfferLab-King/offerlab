import { describe, expect, it } from "vitest";

import { isSourceDue, nextCheckAtWithJitter, sortDueSources } from "./scheduler";

describe("source scheduler", () => {
  it("treats never-checked sources as due", () => {
    expect(isSourceDue({ nextCheckAt: null }, new Date("2026-08-01T00:00:00Z"))).toBe(true);
  });

  it("treats past and now-due sources as due", () => {
    const now = new Date("2026-08-01T12:00:00Z");
    expect(isSourceDue({ nextCheckAt: new Date("2026-08-01T11:59:59Z") }, now)).toBe(true);
    expect(isSourceDue({ nextCheckAt: new Date("2026-08-01T12:00:00Z") }, now)).toBe(true);
  });

  it("keeps future sources pending", () => {
    expect(
      isSourceDue(
        { nextCheckAt: new Date("2026-08-01T12:00:01Z") },
        new Date("2026-08-01T12:00:00Z"),
      ),
    ).toBe(false);
  });

  it("prioritises a manual request even when the daily schedule is in the future", () => {
    const now = new Date("2026-08-01T12:00:00Z");
    expect(
      isSourceDue({ nextCheckAt: new Date("2026-08-02T12:00:00Z"), runRequestedAt: now }, now),
    ).toBe(true);
    const sorted = sortDueSources([
      { id: "scheduled", nextCheckAt: now, runRequestedAt: null },
      { id: "manual", nextCheckAt: new Date("2026-08-02T12:00:00Z"), runRequestedAt: now },
    ]);
    expect(sorted.map(({ id }) => id)).toEqual(["manual", "scheduled"]);
  });

  it("jitters next checks around the frequency without drifting on average", () => {
    const now = new Date("2026-08-01T00:00:00Z");
    const values: number[] = [];
    for (let index = 0; index < 200; index += 1) {
      const next = nextCheckAtWithJitter(60, now, 0.1);
      const minutes = (next.getTime() - now.getTime()) / 60_000;
      expect(minutes).toBeGreaterThanOrEqual(54);
      expect(minutes).toBeLessThanOrEqual(66);
      values.push(minutes);
    }
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    expect(mean).toBeGreaterThan(59);
    expect(mean).toBeLessThan(61);
  });

  it("sorts due sources soonest-first with never-checked first", () => {
    const sorted = sortDueSources([
      { nextCheckAt: new Date("2026-08-03T00:00:00Z") },
      { nextCheckAt: null },
      { nextCheckAt: new Date("2026-08-02T00:00:00Z") },
    ]);
    expect(sorted.map((entry) => entry.nextCheckAt?.toISOString() ?? null)).toEqual([
      null,
      "2026-08-02T00:00:00.000Z",
      "2026-08-03T00:00:00.000Z",
    ]);
  });
});
