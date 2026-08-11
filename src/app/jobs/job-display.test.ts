import { describe, expect, it } from "vitest";

import { isDeadlinePassed } from "./job-display";

describe("job deadline presentation", () => {
  it("keeps a date-only deadline open for the full London calendar day", () => {
    const deadline = new Date("2026-08-10T00:00:00.000Z");
    expect(isDeadlinePassed(deadline, new Date("2026-08-10T22:59:59.000Z"))).toBe(false);
    expect(isDeadlinePassed(deadline, new Date("2026-08-10T23:00:00.000Z"))).toBe(true);
  });
});
