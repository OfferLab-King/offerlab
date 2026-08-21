import { describe, expect, it } from "vitest";

import {
  channelFromCareersUrl,
  deriveOfficialHomepageCandidates,
  homepageHasEmployerIdentity,
} from "./free-web-discovery";

describe("free official web discovery", () => {
  it("derives a small deterministic domain set without legal suffixes", () => {
    expect(deriveOfficialHomepageCandidates("North Star Technology Limited")).toEqual([
      "https://northstartechnology.co.uk",
      "https://northstartechnology.com",
      "https://north-star-technology.co.uk",
      "https://north-star-technology.com",
      "https://northstartechnology.uk",
    ]);
  });

  it("requires employer evidence in both hostname and page identity", () => {
    expect(
      homepageHasEmployerIdentity(
        "North Star Technology Limited",
        "https://northstartechnology.co.uk",
        "<title>North Star Technology</title><h1>Welcome</h1>",
      ),
    ).toBe(true);
    expect(
      homepageHasEmployerIdentity(
        "North Star Technology Limited",
        "https://northstartechnology.co.uk",
        "<title>This domain is for sale</title>",
      ),
    ).toBe(false);
  });

  it("classifies channel-specific careers paths", () => {
    expect(channelFromCareersUrl("https://example.com/early-careers/graduates")).toBe(
      "early_careers",
    );
    expect(channelFromCareersUrl("https://example.com/experienced-professionals")).toBe(
      "professional",
    );
  });
});
