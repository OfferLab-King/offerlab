import {
  matchCanonicalEmployer,
  uniqueSlug,
  type ExistingAliasIdentity,
  type ExistingCompanyIdentity,
  type IdentityMatch,
} from "../domain/identity-match";
import type { EmployerResearchRow } from "../domain/research-row";

export type ResearchEmployerPlan = Readonly<{
  rank: number;
  canonicalEmployer: string;
  match: IdentityMatch;
  proposedSlug: string | null;
  proposedWebsiteUrl: string | null;
}>;

export type ImportPlan = Readonly<{
  datasetVersion: string;
  researchDate: string;
  newEmployers: readonly ResearchEmployerPlan[];
  matchedEmployers: readonly ResearchEmployerPlan[];
  updatedEmployers: readonly ResearchEmployerPlan[];
  unchangedEmployers: readonly ResearchEmployerPlan[];
  ambiguousIdentities: readonly ResearchEmployerPlan[];
  sponsorsAdded: readonly string[];
  sponsorsChanged: readonly string[];
  sponsorsUnchanged: readonly string[];
  snapshotsAdded: readonly number[];
  snapshotsChanged: readonly number[];
  snapshotsUnchanged: readonly number[];
  candidatesAdded: readonly { companyId: string | null; url: string }[];
  candidatesUnchanged: readonly string[];
  rejectedRows: readonly { rank: number; canonicalEmployer: string; reason: string }[];
}>;

export type EmployerImportState = Readonly<{
  companies: readonly ExistingCompanyIdentity[];
  aliases: readonly ExistingAliasIdentity[];
  existingSlugs: ReadonlySet<string>;
  existingSponsorKeys: ReadonlySet<string>;
  existingSnapshotKeys: ReadonlySet<string>;
  existingCandidateKeys: ReadonlySet<string>;
  liveSourceCompanyIds: ReadonlySet<string>;
}>;

export function existingSponsorKey(legalName: string, snapshotDate: string): string {
  return `${legalName.trim().toLowerCase()}@${snapshotDate}`;
}

export function existingSnapshotKey(
  datasetVersion: string,
  researchDate: string,
  rank: number,
): string {
  return `${datasetVersion}@${researchDate}@${rank}`;
}

export function existingCandidateKey(companyId: string | null, url: string): string {
  return `${companyId ?? "unresolved"}@${url}`;
}

function evidenceWebsiteUrl(row: EmployerResearchRow): string | null {
  return (
    row.evidenceUrls.find((url) => {
      try {
        const hostname = new URL(url).hostname.replace(/^www\./u, "").toLowerCase();
        return !/(gov\.uk|targetjobs|highfliers|linkedin|companiesmarketcap|glassdoor|indeed|times|dwps)/u.test(
          hostname,
        );
      } catch {
        return false;
      }
    }) ?? null
  );
}

function isResolvedConfidence(row: EmployerResearchRow): boolean {
  return row.identityConfidence === null || row.identityConfidence === "High";
}

export function buildEmployerImportPlan(
  rows: readonly EmployerResearchRow[],
  state: EmployerImportState,
  datasetVersion: string,
  researchDate: string,
): ImportPlan {
  const newEmployers: ResearchEmployerPlan[] = [];
  const matchedEmployers: ResearchEmployerPlan[] = [];
  const updatedEmployers: ResearchEmployerPlan[] = [];
  const unchangedEmployers: ResearchEmployerPlan[] = [];
  const ambiguousIdentities: ResearchEmployerPlan[] = [];
  const sponsorsAdded: string[] = [];
  const sponsorsChanged: string[] = [];
  const sponsorsUnchanged: string[] = [];
  const snapshotsAdded: number[] = [];
  const snapshotsChanged: number[] = [];
  const snapshotsUnchanged: number[] = [];
  const candidatesAdded: { companyId: string | null; url: string }[] = [];
  const candidatesUnchanged: string[] = [];
  const rejectedRows: { rank: number; canonicalEmployer: string; reason: string }[] = [];

  const usedSlugs = new Set(state.existingSlugs);
  const planByRank = new Map<number, ResearchEmployerPlan>();
  const seenSponsorKeys = new Set<string>();

  for (const row of rows) {
    if (row.rank < 1) {
      rejectedRows.push({
        rank: row.rank,
        canonicalEmployer: row.canonicalEmployer,
        reason: "invalid rank",
      });
      continue;
    }

    const websiteUrl = evidenceWebsiteUrl(row);
    const match = matchCanonicalEmployer({
      canonicalName: row.canonicalEmployer,
      existingCompanies: state.companies,
      existingAliases: state.aliases,
      evidenceWebsiteUrl: websiteUrl,
    });

    if (!match.companyId) {
      if (!isResolvedConfidence(row)) {
        const plan: ResearchEmployerPlan = {
          rank: row.rank,
          canonicalEmployer: row.canonicalEmployer,
          match,
          proposedSlug: null,
          proposedWebsiteUrl: websiteUrl,
        };
        ambiguousIdentities.push(plan);
        planByRank.set(row.rank, plan);
        continue;
      }
      const proposedSlug = uniqueSlug(row.canonicalEmployer, usedSlugs);
      usedSlugs.add(proposedSlug);
      const plan: ResearchEmployerPlan = {
        rank: row.rank,
        canonicalEmployer: row.canonicalEmployer,
        match,
        proposedSlug,
        proposedWebsiteUrl: websiteUrl,
      };
      newEmployers.push(plan);
      planByRank.set(row.rank, plan);
      continue;
    }

    if (!isResolvedConfidence(row)) {
      const plan: ResearchEmployerPlan = {
        rank: row.rank,
        canonicalEmployer: row.canonicalEmployer,
        match: {
          ...match,
          companyId: null,
          reason: `${match.reason}; workbook confidence ${row.identityConfidence} requires review`,
        },
        proposedSlug: null,
        proposedWebsiteUrl: websiteUrl,
      };
      ambiguousIdentities.push(plan);
      planByRank.set(row.rank, plan);
      continue;
    }

    const company = state.companies.find((candidate) => candidate.id === match.companyId)!;
    const websiteCanBeFilled = company.websiteUrl === null && websiteUrl !== null;
    const plan: ResearchEmployerPlan = {
      rank: row.rank,
      canonicalEmployer: row.canonicalEmployer,
      match,
      proposedSlug: null,
      proposedWebsiteUrl: websiteUrl,
    };
    matchedEmployers.push(plan);
    if (websiteCanBeFilled) updatedEmployers.push(plan);
    else unchangedEmployers.push(plan);
    planByRank.set(row.rank, plan);
  }

  // Sponsor legal entities: one row per (legal name, snapshot date). A legal
  // entity shared by multiple research rows maps to the first canonical link.
  const sponsorByRow = new Map<number, string>();
  for (const row of rows) {
    const legalName = row.primarySponsorLegalEntity?.trim();
    if (!legalName) continue;
    const key = existingSponsorKey(legalName, researchDate);
    if (seenSponsorKeys.has(key)) {
      rejectedRows.push({
        rank: row.rank,
        canonicalEmployer: row.canonicalEmployer,
        reason: `sponsor legal entity ${legalName} already mapped in this dataset`,
      });
      continue;
    }
    seenSponsorKeys.add(key);
    sponsorByRow.set(row.rank, legalName);
    if (state.existingSponsorKeys.has(key)) sponsorsUnchanged.push(legalName);
    else sponsorsAdded.push(legalName);
  }

  for (const row of rows) {
    const key = existingSnapshotKey(datasetVersion, researchDate, row.rank);
    if (state.existingSnapshotKeys.has(key)) snapshotsUnchanged.push(row.rank);
    else snapshotsAdded.push(row.rank);
  }

  for (const row of rows) {
    const companyId = planByRank.get(row.rank)?.match.companyId ?? null;
    if (!row.careerSearchUrl) continue;
    const key = existingCandidateKey(companyId, row.careerSearchUrl);
    if (state.existingCandidateKeys.has(key)) candidatesUnchanged.push(row.careerSearchUrl);
    else candidatesAdded.push({ companyId, url: row.careerSearchUrl });
  }

  return {
    datasetVersion,
    researchDate,
    newEmployers,
    matchedEmployers,
    updatedEmployers,
    unchangedEmployers,
    ambiguousIdentities,
    sponsorsAdded,
    sponsorsChanged,
    sponsorsUnchanged,
    snapshotsAdded,
    snapshotsChanged,
    snapshotsUnchanged,
    candidatesAdded,
    candidatesUnchanged,
    rejectedRows,
  };
}

export function planTotals(plan: ImportPlan): Readonly<Record<string, number>> {
  return {
    newEmployers: plan.newEmployers.length,
    matchedEmployers: plan.matchedEmployers.length,
    updatedEmployers: plan.updatedEmployers.length,
    unchangedEmployers: plan.unchangedEmployers.length,
    ambiguousIdentities: plan.ambiguousIdentities.length,
    sponsorsAdded: plan.sponsorsAdded.length,
    sponsorsChanged: plan.sponsorsChanged.length,
    sponsorsUnchanged: plan.sponsorsUnchanged.length,
    snapshotsAdded: plan.snapshotsAdded.length,
    snapshotsChanged: plan.snapshotsChanged.length,
    snapshotsUnchanged: plan.snapshotsUnchanged.length,
    candidatesAdded: plan.candidatesAdded.length,
    candidatesUnchanged: plan.candidatesUnchanged.length,
    rejectedRows: plan.rejectedRows.length,
    totalRows: [
      plan.newEmployers.length,
      plan.matchedEmployers.length,
      plan.ambiguousIdentities.length,
    ].reduce((sum, count) => sum + count, 0),
  };
}
