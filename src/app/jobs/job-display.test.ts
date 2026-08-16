import { describe, expect, it } from "vitest";

import { formatSalary, isDeadlinePassed } from "./job-display";

describe("job deadline presentation", () => {
  it("keeps a date-only deadline open for the full London calendar day", () => {
    const deadline = new Date("2026-08-10T00:00:00.000Z");
    expect(isDeadlinePassed(deadline, new Date("2026-08-10T22:59:59.000Z"))).toBe(false);
    expect(isDeadlinePassed(deadline, new Date("2026-08-10T23:00:00.000Z"))).toBe(true);
  });
});

describe("salary presentation", () => {
  it("uses the pound symbol by default", () => {
    expect(formatSalary(45_000, 50_000, null, "year")).toBe("£45k – £50k per year");
  });

  it("renders a bare ISO currency code as the local symbol", () => {
    expect(formatSalary(45_000, 50_000, "GBP", "year")).toBe("£45k – £50k per year");
    expect(formatSalary(60_000, null, "EUR", null)).toBe("From €60k");
  });

  it("handles a single bound", () => {
    expect(formatSalary(null, 30_000, "GBP", "year")).toBe("Up to £30k per year");
    expect(formatSalary(25_000, null, "USD", null)).toBe("From US$25k");
  });
});
