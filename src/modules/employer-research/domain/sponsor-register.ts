import { slugifyEmployerName } from "./identity-match";

export type SponsorRegisterOrganisation = Readonly<{
  legalName: string;
  locations: readonly string[];
  ratings: readonly string[];
  routes: readonly string[];
  rowCount: number;
}>;

export type SponsorRegisterParseResult = Readonly<{
  organisations: readonly SponsorRegisterOrganisation[];
  rejected: readonly { row: number; reason: string }[];
  sourceRows: number;
}>;

export function sponsorRegisterNameKey(value: string): string {
  return value.replace(/\s+/gu, " ").trim().toLocaleLowerCase("en-GB");
}

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value).replace(/\s+/gu, " ").trim()
    : "";
}

export function parseSponsorRegister(
  rows: readonly Readonly<Record<string, unknown>>[],
): SponsorRegisterParseResult {
  const grouped = new Map<
    string,
    {
      legalName: string;
      locations: Set<string>;
      ratings: Set<string>;
      routes: Set<string>;
      rowCount: number;
    }
  >();
  const rejected: { row: number; reason: string }[] = [];

  for (const [index, row] of rows.entries()) {
    const legalName = text(row["Organisation Name"]);
    if (!legalName || legalName.length > 200) {
      rejected.push({ row: index + 2, reason: legalName ? "name_too_long" : "missing_name" });
      continue;
    }
    const key = sponsorRegisterNameKey(legalName);
    const aggregate = grouped.get(key) ?? {
      legalName,
      locations: new Set<string>(),
      ratings: new Set<string>(),
      routes: new Set<string>(),
      rowCount: 0,
    };
    aggregate.rowCount += 1;
    const town = text(row["Town/City"]);
    const county = text(row.County);
    const location = [town, county].filter(Boolean).join(", ");
    const rating = text(row["Type & Rating"]);
    const route = text(row.Route);
    if (location) aggregate.locations.add(location);
    if (rating) aggregate.ratings.add(rating);
    if (route) aggregate.routes.add(route);
    grouped.set(key, aggregate);
  }

  return {
    organisations: [...grouped.values()]
      .map((entry) => ({
        legalName: entry.legalName,
        locations: [...entry.locations].sort((a, b) => a.localeCompare(b)),
        ratings: [...entry.ratings].sort((a, b) => a.localeCompare(b)),
        routes: [...entry.routes].sort((a, b) => a.localeCompare(b)),
        rowCount: entry.rowCount,
      }))
      .sort((a, b) => a.legalName.localeCompare(b.legalName)),
    rejected,
    sourceRows: rows.length,
  };
}

function stableHash(value: string): string {
  let hash = 2_166_136_261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36);
}

export function uniqueSponsorCompanySlug(legalName: string, existing: Set<string>): string {
  const base = slugifyEmployerName(legalName);
  if (!existing.has(base)) {
    existing.add(base);
    return base;
  }
  const hash = stableHash(sponsorRegisterNameKey(legalName));
  for (let attempt = 0; attempt < 10_000; attempt += 1) {
    const suffix = attempt === 0 ? hash : `${hash}-${attempt + 1}`;
    const candidate = `${base.slice(0, 79 - suffix.length)}-${suffix}`;
    if (!existing.has(candidate)) {
      existing.add(candidate);
      return candidate;
    }
  }
  throw new Error(`Unable to allocate a sponsor employer slug for ${legalName}`);
}
