import type { TransactionSql } from "postgres";
import { curatedAliases } from "../domain/identity-match";
import type { EmployerResearchRow } from "../domain/research-row";
import {
  buildEmployerImportPlan,
  existingSnapshotKey,
  existingSponsorKey,
  planTotals,
  type ImportPlan,
} from "./import-plan";
import {
  createResearchEmployer,
  fillCompanyWebsite,
  readResearchImportState,
  upsertEmployerAlias,
  upsertResearchSnapshot,
  upsertSourceCandidate,
  upsertSponsorEntity,
} from "../infrastructure/research-repository";

export type ImportReport = Readonly<{
  plan: ImportPlan;
  applied: Readonly<Record<string, number>>;
  appliedCompanyIds: readonly string[];
  liveSourcesPreserved: number;
  warnings: readonly string[];
}>;

export type ReviewCandidateInput = Readonly<{
  companyId: string;
  channel: "general" | "early_careers";
  url: string;
  confidence: string | null;
  notes: string | null;
}>;

/**
 * Idempotent candidate insertion for URLs accepted from an external URL
 * validation review. Candidates are never verified and never activated:
 * they stay `candidate_found` until the discovery pipeline verifies them and
 * an administrator promotes them to a paused source.
 */
export async function importReviewCandidates(
  database: TransactionSql,
  inputs: readonly ReviewCandidateInput[],
): Promise<Readonly<{ inserted: number; skippedExisting: number }>> {
  let inserted = 0;
  let skippedExisting = 0;
  for (const input of inputs) {
    const existing = await database<{ id: string }[]>`
      select id from app.job_source_candidate
      where company_id = ${input.companyId}::uuid and candidate_url = ${input.url}
    `;
    if (existing.length > 0) {
      skippedExisting += 1;
      continue;
    }
    await database`
      insert into app.job_source_candidate (
        company_id, channel, candidate_url, discovery_method, status,
        confidence, evidence, notes
      ) values (
        ${input.companyId}::uuid, ${input.channel}, ${input.url},
        'external_url_review', 'candidate_found',
        ${input.confidence ?? null}, ${input.notes ?? null},
        'External URL validation review'
      )
    `;
    inserted += 1;
  }
  return { inserted, skippedExisting };
}

const SOURCE_REFERENCE =
  "Home Office register of licensed sponsors (2026-08-12) via Top 1,000 enhanced research workbook";

export async function runEmployerTargetsImport(
  database: TransactionSql,
  rows: readonly EmployerResearchRow[],
  options: Readonly<{ datasetVersion: string; researchDate: string; apply: boolean }>,
): Promise<ImportReport> {
  const state = await readResearchImportState(
    database,
    options.datasetVersion,
    options.researchDate,
  );
  const plan = buildEmployerImportPlan(rows, state, options.datasetVersion, options.researchDate);

  const applied: Record<string, number> = {};
  const appliedCompanyIds: string[] = [];
  const warnings: string[] = [];

  if (!options.apply) {
    return {
      plan,
      applied,
      appliedCompanyIds,
      liveSourcesPreserved: state.liveSourceCompanyIds.size,
      warnings,
    };
  }

  const companyIdByRank = new Map<number, string>();
  for (const created of plan.newEmployers) {
    const row = rows.find((candidate) => candidate.rank === created.rank)!;
    const id = await createResearchEmployer(database, {
      canonicalEmployer: created.canonicalEmployer,
      slug: created.proposedSlug!,
      websiteUrl: created.proposedWebsiteUrl,
      careerSearchUrl: row.careerSearchUrl,
    });
    companyIdByRank.set(created.rank, id);
    appliedCompanyIds.push(id);
  }
  applied["newEmployers"] = plan.newEmployers.length;

  for (const updated of plan.updatedEmployers) {
    if (updated.match.companyId && updated.proposedWebsiteUrl) {
      await fillCompanyWebsite(database, updated.match.companyId, updated.proposedWebsiteUrl);
      appliedCompanyIds.push(updated.match.companyId);
    }
  }
  applied["updatedEmployers"] = plan.updatedEmployers.length;

  // Aliases: canonical name variants, sponsor legal entities and curated aliases.
  let aliasCount = 0;
  for (const row of rows) {
    const companyId = plan.ambiguousIdentities.some((planRow) => planRow.rank === row.rank)
      ? null
      : (companyIdByRank.get(row.rank) ??
        (plan.matchedEmployers.some((planRow) => planRow.rank === row.rank) ||
        plan.updatedEmployers.some((planRow) => planRow.rank === row.rank) ||
        plan.unchangedEmployers.some((planRow) => planRow.rank === row.rank)
          ? findCompanyId(plan, row.rank)
          : null));
    if (!companyId) continue;
    const aliasSource = "employer-targets-2026-08-12";
    const candidates: Array<{ alias: string; aliasType: string }> = [
      { alias: row.canonicalEmployer.trim(), aliasType: "canonical_name_variant" },
      ...(row.primarySponsorLegalEntity
        ? [{ alias: row.primarySponsorLegalEntity.trim(), aliasType: "sponsor_legal" as const }]
        : []),
      ...(curatedAliases[row.canonicalEmployer] ?? []).map((alias) => ({
        alias,
        aliasType: "trading_name" as const,
      })),
    ];
    for (const candidate of candidates) {
      const outcome = await upsertEmployerAlias(database, {
        companyId,
        alias: candidate.alias,
        aliasType: candidate.aliasType,
        source: aliasSource,
      });
      if (outcome === "inserted") aliasCount += 1;
    }
  }
  applied["aliases"] = aliasCount;

  // Sponsor legal entities.
  let sponsorsInserted = 0;
  let sponsorsUpdated = 0;
  const sponsorKeys = new Set<string>();
  for (const row of rows) {
    if (!row.primarySponsorLegalEntity) continue;
    const key = existingSponsorKey(row.primarySponsorLegalEntity, options.researchDate);
    if (sponsorKeys.has(key)) continue;
    sponsorKeys.add(key);
    const companyId = companyIdByRank.get(row.rank) ?? findCompanyId(plan, row.rank);
    const outcome = await upsertSponsorEntity(database, {
      companyId,
      legalName: row.primarySponsorLegalEntity,
      townCity: row.townCity,
      routes: sponsorRoutes(row),
      snapshotDate: options.researchDate,
      identityConfidence: row.identityConfidence,
      identityNotes: row.identityMappingNote,
      sourceReference: SOURCE_REFERENCE,
    });
    if (outcome === "inserted") sponsorsInserted += 1;
    if (outcome === "updated") sponsorsUpdated += 1;
  }
  applied["sponsorsAdded"] = sponsorsInserted;
  applied["sponsorsChanged"] = sponsorsUpdated;

  // Research snapshots.
  let snapshotsInserted = 0;
  let snapshotsUpdated = 0;
  for (const row of rows) {
    const companyId = companyIdByRank.get(row.rank) ?? findCompanyId(plan, row.rank);
    const outcome = await upsertResearchSnapshot(database, {
      companyId,
      row,
      datasetVersion: options.datasetVersion,
      researchDate: options.researchDate,
    });
    if (outcome === "inserted") snapshotsInserted += 1;
    if (outcome === "updated") snapshotsUpdated += 1;
  }
  applied["snapshotsAdded"] = snapshotsInserted;
  applied["snapshotsChanged"] = snapshotsUpdated;

  // Source candidates (never activated).
  let candidatesInserted = 0;
  for (const row of rows) {
    if (!row.careerSearchUrl) continue;
    const companyId = companyIdByRank.get(row.rank) ?? findCompanyId(plan, row.rank);
    const outcome = await upsertSourceCandidate(database, { companyId, row });
    if (outcome === "inserted") candidatesInserted += 1;
  }
  applied["candidatesAdded"] = candidatesInserted;

  if (plan.rejectedRows.length > 0) {
    warnings.push(
      `${plan.rejectedRows.length} rows rejected (${plan.rejectedRows
        .map((row) => row.canonicalEmployer)
        .join(", ")
        .slice(0, 300)})`,
    );
  }

  return {
    plan,
    applied,
    appliedCompanyIds,
    liveSourcesPreserved: state.liveSourceCompanyIds.size,
    warnings,
  };
}

function findCompanyId(plan: ImportPlan, rank: number): string | null {
  for (const group of [plan.matchedEmployers, plan.updatedEmployers, plan.unchangedEmployers]) {
    const match = group.find((row) => row.rank === rank);
    if (match?.match.companyId) return match.match.companyId;
  }
  return null;
}

function sponsorRoutes(row: EmployerResearchRow): readonly string[] {
  if (row.sponsorRoutes) {
    return row.sponsorRoutes
      .split(";")
      .map((route) => route.trim())
      .filter(Boolean);
  }
  const routes: string[] = [];
  if (row.skilledWorkerSponsor) routes.push("Skilled Worker");
  if (row.graduateTraineeRoute) routes.push("Global Business Mobility: Graduate Trainee");
  if (row.seniorSpecialistRoute)
    routes.push("Global Business Mobility: Senior or Specialist Worker");
  return routes;
}

export function formatImportReport(report: ImportReport): string {
  const totals = planTotals(report.plan);
  const lines = [
    `\n== Employer targets import report ==`,
    `dataset: ${report.plan.datasetVersion} (research date ${report.plan.researchDate})`,
    `dry run: ${report.applied.newEmployers === undefined ? "yes" : "no (applied)"}`,
    "",
    `new employers:               ${totals.newEmployers}`,
    `matched employers:           ${totals.matchedEmployers}`,
    `updated employers:           ${totals.updatedEmployers}`,
    `unchanged employers:         ${totals.unchangedEmployers}`,
    `ambiguous identities:        ${totals.ambiguousIdentities}`,
    `sponsor entities added:      ${totals.sponsorsAdded}`,
    `sponsor entities changed:    ${totals.sponsorsChanged}`,
    `sponsor entities unchanged:  ${totals.sponsorsUnchanged}`,
    `research snapshots added:    ${totals.snapshotsAdded}`,
    `research snapshots changed:  ${totals.snapshotsChanged}`,
    `research snapshots unchanged:${totals.snapshotsUnchanged}`,
    `source candidates added:     ${totals.candidatesAdded}`,
    `source candidates unchanged: ${totals.candidatesUnchanged}`,
    `rejected rows:               ${totals.rejectedRows}`,
    `live sources preserved:      ${report.liveSourcesPreserved}`,
    "",
    `applied (confirm mode): ${JSON.stringify(report.applied)}`,
  ];
  if (report.warnings.length > 0) {
    lines.push("", "warnings:");
    for (const warning of report.warnings) lines.push(`  - ${warning}`);
  }
  return lines.join("\n");
}

export { existingSnapshotKey };
