/**
 * Typed model for the Top 1,000 sponsor-aware employer research workbook.
 * The XLSX is the human research artifact; the generated JSON
 * (data/generated/employer-targets/top-1000.json) is the deterministic
 * machine-readable derivative consumed by the importer. No runtime code
 * reads the workbook directly.
 */

export const EMPLOYER_TARGETS_DATASET_VERSION = "2026-08-12-enhanced-v2";
export const EMPLOYER_TARGETS_RESEARCH_DATE = "2026-08-12";

export type PriorityTier = "P0" | "P1" | "P2" | "P3";
export type IdentityConfidence = "High" | "Medium" | "Low" | "Ambiguous";

export type EmployerResearchRow = Readonly<{
  rank: number;
  priorityTier: PriorityTier;
  crawlerWave: string | null;
  canonicalEmployer: string;
  primarySponsorLegalEntity: string | null;
  townCity: string | null;
  identityConfidence: IdentityConfidence | null;
  identityMappingNote: string | null;
  employerValueScore: number | null;
  crawlerReadinessScore: number | null;
  crawlerPriorityScore: number | null;
  sponsorshipScore: number | null;
  earlyCareerScore: number | null;
  scaleScore: number | null;
  brandMarketScore: number | null;
  ukRelevanceScore: number | null;
  sectorScore: number | null;
  listingOwnershipScore: number | null;
  sourceLeverageScore: number | null;
  sector: string | null;
  subsector: string | null;
  financeAssetClass: string | null;
  employeeCount: number | null;
  employeeBand: string | null;
  employeeScope: string | null;
  employeeSource: string | null;
  employeeConfidence: string | null;
  ownership: string | null;
  ownershipConfidence: string | null;
  ticker: string | null;
  exchange: string | null;
  skilledWorkerSponsor: boolean | null;
  graduateTraineeRoute: boolean | null;
  seniorSpecialistRoute: boolean | null;
  sponsorRoutes: string | null;
  careerSearchUrl: string | null;
  atsPlatform: string | null;
  atsVerificationStatus: string | null;
  atsEvidenceNotes: string | null;
  sourceVerificationDate: string | null;
  currentJobsObserved: number | null;
  currentJobsScopeNote: string | null;
  recommendedDiscoveryStrategy: string | null;
  researchStatus: string | null;
  evidenceUrls: readonly string[];
  notes: string | null;
}>;

export type EmployerTargetsDataset = Readonly<{
  datasetVersion: string;
  researchDate: string;
  generatedAt: string;
  rows: readonly EmployerResearchRow[];
}>;

export type ResearchStatus =
  | "not_researched"
  | "verified_platform"
  | "verified_careers_url"
  | "needs_re_verification"
  | "blocked_review"
  | "verified_source";

export function normalizeResearchStatus(value: string | null): ResearchStatus {
  switch (value) {
    case "Verified platform":
      return "verified_platform";
    case "Verified careers URL":
      return "verified_careers_url";
    case "Needs re-verification":
      return "needs_re_verification";
    case "Blocked / review":
      return "blocked_review";
    case "Verified source":
      return "verified_source";
    default:
      return "not_researched";
  }
}

export function parsePriorityTier(value: string | null): PriorityTier | null {
  if (!value) return null;
  const upper = value.toUpperCase();
  if (upper.includes("P0")) return "P0";
  if (upper.includes("P1")) return "P1";
  if (upper.includes("P2")) return "P2";
  if (upper.includes("P3")) return "P3";
  return null;
}

export function parseYesNo(value: string | null): boolean | null {
  if (value === null || value === undefined || value === "") return null;
  return value.trim().toLowerCase() === "yes";
}

export function splitEvidenceUrls(value: string | null): readonly string[] {
  if (!value) return [];
  return value
    .split(/[|\n;]/u)
    .map((entry) => entry.trim())
    .filter((entry) => /^https?:\/\//u.test(entry));
}

export function normalizeOptionalText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length === 0 ? null : text;
}

export function normalizeOptionalUrl(value: unknown): string | null {
  const text = normalizeOptionalText(value);
  if (!text) return null;
  try {
    return new URL(text).toString();
  } catch {
    return null;
  }
}

export function normalizeOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/[^0-9.-]/gu, "");
  if (cleaned.length === 0 || cleaned === "-" || cleaned === ".") return null;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

export function normalizeBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  const text = String(value).trim().toLowerCase();
  if (text === "yes" || text === "true" || text === "1") return true;
  if (text === "no" || text === "false" || text === "0") return false;
  return null;
}
