import { describe, expect, it } from "vitest";

import { discoveredJobFromReclassificationRow } from "./reclassify";

describe("discoveredJobFromReclassificationRow", () => {
  const row = {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Backend Engineer III",
    description_text: "Build the future of banking.",
    application_deadline: null,
    source_payload: { board: "monzo" } as never,
    classification_source: "deterministic",
    location_text: "Cardiff, London or Remote (UK)",
    locations: [
      {
        city: null,
        country: null,
        hybrid: false,
        onSite: false,
        region: null,
        remote: true,
        sourceText: "Remote (UK)",
      },
    ],
  };

  it("carries stored location text and locations into deterministic classification", () => {
    const job = discoveredJobFromReclassificationRow(row);
    expect(job.locationText).toBe("Cardiff, London or Remote (UK)");
    expect(job.locations).toEqual(row.locations);
  });

  it("tolerates missing location data", () => {
    const job = discoveredJobFromReclassificationRow({
      ...row,
      location_text: null,
      locations: [],
    });
    expect(job.locationText).toBe("");
    expect(job.locations).toEqual([]);
  });
});
