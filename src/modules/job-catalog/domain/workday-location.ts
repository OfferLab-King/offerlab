const aggregateLocationPattern = /^\s*(?:\d+|multiple)\s+locations?\s*$/iu;
const aggregateLocationWithHintPattern = /^\s*(?:\d+|multiple)\s+locations?\s*;/iu;
const unusablePathLocations = new Set([
  "job",
  "jobs",
  "location",
  "locations",
  "multiple locations",
]);

/**
 * Workday CXS often supplies only "2 Locations" in the listing while its
 * official external path contains the primary place (`/job/London/...`). The
 * path hint is additive: it can confirm an obvious UK place, but never turns an
 * aggregate listing into a definite non-UK decision by itself.
 */
export function workdayLocationTextWithPathHint(
  listingLocation: string,
  externalPath: string | null | undefined,
): string {
  const listing = listingLocation.trim();
  if (listing && !aggregateLocationPattern.test(listing)) return listing;
  if (!externalPath) return listing;
  const segments = externalPath.split("/").filter(Boolean);
  const jobIndex = segments.findIndex((segment) => segment.toLowerCase() === "job");
  const rawLocation = jobIndex >= 0 ? segments[jobIndex + 1] : null;
  if (!rawLocation) return listing;
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawLocation).replaceAll(/[-_]+/gu, " ").trim();
  } catch {
    return listing;
  }
  if (!decoded || unusablePathLocations.has(decoded.toLowerCase())) return listing;
  return listing ? `${listing}; ${decoded}` : decoded;
}

export function hasAggregateWorkdayLocation(locationText: string): boolean {
  return (
    aggregateLocationPattern.test(locationText) ||
    aggregateLocationWithHintPattern.test(locationText)
  );
}
