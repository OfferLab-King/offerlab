import { withApplicationUser } from "../../../infrastructure/database/runtime-connections";
import {
  filterEmployerResearchRows,
  type EmployerResearchFilters,
  type EmployerResearchViewRow,
} from "./employer-research-view";
import {
  listAliasTextByCompany,
  listEmployerResearchRows,
  findEmployerDetail,
  readSourceCapabilityStats,
  type EmployerDetailRow,
  type ResearchViewRow,
  type SourceCapabilityStats,
} from "../infrastructure/research-repository";
import {
  applyCandidatePromotions,
  computePlatformCoverage,
  planCandidatePromotion,
  type PlatformCoverageRow,
} from "./source-discovery";
import {
  listDiscoveryCandidates,
  readPlatformCoverageData,
  type DiscoveryCandidate,
} from "../infrastructure/discovery-repository";
import type { DiscoveryQueueFilters } from "./source-discovery-view";

export type EmployerResearchSummary = Readonly<{
  total: number;
  p0: number;
  p1: number;
  p2: number;
  p3: number;
  unresolved: number;
  withLiveSource: number;
  withJobs: number;
  sponsors: number;
}>;

export type EmployerResearchFacets = Readonly<{
  sectors: readonly string[];
  employeeBands: readonly string[];
  ownerships: readonly string[];
}>;

export async function readEmployerResearch(
  administratorUserId: string,
  filters: EmployerResearchFilters,
): Promise<{
  rows: readonly EmployerResearchViewRow[];
  summary: EmployerResearchSummary;
  facets: EmployerResearchFacets;
}> {
  return withApplicationUser(administratorUserId, async (database) => {
    const [rawRows, aliases] = await Promise.all([
      listEmployerResearchRows(database),
      listAliasTextByCompany(database),
    ]);
    const aliasesByCompany = new Map<string, string[]>();
    for (const alias of aliases) {
      const existing = aliasesByCompany.get(alias.companyId) ?? [];
      existing.push(alias.alias);
      aliasesByCompany.set(alias.companyId, existing);
    }
    const rows: EmployerResearchViewRow[] = rawRows.map((row: ResearchViewRow) => ({
      ...row,
      tier: row.tier as EmployerResearchViewRow["tier"],
      aliases: row.companyId ? (aliasesByCompany.get(row.companyId) ?? []) : [],
    }));
    const filtered = filterEmployerResearchRows(rows, filters);
    const distinct = (values: (string | null)[]): string[] =>
      [...new Set(values.filter((value): value is string => value !== null))].sort((a, b) =>
        a.localeCompare(b),
      );
    const summary: EmployerResearchSummary = {
      total: rows.length,
      p0: rows.filter((row) => row.tier === "P0").length,
      p1: rows.filter((row) => row.tier === "P1").length,
      p2: rows.filter((row) => row.tier === "P2").length,
      p3: rows.filter((row) => row.tier === "P3").length,
      unresolved: rows.filter((row) => row.companyId === null).length,
      withLiveSource: rows.filter((row) => row.liveSources > 0).length,
      withJobs: rows.filter((row) => row.currentJobs > 0).length,
      sponsors: rows.reduce((sum, row) => sum + row.sponsorEntities, 0),
    };
    const facets: EmployerResearchFacets = {
      sectors: distinct(rows.map((row) => row.sector)),
      employeeBands: distinct(rows.map((row) => row.employeeBand)),
      ownerships: distinct(rows.map((row) => row.ownership)),
    };
    return { rows: filtered, summary, facets };
  });
}

export async function readSourceDiscovery(
  administratorUserId: string,
  filters: DiscoveryQueueFilters,
): Promise<{
  coverage: readonly PlatformCoverageRow[];
  queue: readonly DiscoveryCandidate[];
  totals: Readonly<Record<string, number>>;
  stats: SourceCapabilityStats;
}> {
  return withApplicationUser(administratorUserId, async (database) => {
    const [coverageData, queue, stats] = await Promise.all([
      readPlatformCoverageData(database),
      listDiscoveryCandidates(database, {
        candidateId: null,
        companySlug: null,
        tier: filters.tier,
        platform: filters.platform,
        status: filters.status,
        search: filters.search,
        limit: 500,
      }),
      readSourceCapabilityStats(database),
    ]);
    const coverage = computePlatformCoverage(coverageData);
    return { coverage: coverage.rows, queue, totals: coverage.totals, stats };
  });
}

export async function promoteCandidateForAdmin(
  administratorUserId: string,
  candidateId: string,
): Promise<{
  outcome: "created" | "activated" | "already_present" | "not_promotable" | "not_found";
}> {
  return withApplicationUser(administratorUserId, async (database) => {
    const candidates = await listDiscoveryCandidates(database, {
      candidateId,
      companySlug: null,
      tier: null,
      platform: null,
      status: null,
      search: null,
      limit: 1,
    });
    const candidate = candidates[0];
    if (!candidate) return { outcome: "not_found" };
    const plan = planCandidatePromotion(candidate);
    if (!plan.promotable) return { outcome: "not_promotable" };
    const applied = await applyCandidatePromotions(database, [plan], true);
    if (applied.created === 1) return { outcome: "created" };
    if (applied.activated === 1) return { outcome: "activated" };
    if (applied.alreadyPresent === 1) return { outcome: "already_present" };
    return { outcome: "not_promotable" };
  });
}

export async function readEmployerDetailForAdmin(
  administratorUserId: string,
  companyId: string,
): Promise<EmployerDetailRow | null> {
  return withApplicationUser(administratorUserId, (database) =>
    findEmployerDetail(database, companyId),
  );
}

export async function readSourceCapabilityStatsForAdmin(
  administratorUserId: string,
): Promise<SourceCapabilityStats> {
  return withApplicationUser(administratorUserId, (database) =>
    readSourceCapabilityStats(database),
  );
}
