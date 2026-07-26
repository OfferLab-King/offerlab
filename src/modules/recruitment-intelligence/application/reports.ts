import "server-only";
import { withApplicationUser } from "../../../infrastructure/database/runtime-connections";
import { withApplicationRole } from "../../../infrastructure/database/runtime-connections";
import { parseReport, type ReportFilters } from "../domain/report";
import * as repository from "../infrastructure/report-repository";

export const readIntelligenceReports = (owner: string, filters: ReportFilters) =>
  withApplicationUser(owner, (database) =>
    repository.listPublishedReports(database, owner, filters),
  );
export const readMyIntelligenceReports = (owner: string) =>
  withApplicationUser(owner, (database) => repository.listOwnerReports(database, owner));
export const readIntelligenceReport = (owner: string, slug: string) =>
  withApplicationUser(owner, (database) => repository.findReportBySlug(database, slug, owner));
export const readPublicIntelligenceReports = (filters: ReportFilters) =>
  withApplicationRole((database) => repository.listPublishedReports(database, null, filters));
export const readPublicIntelligenceReport = (slug: string) =>
  withApplicationRole((database) => repository.findReportBySlug(database, slug, null));
export const readIntelligenceReportsForAdmin = (administrator: string) =>
  withApplicationUser(administrator, (database) =>
    repository.listReportsForAdmin(database, administrator),
  );
export const readIntelligenceReportForAdmin = (administrator: string, id: string) =>
  withApplicationUser(administrator, (database) =>
    repository.findReportForAdmin(database, administrator, id),
  );

export async function submitIntelligenceReport(owner: string, input: unknown) {
  const parsed = parseReport(input);
  if (!parsed.ok) return parsed;
  return {
    item: await withApplicationUser(owner, (database) =>
      repository.createReport(database, owner, parsed.value),
    ),
    ok: true,
  } as const;
}

export async function createCoachCuratedReport(administrator: string, input: unknown) {
  const parsed = parseReport(input, "coach_curated");
  if (!parsed.ok) return parsed;
  return {
    item: await withApplicationUser(administrator, (database) =>
      repository.createReport(database, administrator, parsed.value),
    ),
    ok: true,
  } as const;
}

export async function updateIntelligenceReport(
  administrator: string,
  id: string,
  version: number,
  input: unknown,
) {
  const parsed = parseReport(input, "coach_curated");
  if (!parsed.ok) return parsed;
  return withApplicationUser(administrator, (database) =>
    repository.updateReportContent(database, administrator, id, version, parsed.value),
  );
}

export const reviewIntelligenceReport = (
  administrator: string,
  id: string,
  version: number,
  state: "published" | "rejected",
  confidence: "low" | "medium" | "high",
) =>
  withApplicationUser(administrator, (database) =>
    repository.moderateReport(database, administrator, id, version, state, confidence),
  );
