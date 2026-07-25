import "server-only";
import { withApplicationUser } from "../../../infrastructure/database/runtime-connections";
import { parseReport } from "../domain/report";
import * as repository from "../infrastructure/report-repository";

export const readIntelligenceReports = (owner: string) =>
  withApplicationUser(owner, (database) => repository.listReports(database, owner));
export const readIntelligenceReportsForAdmin = (administrator: string) =>
  withApplicationUser(administrator, (database) =>
    repository.listReportsForAdmin(database, administrator),
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
