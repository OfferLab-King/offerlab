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

  it("accepts common parenthetical remote-within-UK wording such as Remote (UK)", () => {
    expect(
      evaluateUkLocation({ locationText: "Cardiff, London or Remote (UK)", remoteType: null })
        .status,
    ).toBe("uk_confirmed");
    expect(
      evaluateUkLocation({ locationText: "Remote (United Kingdom)", remoteType: null }).status,
    ).toBe("uk_confirmed");
  });

  it.each(["UK", "U.K.", "London", "Cardiff", "Edinburgh", "Belfast"])(
    "confirms unstructured UK location text %s",
    (locationText) => {
      expect(evaluateUkLocation({ locationText, remoteType: null }).status).toBe("uk_confirmed");
    },
  );

  it("does not treat parenthetical remote in another country as UK", () => {
    expect(evaluateUkLocation({ locationText: "Remote (Ireland)", remoteType: null }).status).toBe(
      "ambiguous",
    );
  });

  it("does not treat Crown Dependencies as UK", () => {
    expect(evaluateUkLocation({ locationText: "Jersey", remoteType: null }).status).toBe(
      "ambiguous",
    );
  });

  it.each([
    "Aberdeen",
    "Leeds",
    "Newcastle upon Tyne",
    "Stoke-on-Trent",
    "Edinburgh or Glasgow",
    "Belfast",
    "Cardiff",
    "Swansea",
    "Inverness",
    "Wrexham",
    "Newry",
    "London, Manchester, Birmingham",
  ])("confirms UK city text %s", (locationText) => {
    expect(evaluateUkLocation({ locationText, remoteType: null }).status).toBe("uk_confirmed");
  });

  it.each([
    ["Perth, Australia"],
    ["Birmingham, Alabama"],
    ["Cambridge, Massachusetts"],
    ["London, Canada"],
    ["York, Pennsylvania"],
    ["Newcastle, Australia"],
    ["Dublin, Ireland"],
    ["York, US"],
    ["New York, us"],
  ])("keeps same-named foreign cities out of the UK: %s", (locationText) => {
    expect(evaluateUkLocation({ locationText, remoteType: null }).status).not.toBe("uk_confirmed");
  });

  it("never lets a city name override a structured non-UK country", () => {
    expect(
      evaluateUkLocation({
        locationText: "Perth",
        locations: [
          {
            city: "Perth",
            country: "Australia",
            hybrid: false,
            onSite: true,
            region: null,
            remote: false,
            sourceText: "Perth, Australia",
          },
        ],
        remoteType: "on_site",
      }).status,
    ).toBe("non_uk");
  });

  it("confirms a structured location whose country is the full UK name", () => {
    expect(
      evaluateUkLocation({
        locationText: "London",
        locations: [
          {
            city: "London",
            country: "United Kingdom of Great Britain and Northern Ireland",
            hybrid: false,
            onSite: true,
            region: null,
            remote: false,
            sourceText: "London, United Kingdom",
          },
        ],
        remoteType: "on_site",
      }).status,
    ).toBe("uk_confirmed");
  });

  it("confirms UK cities inside foreign-language country names", () => {
    expect(
      evaluateUkLocation({
        locationText: "London, Großbritannien und Nordirland",
        remoteType: null,
      }).status,
    ).toBe("uk_confirmed");
    expect(
      evaluateUkLocation({ locationText: "Frankfurt, Deutschland", remoteType: null }).status,
    ).toBe("ambiguous");
  });
});

describe("full country names from structured sources", () => {
  const job = (country: string) => ({
    locationText: "Anywhere, " + country,
    locations: [
      {
        city: "Austin",
        country,
        hybrid: false,
        onSite: true,
        region: "TX",
        remote: false,
        sourceText: "Austin, TX, " + country,
      },
    ],
    remoteType: null,
  });

  it("treats United States of America as a structured non-UK country", () => {
    expect(evaluateUkLocation(job("United States of America"))).toMatchObject({
      reason: "non_uk_location",
      status: "non_uk",
    });
  });

  it("treats United Kingdom as a structured UK country", () => {
    expect(evaluateUkLocation(job("United Kingdom"))).toMatchObject({
      reason: "uk_location",
      status: "uk_confirmed",
    });
  });
});
