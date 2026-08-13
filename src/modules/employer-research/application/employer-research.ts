import { withApplicationUser } from "../../../infrastructure/database/runtime-connections";
import {
  filterEmployerResearchRows,
  type EmployerResearchFilters,
  type EmployerResearchViewRow,
} from "./employer-research-view";
import {
  listAliasTextByCompany,
  listEmployerResearchRows,
  type ResearchViewRow,
} from "../infrastructure/research-repository";

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
