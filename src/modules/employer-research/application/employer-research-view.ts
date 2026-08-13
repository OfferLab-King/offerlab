import type { PriorityTier } from "../domain/research-row";

export type EmployerResearchViewRow = Readonly<{
  companyId: string | null;
  name: string;
  slug: string | null;
  websiteUrl: string | null;
  tier: PriorityTier | null;
  employerValueScore: number | null;
  crawlerPriorityScore: number | null;
  sector: string | null;
  employeeBand: string | null;
  ownership: string | null;
  identityConfidence: string | null;
  researchStatus: string | null;
  researchDate: Date | null;
  sponsorEntities: number;
  sourceCandidates: number;
  liveSources: number;
  currentJobs: number;
  atsProviders: string | null;
  aliases: readonly string[];
}>;

export type EmployerResearchFilters = Readonly<{
  tier: PriorityTier | null;
  sector: string | null;
  employeeBand: string | null;
  ownership: string | null;
  identityConfidence: string | null;
  researchStatus: string | null;
  hasLiveSource: boolean;
  hasJobs: boolean;
  hasSourceCandidate: boolean;
  unresolved: boolean;
  search: string | null;
}>;

export const EMPLOYER_RESEARCH_TIERS = ["P0", "P1", "P2", "P3"] as const;
export const EMPLOYER_RESEARCH_CONFIDENCES = ["High", "Medium", "Low", "Ambiguous"] as const;
export const EMPLOYER_RESEARCH_STATUSES = [
  "not_researched",
  "verified_platform",
  "verified_careers_url",
  "needs_re_verification",
  "blocked_review",
  "verified_source",
] as const;

export function parseEmployerResearchFilters(
  searchParams: Readonly<Record<string, string | string[] | undefined>>,
): EmployerResearchFilters {
  const single = (key: string): string | null => {
    const value = searchParams[key];
    if (typeof value !== "string" || value.length === 0) return null;
    return value;
  };
  const tier = single("tier")?.toUpperCase() ?? null;
  return {
    tier: EMPLOYER_RESEARCH_TIERS.includes(tier as PriorityTier) ? (tier as PriorityTier) : null,
    sector: single("sector"),
    employeeBand: single("size"),
    ownership: single("ownership"),
    identityConfidence: EMPLOYER_RESEARCH_CONFIDENCES.includes(single("confidence") as never)
      ? single("confidence")
      : null,
    researchStatus: EMPLOYER_RESEARCH_STATUSES.includes(single("research") as never)
      ? single("research")
      : null,
    hasLiveSource: single("live") === "1",
    hasJobs: single("jobs") === "1",
    hasSourceCandidate: single("candidate") === "1",
    unresolved: single("unresolved") === "1",
    search: single("q")?.trim().toLowerCase() ?? null,
  };
}

export function filterEmployerResearchRows(
  rows: readonly EmployerResearchViewRow[],
  filters: EmployerResearchFilters,
): EmployerResearchViewRow[] {
  return rows.filter((row) => {
    if (filters.tier && row.tier !== filters.tier) return false;
    if (filters.sector && row.sector !== filters.sector) return false;
    if (filters.employeeBand && row.employeeBand !== filters.employeeBand) return false;
    if (filters.ownership && row.ownership !== filters.ownership) return false;
    if (filters.identityConfidence && row.identityConfidence !== filters.identityConfidence) {
      return false;
    }
    if (filters.researchStatus && row.researchStatus !== filters.researchStatus) return false;
    if (filters.hasLiveSource && row.liveSources === 0) return false;
    if (filters.hasJobs && row.currentJobs === 0) return false;
    if (filters.hasSourceCandidate && row.sourceCandidates === 0) return false;
    if (filters.unresolved && row.companyId !== null) return false;
    if (filters.search) {
      const haystack = [row.name, row.slug ?? "", row.aliases.join(" ")].join(" ").toLowerCase();
      if (!haystack.includes(filters.search)) return false;
    }
    return true;
  });
}

export function searchTargets(query: string): string | null {
  const trimmed = query.trim().toLowerCase();
  return trimmed.length === 0 ? null : trimmed;
}
