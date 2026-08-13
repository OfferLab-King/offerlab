import {
  normalizeOptionalNumber,
  normalizeOptionalText,
  normalizeOptionalUrl,
  normalizeResearchStatus,
  parsePriorityTier,
  parseYesNo,
  splitEvidenceUrls,
  type EmployerResearchRow,
} from "./research-row";

export type RowValidationIssue = Readonly<{
  rank: number | null;
  field: string;
  message: string;
  severity: "error" | "warning";
}>;

export type RowParseResult = Readonly<{
  rows: readonly EmployerResearchRow[];
  issues: readonly RowValidationIssue[];
}>;

const SCORE_FIELDS = [
  "Employer Value Score",
  "Crawler Readiness Score",
  "Crawler Priority Score",
  "Sponsorship Score",
  "Early-Career Score",
  "Scale Score",
  "Brand/Market Score",
  "UK Relevance Score",
  "Sector Score",
  "Listing/Ownership Score",
  "Source Leverage Score",
] as const;

function scoreValue(record: Readonly<Record<string, unknown>>, field: string): number | null {
  const raw = record[field];
  if (raw === null || raw === undefined || raw === "") return null;
  const number = Number(raw);
  if (!Number.isFinite(number)) return null;
  return Math.round(number * 100) / 100;
}

export function parseWorkbookRow(record: Readonly<Record<string, unknown>>): EmployerResearchRow {
  const rank = normalizeOptionalNumber(record["Rank"]);
  const canonicalEmployer = normalizeOptionalText(record["Canonical Employer"]) ?? "";
  const sector = normalizeOptionalText(record["Sector"]);
  const subsector = normalizeOptionalText(record["Subsector"]);
  const employeeCount = normalizeOptionalNumber(record["Employee Count"]);
  const currentJobsObserved = normalizeOptionalNumber(record["Current Jobs Observed"]);

  return {
    rank: rank ?? 0,
    priorityTier: parsePriorityTier(normalizeOptionalText(record["Priority Tier"])) ?? "P3",
    crawlerWave: normalizeOptionalText(record["Crawler Wave"]),
    canonicalEmployer,
    primarySponsorLegalEntity: normalizeOptionalText(record["Primary Sponsor Legal Entity"]),
    townCity: normalizeOptionalText(record["Town/City"]),
    identityConfidence:
      (normalizeOptionalText(
        record["Identity Confidence"],
      ) as EmployerResearchRow["identityConfidence"]) ?? null,
    identityMappingNote: normalizeOptionalText(record["Identity Mapping Note"]),
    employerValueScore: scoreValue(record, "Employer Value Score"),
    crawlerReadinessScore: scoreValue(record, "Crawler Readiness Score"),
    crawlerPriorityScore: scoreValue(record, "Crawler Priority Score"),
    sponsorshipScore: scoreValue(record, "Sponsorship Score"),
    earlyCareerScore: scoreValue(record, "Early-Career Score"),
    scaleScore: scoreValue(record, "Scale Score"),
    brandMarketScore: scoreValue(record, "Brand/Market Score"),
    ukRelevanceScore: scoreValue(record, "UK Relevance Score"),
    sectorScore: scoreValue(record, "Sector Score"),
    listingOwnershipScore: scoreValue(record, "Listing/Ownership Score"),
    sourceLeverageScore: scoreValue(record, "Source Leverage Score"),
    sector,
    subsector,
    financeAssetClass: normalizeOptionalText(record["Finance Asset Class"]),
    employeeCount: employeeCount !== null && employeeCount > 0 ? Math.round(employeeCount) : null,
    employeeBand: normalizeOptionalText(record["Employee Band"]),
    employeeScope: normalizeOptionalText(record["Employee Scope"]),
    employeeSource: normalizeOptionalText(record["Employee Source"]),
    employeeConfidence: normalizeOptionalText(record["Employee Confidence"]),
    ownership: normalizeOptionalText(record["Ownership / Listing"]),
    ownershipConfidence: normalizeOptionalText(record["Ownership Confidence"]),
    ticker: normalizeOptionalText(record["Ticker"]),
    exchange: normalizeOptionalText(record["Exchange"]),
    skilledWorkerSponsor: parseYesNo(normalizeOptionalText(record["Skilled Worker Sponsor"])),
    graduateTraineeRoute: parseYesNo(normalizeOptionalText(record["Graduate Trainee Route"])),
    seniorSpecialistRoute: parseYesNo(normalizeOptionalText(record["Senior/Specialist Route"])),
    sponsorRoutes: normalizeOptionalText(record["Sponsor Routes"]),
    careerSearchUrl: normalizeOptionalUrl(record["Career Search URL"]),
    atsPlatform: normalizeOptionalText(record["ATS / Platform"]),
    atsVerificationStatus: normalizeOptionalText(record["ATS Verification Status"]),
    atsEvidenceNotes: normalizeOptionalText(record["ATS Evidence / Notes"]),
    sourceVerificationDate: normalizeOptionalText(record["Source Verification Date"]),
    currentJobsObserved:
      currentJobsObserved !== null && currentJobsObserved > 0
        ? Math.round(currentJobsObserved)
        : null,
    currentJobsScopeNote: normalizeOptionalText(record["Current Jobs Scope / Note"]),
    recommendedDiscoveryStrategy: normalizeOptionalText(record["Recommended Discovery Strategy"]),
    researchStatus: normalizeResearchStatus(normalizeOptionalText(record["Research Status"])),
    evidenceUrls: splitEvidenceUrls(normalizeOptionalText(record["Evidence URLs"])),
    notes: normalizeOptionalText(record["Notes"]),
  };
}

export function validateParsedRows(
  rows: readonly EmployerResearchRow[],
): readonly RowValidationIssue[] {
  const issues: RowValidationIssue[] = [];
  const seenRanks = new Set<number>();
  const seenEmployers = new Set<string>();

  for (const row of rows) {
    if (row.rank < 1) {
      issues.push({
        rank: row.rank || null,
        field: "Rank",
        message: "Rank must be positive",
        severity: "error",
      });
    }
    if (seenRanks.has(row.rank)) {
      issues.push({
        rank: row.rank,
        field: "Rank",
        message: `Duplicate rank ${row.rank}`,
        severity: "error",
      });
    }
    seenRanks.add(row.rank);
    if (row.canonicalEmployer.length === 0) {
      issues.push({
        rank: row.rank,
        field: "Canonical Employer",
        message: "Canonical employer name is required",
        severity: "error",
      });
    }
    const normalizedEmployer = row.canonicalEmployer.toLowerCase();
    if (seenEmployers.has(normalizedEmployer)) {
      issues.push({
        rank: row.rank,
        field: "Canonical Employer",
        message: `Duplicate canonical employer ${row.canonicalEmployer}`,
        severity: "error",
      });
    }
    seenEmployers.add(normalizedEmployer);
    if (!row.priorityTier) {
      issues.push({
        rank: row.rank,
        field: "Priority Tier",
        message: "Priority tier is required",
        severity: "error",
      });
    }
    if (
      row.identityConfidence &&
      !["High", "Medium", "Low", "Ambiguous"].includes(row.identityConfidence)
    ) {
      issues.push({
        rank: row.rank,
        field: "Identity Confidence",
        message: `Unrecognised confidence ${row.identityConfidence}`,
        severity: "warning",
      });
    }
    if (row.careerSearchUrl) {
      try {
        const url = new URL(row.careerSearchUrl);
        if (url.protocol !== "https:" && url.protocol !== "http:") {
          issues.push({
            rank: row.rank,
            field: "Career Search URL",
            message: "Career search URL must be http(s)",
            severity: "error",
          });
        }
      } catch {
        issues.push({
          rank: row.rank,
          field: "Career Search URL",
          message: "Career search URL is not a valid URL",
          severity: "error",
        });
      }
    }
    for (const field of SCORE_FIELDS) {
      const value = scoreValue(row as unknown as Readonly<Record<string, unknown>>, field);
      if (value !== null && (value < 0 || value > 100)) {
        issues.push({
          rank: row.rank,
          field,
          message: `${field} must be between 0 and 100`,
          severity: "warning",
        });
      }
    }
  }

  const sorted = [...rows].sort((a, b) => a.rank - b.rank);
  if (sorted.length > 0 && sorted[0]!.rank !== 1) {
    issues.push({
      rank: null,
      field: "Rank",
      message: "Ranks should start at 1",
      severity: "warning",
    });
  }
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index]!.rank !== sorted[index - 1]!.rank + 1) {
      issues.push({
        rank: sorted[index]!.rank,
        field: "Rank",
        message: "Ranks should be contiguous",
        severity: "warning",
      });
      break;
    }
  }

  return issues;
}

export type ValidationOutcome = Readonly<{
  rows: readonly EmployerResearchRow[];
  issues: readonly RowValidationIssue[];
  errorCount: number;
  warningCount: number;
}>;

export function validateWorkbookRows(
  records: readonly Readonly<Record<string, unknown>>[],
): ValidationOutcome {
  const rows = records.map(parseWorkbookRow);
  const issues: RowValidationIssue[] = [...validateParsedRows(rows)];
  for (const record of records) {
    const rank = normalizeOptionalNumber(record["Rank"]);
    const rawUrl = normalizeOptionalText(record["Career Search URL"]);
    if (rawUrl && !normalizeOptionalUrl(record["Career Search URL"])) {
      issues.push({
        rank: rank ?? null,
        field: "Career Search URL",
        message: `Career Search URL ${rawUrl.slice(0, 120)} is not a valid http(s) URL`,
        severity: "error",
      });
    }
  }
  return {
    rows,
    issues,
    errorCount: issues.filter((issue) => issue.severity === "error").length,
    warningCount: issues.filter((issue) => issue.severity === "warning").length,
  };
}

export function sortByRank(rows: readonly EmployerResearchRow[]): EmployerResearchRow[] {
  return [...rows].sort(
    (a, b) => a.rank - b.rank || a.canonicalEmployer.localeCompare(b.canonicalEmployer),
  );
}
