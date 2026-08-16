import { describe, expect, it } from "vitest";

import { readFixture } from "./test-helpers";
import { extractWorkdayDetailLocations, workdayDetailPageHasLocations } from "./workday-detail";

describe("Workday detail location extraction", () => {
  it("extracts the embedded JSON-LD job location with country", async () => {
    const html = await readFixture("workday-detail.html");
    const locations = extractWorkdayDetailLocations(html);

    expect(locations.length).toBeGreaterThan(0);
    const location = locations[0]!;
    expect(location.country).toBe("United States of America");
    expect(location.city).toBe("Rocky Mount");
    expect(workdayDetailPageHasLocations(html)).toBe(true);
  });

  it("returns no locations for a page without JobPosting data", () => {
    expect(extractWorkdayDetailLocations("<html><body>No structured data</body></html>")).toEqual(
      [],
    );
    expect(workdayDetailPageHasLocations("<html></html>")).toBe(false);
  });
});
