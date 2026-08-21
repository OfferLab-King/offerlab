import { describe, expect, it } from "vitest";

import { hasAggregateWorkdayLocation, workdayLocationTextWithPathHint } from "./workday-location";

describe("Workday path location hints", () => {
  it("adds the official path location to an aggregate listing label", () => {
    expect(workdayLocationTextWithPathHint("2 Locations", "/job/London/Programme-Analyst_42")).toBe(
      "2 Locations; London",
    );
  });

  it("preserves a useful listing location", () => {
    expect(workdayLocationTextWithPathHint("Edinburgh", "/job/London/Role_42")).toBe("Edinburgh");
  });

  it("does not invent a location from an unusable path", () => {
    expect(workdayLocationTextWithPathHint("Multiple Locations", "/job/locations/Role_42")).toBe(
      "Multiple Locations",
    );
  });

  it("keeps an aggregate label detectable after adding the fallback hint", () => {
    expect(hasAggregateWorkdayLocation("2 Locations; London")).toBe(true);
    expect(hasAggregateWorkdayLocation("London")).toBe(false);
  });
});
