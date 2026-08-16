import { htmlToPlainText } from "../../domain/html-text";
import type { DiscoveredLocation } from "../../domain/deduplication";
import { JobFetchError } from "./errors";
import { fetchText } from "./http-client";
import type { HttpClient } from "./http-client";
import type { RobotsGate } from "./robots";

export type WorkdayDetailFetchContext = Readonly<{
  httpClient: HttpClient;
  robotsGate: RobotsGate;
}>;

export type WorkdayDetailLocation = Readonly<{
  city: string | null;
  country: string | null;
  region: string | null;
}>;

/**
 * Extracts job locations from a Workday job detail page.
 *
 * Workday detail pages embed JSON-LD with a jobLocation (one Place per
 * location) carrying a PostalAddress with addressLocality and
 * addressCountry. This is the reliable way to resolve aggregate listing
 * strings such as "2 Locations" that the CXS search response returns.
 */
export function extractWorkdayDetailLocations(html: string): readonly WorkdayDetailLocation[] {
  const locations: WorkdayDetailLocation[] = [];
  const jsonLdBlocks = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/giu);
  if (!jsonLdBlocks) return locations;
  for (const block of jsonLdBlocks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(block.replace(/^<script[^>]*>/iu, "").replace(/<\/script>$/iu, ""));
    } catch {
      continue;
    }
    const jobLocation = extractJobLocationField(parsed);
    if (!jobLocation) continue;
    for (const entry of normalizeJobLocationEntries(jobLocation)) {
      locations.push({
        city: entry.address?.addressLocality ?? null,
        country: entry.address?.addressCountry ?? null,
        region: entry.address?.addressRegion ?? null,
      });
    }
  }
  return locations;
}

function extractJobLocationField(payload: unknown): unknown {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if ("jobLocation" in record) return record.jobLocation;
    if (Array.isArray(record["@graph"])) {
      for (const node of record["@graph"]) {
        const nested = extractJobLocationField(node);
        if (nested !== null) return nested;
      }
    }
  }
  return null;
}

function normalizeJobLocationEntries(value: unknown): readonly Readonly<{
  address?: Readonly<{ addressLocality?: string; addressCountry?: string; addressRegion?: string }>;
}>[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) =>
      typeof entry === "object" && entry !== null ? [entry as never] : [],
    );
  }
  if (value && typeof value === "object") return [value as never];
  return [];
}

export type WorkdayDetailLocationResolution = Readonly<{
  locations: readonly DiscoveredLocation[];
  sourceText: string;
}>;

/**
 * Fetches a Workday job detail page (robots-gated, bounded) and resolves its
 * locations into structured DiscoveredLocation rows for the eligibility gate.
 */
export async function resolveWorkdayDetailLocations(
  applicationUrl: string,
  context: WorkdayDetailFetchContext,
): Promise<WorkdayDetailLocationResolution> {
  const robots = await context.robotsGate.check(applicationUrl, "offerlab");
  if (robots === "blocked") {
    throw new JobFetchError("robots_blocked", "workday_detail_robots_blocked");
  }
  const response = await fetchText(applicationUrl, { httpClient: context.httpClient });
  if (response.status >= 400) {
    throw new JobFetchError("http_error", `workday_detail_${response.status}`);
  }
  const extracted = extractWorkdayDetailLocations(response.body);
  const locations: DiscoveredLocation[] = extracted.map((location) => {
    const parts = [location.city, location.region, location.country].filter(
      (part): part is string => Boolean(part?.trim()),
    );
    return {
      city: location.city,
      country: location.country,
      hybrid: false,
      onSite: true,
      region: location.region,
      remote: false,
      sourceText: parts.join(", "),
    };
  });
  const sourceText = locations.map((location) => location.sourceText).join("; ");
  return { locations, sourceText };
}

export function workdayDetailPageHasLocations(html: string): boolean {
  return extractWorkdayDetailLocations(html).length > 0;
}

export function workdayDetailPageText(html: string): string {
  return htmlToPlainText(html).slice(0, 200);
}
