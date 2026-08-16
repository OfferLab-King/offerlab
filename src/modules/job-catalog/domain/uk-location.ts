import type { DiscoveredJob, DiscoveredLocation } from "./deduplication";
import { ukCityNameIn } from "./uk-cities";

export type UkLocationStatus = "uk_confirmed" | "non_uk" | "ambiguous";

export type UkLocationEvaluation = Readonly<{
  evidence: string | null;
  reason: "uk_location" | "uk_remote" | "non_uk_location" | "location_ambiguous";
  status: UkLocationStatus;
  ukLocations: readonly DiscoveredLocation[];
}>;

const ukCountryPattern =
  /\b(?:uk|u\.k\.|united kingdom|great britain|gb|england|scotland|wales|northern ireland)\b/iu;
const explicitUkText =
  /\b(?:uk|u\.k\.|united kingdom|great britain|england|scotland|wales|northern ireland|uk-wide|across the uk|remote(?:ly)?\s+(?:in|within)\s+the uk|remote(?:ly)?\s*\(\s*(?:uk|u\.k\.|united kingdom)\s*\))(?![a-z])/iu;
const ukPostcode = /\b(?:[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/iu;
const nonUkCountryPattern =
  /^(?:ireland|republic of ireland|united states|usa|u\.s\.a\.|united states of america|canada|france|germany|spain|italy|netherlands|australia|india|singapore|china|japan|switzerland)$/iu;
const ambiguousRemotePattern = /^remote(?:\s*[-–—/]?\s*(?:hybrid|anywhere|global))?$/iu;

/**
 * Foreign place signals that disambiguate same-named cities abroad (Perth,
 * Birmingham, Cambridge, London, York, Newcastle, ...). City-name matching is
 * UK-confirming only when none of these signals is present, and a structured
 * non-UK country always overrides a city name.
 */
const foreignPlaceSignals =
  /\b(?:united states|usa|us|america|nz|new zealand|canada|australia|germany|france|spain|italy|netherlands|ireland|republic of ireland|india|singapore|china|japan|switzerland|austria|belgium|poland|portugal|brazil|mexico|argentina|colombia|chile|peru|south africa|nigeria|kenya|ghana|egypt|uae|dubai|saudi arabia|qatar|kuwait|israel|turkey|greece|sweden|norway|denmark|finland|czechia|czech republic|hungary|romania|bulgaria|croatia|serbia|ukraine|russia|philippines|malaysia|indonesia|thailand|vietnam|south korea|hong kong|taiwan|pakistan|bangladesh|sri lanka|deutschland|frankreich|indien|irland|australien|kanada|spanien|italien|portugal|niederlande|österreich|schweiz|polen|brasilien|vereinigte staaten|japon|espagne|allemagne|canadá|mexique|brasil|estados unidos|alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming|ontario|quebec|alberta|british columbia|manitoba|saskatchewan|nova scotia|new brunswick|newfoundland|new south wales|victoria|queensland|tasmania|south australia|western australia)\b/iu;

function isUkLocation(location: DiscoveredLocation): boolean {
  const text = location.sourceText;
  if (location.country) {
    if (ukCountryPattern.test(location.country.trim())) return true;
    if (explicitlyNonUk(location) || ukCityNameIn(text)) return false;
    return Boolean(explicitUkText.test(text) || ukPostcode.test(text));
  }
  return Boolean(
    explicitUkText.test(text) ||
    ukPostcode.test(text) ||
    (ukCityNameIn(text) && !foreignPlaceSignals.test(text)),
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

  if (text && ukCityNameIn(text) && !foreignPlaceSignals.test(text)) {
    return {
      evidence: text.slice(0, 200),
      reason: "uk_location",
      status: "uk_confirmed",
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
