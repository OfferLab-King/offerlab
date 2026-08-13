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

export function matchCanonicalEmployer(
  input: Readonly<{
    canonicalName: string;
    existingCompanies: readonly ExistingCompanyIdentity[];
    existingAliases: readonly ExistingAliasIdentity[];
    evidenceWebsiteUrl?: string | null;
  }>,
): IdentityMatch {
  const normalizedName = normalizeEmployerName(input.canonicalName);
  const normalizedNameSet = new Map(
    input.existingCompanies.map((company) => [normalizeEmployerName(company.name), company.id]),
  );

  const exact = normalizedNameSet.get(normalizedName);
  if (exact) {
    return {
      companyId: exact,
      grade: "exact",
      normalizedName,
      reason: "exact normalized name match",
    };
  }

  const slug = slugifyEmployerName(input.canonicalName);
  const slugMatch = input.existingCompanies.find((company) => company.slug === slug);
  if (slugMatch) {
    return { companyId: slugMatch.id, grade: "exact", normalizedName, reason: "slug match" };
  }

  const aliasKey = input.canonicalName.trim().toLowerCase();
  const aliasMatch = input.existingAliases.find((alias) => alias.alias.toLowerCase() === aliasKey);
  if (aliasMatch) {
    return {
      companyId: aliasMatch.companyId,
      grade: "alias",
      normalizedName,
      reason: `alias match: ${input.canonicalName}`,
    };
  }
  const aliasNormalized = input.existingAliases.find(
    (alias) => normalizeEmployerName(alias.alias) === normalizedName,
  );
  if (aliasNormalized) {
    return {
      companyId: aliasNormalized.companyId,
      grade: "alias",
      normalizedName,
      reason: `normalized alias match: ${input.canonicalName}`,
    };
  }

  const websiteHost = websiteHostname(input.evidenceWebsiteUrl);
  if (websiteHost) {
    const websiteMatch = input.existingCompanies.find(
      (company) => websiteHostname(company.websiteUrl) === websiteHost,
    );
    if (websiteMatch) {
      return {
        companyId: websiteMatch.id,
        grade: "website",
        normalizedName,
        reason: `website host match: ${websiteHost}`,
      };
    }
  }

  for (const company of input.existingCompanies) {
    const companyNormalized = normalizeEmployerName(company.name);
    if (companyNormalized.length > 0 && companyNormalized === normalizedName) {
      return {
        companyId: company.id,
        grade: "normalized",
        normalizedName,
        reason: "normalized name match",
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
