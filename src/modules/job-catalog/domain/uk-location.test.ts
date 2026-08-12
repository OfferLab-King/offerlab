import { describe, expect, it } from "vitest";
import { evaluateUkLocation } from "./uk-location";

describe("UK location admission", () => {
  it.each(["England", "Scotland", "Wales", "Northern Ireland", "UK", "United Kingdom", "GB"])(
    "confirms structured %s locations",
    (country) => {
      expect(
        evaluateUkLocation({
          locationText: country,
          locations: [
            {
              city: null,
              country,
              hybrid: false,
              onSite: true,
              region: null,
              remote: false,
              sourceText: country,
            },
          ],
          remoteType: "on_site",
        }).status,
      ).toBe("uk_confirmed");
    },
  );

  it("distinguishes Northern Ireland from the Republic of Ireland", () => {
    expect(evaluateUkLocation({ locationText: "Northern Ireland", remoteType: null }).status).toBe(
      "uk_confirmed",
    );
    expect(
      evaluateUkLocation({
        locationText: "Dublin",
        locations: [
          {
            city: "Dublin",
            country: "Ireland",
            hybrid: true,
            onSite: false,
            region: null,
            remote: false,
            sourceText: "Dublin, Ireland",
          },
        ],
        remoteType: "hybrid",
      }).status,
    ).toBe("non_uk");
  });

  it("accepts a multi-country role with a UK location", () => {
    expect(
      evaluateUkLocation({
        locationText: "London; Paris",
        locations: [
          {
            city: "London",
            country: "United Kingdom",
            hybrid: true,
            onSite: false,
            region: null,
            remote: false,
            sourceText: "London, UK",
          },
          {
            city: "Paris",
            country: "France",
            hybrid: true,
            onSite: false,
            region: null,
            remote: false,
            sourceText: "Paris, France",
          },
        ],
        remoteType: "hybrid",
      }).status,
    ).toBe("uk_confirmed");
  });

  it("holds countryless remote and unclear free text for review", () => {
    expect(evaluateUkLocation({ locationText: "Remote", remoteType: "remote" }).status).toBe(
      "ambiguous",
    );
    expect(evaluateUkLocation({ locationText: "EMEA", remoteType: null }).status).toBe("ambiguous");
  });

  it("does not treat Crown Dependencies as UK", () => {
    expect(evaluateUkLocation({ locationText: "Jersey", remoteType: null }).status).toBe(
      "ambiguous",
    );
  });
});
