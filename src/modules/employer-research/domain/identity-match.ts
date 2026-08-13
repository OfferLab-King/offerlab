/**
 * Deterministic canonical-employer identity matching. Maps researched
 * employer names to existing app.company identities with a confidence grade,
 * and retains ambiguous rows for administrator review instead of guessing.
 */

const LEGAL_SUFFIXES: readonly string[] = [
  "limited",
  "ltd",
  "plc",
  "llp",
  "group",
  "holdings",
  "holding",
  "uk",
  "u k",
  "the",
  "company",
  "corporation",
  "corp",
  "incorporated",
  "inc",
  "l p",
  "ltd co",
  "limited company",
] as const;

export type IdentityMatchGrade = "exact" | "alias" | "normalized" | "website" | "ambiguous";

export type IdentityMatch = Readonly<{
  grade: IdentityMatchGrade;
  companyId: string | null;
  normalizedName: string;
  reason: string;
}>;

export type ExistingCompanyIdentity = Readonly<{
  id: string;
  name: string;
  slug: string;
  websiteUrl: string | null;
}>;

export type ExistingAliasIdentity = Readonly<{
  alias: string;
  companyId: string;
}>;

export function normalizeEmployerName(name: string): string {
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .replace(/\b[a-z0-9]\b/gu, "")
    .trim();
  const words = normalized.split(" ").filter((word) => word.length > 0);
  const stripped = words.filter((word) => !LEGAL_SUFFIXES.includes(word));
  return (stripped.length > 0 ? stripped : words).join(" ");
}

export function slugifyEmployerName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 79);
  return slug.length > 0 ? slug : "employer";
}

export function uniqueSlug(base: string, existing: ReadonlySet<string>): string {
  const candidate = slugifyEmployerName(base);
  if (!existing.has(candidate)) return candidate;
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const withSuffix = `${candidate}-${suffix}`.slice(0, 79);
    if (!existing.has(withSuffix)) return withSuffix;
  }
  return `${candidate}-${Date.now()}`;
}

function websiteHostname(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./u, "").toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Multi-tenant ATS/career-platform hosts that are shared by many employers.
 * A URL on one of these hosts is platform evidence, not employer identity
 * evidence: matching on it could link two different employers together.
 */
const SHARED_ATS_HOSTS: readonly string[] = [
  "boards.greenhouse.io",
  "jobs.lever.co",
  "jobs.ashbyhq.com",
  "jobs.smartrecruiters.com",
  "jobs.workable.com",
  "careers-page.teamtailor.com",
  "myworkdayjobs.com",
  "careers.recruitee.com",
  "jobs.personio.com",
  "careers.personio.com",
] as const;

export function isSharedAtsHostname(hostname: string): boolean {
  return SHARED_ATS_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

export function employerWebsiteCandidateUrl(url: string): boolean {
  const hostname = websiteHostname(url);
  if (!hostname) return false;
  return !isSharedAtsHostname(hostname);
}

type UniqueCompanyMatch =
  Readonly<{ outcome: "none" | "ambiguous" }> | Readonly<{ companyId: string; outcome: "unique" }>;

function uniqueCompanyMatch(companyIds: readonly string[]): UniqueCompanyMatch {
  const unique = [...new Set(companyIds)];
  if (unique.length === 0) return { outcome: "none" };
  if (unique.length > 1) return { outcome: "ambiguous" };
  return { companyId: unique[0]!, outcome: "unique" };
}

function ambiguousMatch(normalizedName: string, evidence: string): IdentityMatch {
  return {
    companyId: null,
    grade: "ambiguous",
    normalizedName,
    reason: `multiple companies match ${evidence}; retain for review`,
  };
}

export function matchCanonicalEmployer(
  input: Readonly<{
    canonicalName: string;
    existingCompanies: readonly ExistingCompanyIdentity[];
    existingAliases: readonly ExistingAliasIdentity[];
    evidenceWebsiteUrl?: string | null;
  }>,
): IdentityMatch {
  const normalizedName = normalizeEmployerName(input.canonicalName);
  const nameMatch = uniqueCompanyMatch(
    input.existingCompanies
      .filter((company) => normalizeEmployerName(company.name) === normalizedName)
      .map((company) => company.id),
  );
  if (nameMatch.outcome === "ambiguous") {
    return ambiguousMatch(normalizedName, "normalized employer name");
  }
  if (nameMatch.outcome === "unique") {
    return {
      companyId: nameMatch.companyId,
      grade: "exact",
      normalizedName,
      reason: "exact normalized name match",
    };
  }

  const slug = slugifyEmployerName(input.canonicalName);
  const slugMatch = uniqueCompanyMatch(
    input.existingCompanies.filter((company) => company.slug === slug).map((company) => company.id),
  );
  if (slugMatch.outcome === "ambiguous") {
    return ambiguousMatch(normalizedName, "employer slug");
  }
  if (slugMatch.outcome === "unique") {
    return {
      companyId: slugMatch.companyId,
      grade: "exact",
      normalizedName,
      reason: "slug match",
    };
  }

  const aliasKey = input.canonicalName.trim().toLowerCase();
  const aliasMatch = uniqueCompanyMatch(
    input.existingAliases
      .filter(
        (alias) =>
          alias.alias.toLowerCase() === aliasKey ||
          normalizeEmployerName(alias.alias) === normalizedName,
      )
      .map((alias) => alias.companyId),
  );
  if (aliasMatch.outcome === "ambiguous") {
    return ambiguousMatch(normalizedName, "employer alias");
  }
  if (aliasMatch.outcome === "unique") {
    return {
      companyId: aliasMatch.companyId,
      grade: "alias",
      normalizedName,
      reason: `alias match: ${input.canonicalName}`,
    };
  }

  const websiteHost = websiteHostname(input.evidenceWebsiteUrl);
  if (websiteHost && !isSharedAtsHostname(websiteHost)) {
    const websiteMatch = uniqueCompanyMatch(
      input.existingCompanies
        .filter((company) => websiteHostname(company.websiteUrl) === websiteHost)
        .map((company) => company.id),
    );
    if (websiteMatch.outcome === "ambiguous") {
      return ambiguousMatch(normalizedName, `website host ${websiteHost}`);
    }
    if (websiteMatch.outcome === "unique") {
      return {
        companyId: websiteMatch.companyId,
        grade: "website",
        normalizedName,
        reason: `website host match: ${websiteHost}`,
      };
    }
  }

  return {
    companyId: null,
    grade: "ambiguous",
    normalizedName,
    reason: "no confident match; retain for review",
  };
}

export const curatedAliases: Readonly<Record<string, readonly string[]>> = {
  JPMorganChase: ["JPMorgan Chase", "J.P. Morgan", "JPMorgan"],
  "HSBC Holdings plc": ["HSBC"],
  "Lloyds Banking Group": ["Lloyds", "Lloyds Bank"],
  "NatWest Group": ["NatWest", "Royal Bank of Scotland"],
  Barclays: ["Barclays Bank"],
  KPMG: ["KPMG UK"],
  PwC: ["PricewaterhouseCoopers", "PwC UK"],
  EY: ["Ernst & Young"],
  Deloitte: ["Deloitte UK"],
};
