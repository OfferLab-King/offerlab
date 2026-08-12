import { canonicalizeJobUrl } from "../../domain/urls";
import { parseOptionalDate, type DiscoveredJob } from "./types";

/**
 * Network-response capture for SPA career sites. The site's own JavaScript
 * calls its own JSON/GraphQL API; we intercept those responses and normalize
 * the job-shaped arrays inside them. This is the standard technique used by
 * production scrapers for JavaScript-heavy job boards.
 */

export type CaptureConfig = Readonly<{
  urlPatterns: readonly string[];
  jobArrayPaths?: readonly string[];
  apiUrl?: string;
}>;

export function captureConfigFrom(
  configuration: Readonly<Record<string, unknown>>,
): CaptureConfig | null {
  const capture = configuration.capture;
  if (typeof capture !== "object" || capture === null) return null;
  const record = capture as Readonly<Record<string, unknown>>;
  const patterns = Array.isArray(record.urlPatterns)
    ? record.urlPatterns.filter((value): value is string => typeof value === "string")
    : [];
  if (patterns.length === 0) return null;
  const paths = Array.isArray(record.jobArrayPaths)
    ? record.jobArrayPaths.filter((value): value is string => typeof value === "string")
    : [];
  const apiUrl =
    typeof record.apiUrl === "string" && record.apiUrl.length > 0 ? record.apiUrl : undefined;
  return {
    urlPatterns: patterns,
    ...(paths.length > 0 ? { jobArrayPaths: paths } : {}),
    ...(apiUrl !== undefined ? { apiUrl } : {}),
  };
}

export function matchesCapturePattern(pattern: string, url: string): boolean {
  const regex = new RegExp(
    `^${pattern
      .split(/\*\*/u)
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
      .join(".*")}$`,
    "iu",
  );
  return regex.test(url);
}

const JOB_ARRAY_KEYS = [
  "jobPostings",
  "jobs",
  "items",
  "results",
  "requisitions",
  "vacancies",
  "postings",
  "data",
];

function isJobShaped(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Readonly<Record<string, unknown>>;
  const title =
    record.title ??
    record.name ??
    record.jobTitle ??
    record.job_title ??
    record.position ??
    record.positionTitle;
  const url =
    record.url ??
    record.applicationUrl ??
    record.applyUrl ??
    record.externalUrl ??
    record.permalink ??
    record.jobPostingUrl ??
    record.apply_url;
  return (
    typeof title === "string" &&
    title.length > 0 &&
    (typeof url === "string" || record.externalPath !== undefined)
  );
}

export function findJobArrays(payload: unknown, paths: readonly string[]): unknown[] {
  if (paths.length > 0) {
    const results: unknown[] = [];
    for (const path of paths) {
      const value = resolveJsonPath(payload, path);
      if (Array.isArray(value)) results.push(...value);
    }
    return results;
  }
  const detected = collectJobArrays(payload, new Set<unknown>(), 0);
  return detected.flat();
}

function resolveJsonPath(payload: unknown, path: string): unknown {
  let current: unknown = payload;
  for (const segment of path.split(".")) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Readonly<Record<string, unknown>>)[segment];
  }
  return current;
}

function collectJobArrays(value: unknown, seen: Set<unknown>, depth: number): unknown[][] {
  if (depth > 6 || value === null || typeof value !== "object" || seen.has(value)) return [];
  seen.add(value);
  if (Array.isArray(value)) {
    if (value.length > 0 && value.every((item) => isJobShaped(item))) return [value];
    const nested: unknown[][] = [];
    for (const item of value) nested.push(...collectJobArrays(item, seen, depth + 1));
    return nested;
  }
  const nested: unknown[][] = [];
  const record = value as Readonly<Record<string, unknown>>;
  for (const key of Object.keys(record)) {
    if (JOB_ARRAY_KEYS.includes(key.toLowerCase())) {
      const child = record[key];
      if (Array.isArray(child) && child.length > 0 && child.every((item) => isJobShaped(item))) {
        return [child];
      }
    }
    nested.push(...collectJobArrays(record[key], seen, depth + 1));
  }
  return nested;
}

export function normalizeCapturedJob(raw: unknown, baseUrl: string): DiscoveredJob {
  const root =
    typeof raw === "object" && raw !== null ? (raw as Readonly<Record<string, unknown>>) : {};
  const descriptor =
    typeof root.MatchedObjectDescriptor === "object" && root.MatchedObjectDescriptor !== null
      ? (root.MatchedObjectDescriptor as Readonly<Record<string, unknown>>)
      : null;
  const record = descriptor ?? root;
  const title =
    firstString(record, [
      "PositionTitle",
      "jobTitle",
      "job_title",
      "title",
      "positionTitle",
      "position",
      "name",
    ]) ?? "";
  const rawUrl =
    firstString(record, [
      "PositionURI",
      "applicationUrl",
      "applyUrl",
      "apply_url",
      "externalUrl",
      "permalink",
      "jobPostingUrl",
      "url",
    ]) ?? "";
  const externalPath = firstString(record, ["externalPath"]) ?? "";
  const base = new URL(baseUrl);
  let applicationUrl = "";
  if (rawUrl) {
    try {
      applicationUrl = new URL(rawUrl, base).toString();
    } catch {
      applicationUrl = "";
    }
  } else if (externalPath) {
    applicationUrl = new URL(
      externalPath.startsWith("/") ? externalPath : `/${externalPath}`,
      base,
    ).toString();
  }
  const canonical = canonicalizeJobUrl(applicationUrl);
  const finalUrl = canonical ?? applicationUrl;
  if (!title || !finalUrl) {
    return {
      applicationDeadline: null,
      applicationUrl: "",
      descriptionText: "",
      employmentType: null,
      externalJobId: null,
      locationText: "",
      postedAt: null,
      remoteType: null,
      salaryCurrency: null,
      salaryMax: null,
      salaryMin: null,
      salaryPeriod: null,
      sourcePayload: null,
      sourceUrl: null,
      title: "",
    };
  }
  return {
    applicationDeadline: null,
    applicationUrl: finalUrl,
    descriptionText:
      firstString(record, [
        "description",
        "jobDescription",
        "job_description",
        "descriptionText",
        "PositionFormattedDescription",
      ]) ?? "",
    employmentType: null,
    externalJobId:
      firstString(record, [
        "PositionID",
        "requisitionId",
        "reqId",
        "jobId",
        "job_id",
        "externalJobId",
        "id",
      ]) ??
      firstString(root, ["MatchedObjectId"]) ??
      null,
    locationText: locationTextOf(record) ?? "",
    postedAt:
      parseOptionalDate(
        firstString(record, [
          "PublicationStartDate",
          "postedOn",
          "posted_date",
          "datePosted",
          "createdDate",
          "created_date",
        ]) ?? null,
      ) ?? null,
    remoteType: null,
    salaryCurrency: null,
    salaryMax: null,
    salaryMin: null,
    salaryPeriod: null,
    sourcePayload: { captureKeys: Object.keys(record).slice(0, 12) },
    sourceUrl: finalUrl,
    title: title.slice(0, 300),
  };
}

function firstString(
  record: Readonly<Record<string, unknown>>,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function locationTextOf(record: Readonly<Record<string, unknown>>): string | null {
  const direct = firstString(record, [
    "PositionLocationText",
    "locationText",
    "location_text",
    "locationsText",
    "city",
  ]);
  if (direct) return direct;
  const location = record.PositionLocation ?? record.location ?? record.locations;
  if (typeof location === "string") return location;
  if (Array.isArray(location)) {
    return location
      .map((item) => {
        if (typeof item === "string") return item;
        if (typeof item === "object" && item !== null) {
          const entry = item as Readonly<Record<string, unknown>>;
          const city = firstString(entry, ["CityName", "name", "label", "city"]);
          const country = firstString(entry, ["CountryName", "country"]);
          return city && country ? `${city}, ${country}` : (city ?? country);
        }
        return null;
      })
      .filter((value): value is string => Boolean(value))
      .join(", ");
  }
  if (typeof location === "object" && location !== null) {
    return (
      firstString(location as Readonly<Record<string, unknown>>, [
        "CityName",
        "name",
        "label",
        "city",
      ]) ?? firstString(location as Readonly<Record<string, unknown>>, ["CountryName", "country"])
    );
  }
  return null;
}
