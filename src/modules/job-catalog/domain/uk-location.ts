import type { DiscoveredJob, DiscoveredLocation } from "./deduplication";

export type UkLocationStatus = "uk_confirmed" | "non_uk" | "ambiguous";

export type UkLocationEvaluation = Readonly<{
  evidence: string | null;
  reason: "uk_location" | "uk_remote" | "non_uk_location" | "location_ambiguous";
  status: UkLocationStatus;
  ukLocations: readonly DiscoveredLocation[];
}>;

const ukCountryPattern =
  /^(?:uk|u\.k\.|united kingdom|great britain|gb|england|scotland|wales|northern ireland)$/iu;
const explicitUkText =
  /\b(?:uk|u\.k\.|united kingdom|great britain|england|scotland|wales|northern ireland|london|cardiff|edinburgh|belfast|uk-wide|across the uk|remote(?:ly)?\s+(?:in|within)\s+the uk|remote(?:ly)?\s*\(\s*(?:uk|u\.k\.|united kingdom)\s*\))(?![a-z])/iu;
const ukPostcode = /\b(?:[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/iu;
const nonUkCountryPattern =
  /^(?:ireland|republic of ireland|united states|usa|canada|france|germany|spain|italy|netherlands|australia|india|singapore|china|japan|switzerland)$/iu;
const ambiguousRemotePattern = /^remote(?:\s*[-–—/]?\s*(?:hybrid|anywhere|global))?$/iu;

function isUkLocation(location: DiscoveredLocation): boolean {
  return Boolean(
    (location.country && ukCountryPattern.test(location.country.trim())) ||
    explicitUkText.test(location.sourceText) ||
    ukPostcode.test(location.sourceText),
  );
}

function explicitlyNonUk(location: DiscoveredLocation): boolean {
  return Boolean(location.country && nonUkCountryPattern.test(location.country.trim()));
}

export function evaluateUkLocation(
  job: Pick<DiscoveredJob, "locationText" | "locations" | "remoteType">,
): UkLocationEvaluation {
  const locations = [...(job.locations ?? [])];
  const ukLocations = locations.filter(isUkLocation);
  if (ukLocations.length > 0) {
    return {
      evidence: ukLocations[0]!.sourceText.slice(0, 200),
      reason: "uk_location",
      status: "uk_confirmed",
      ukLocations,
    };
  }

  const text = job.locationText.trim();
  if (explicitUkText.test(text) || ukPostcode.test(text)) {
    return {
      evidence: text.slice(0, 200),
      reason: /remote/iu.test(text) ? "uk_remote" : "uk_location",
      status: "uk_confirmed",
      ukLocations: [],
    };
  }

  if (locations.length > 0 && locations.every(explicitlyNonUk)) {
    return {
      evidence: locations
        .map(({ sourceText }) => sourceText)
        .join("; ")
        .slice(0, 200),
      reason: "non_uk_location",
      status: "non_uk",
      ukLocations: [],
    };
  }

  if (text && nonUkCountryPattern.test(text.trim())) {
    return {
      evidence: text.slice(0, 200),
      reason: "non_uk_location",
      status: "non_uk",
      ukLocations: [],
    };
  }

  if (!text || ambiguousRemotePattern.test(text) || job.remoteType === "remote") {
    return {
      evidence: text || null,
      reason: "location_ambiguous",
      status: "ambiguous",
      ukLocations: [],
    };
  }

  return {
    evidence: text.slice(0, 200),
    reason: "location_ambiguous",
    status: "ambiguous",
    ukLocations: [],
  };
}
