export type SyntheticCatalogTarget = Readonly<{
  id: string;
  expectedName: string;
  expectedSlug: string;
}>;

export type SyntheticCatalogPreserve = Readonly<{
  id: string;
  reason: string;
}>;

export type CompanyInventoryRow = Readonly<{
  id: string;
  name: string;
  slug: string;
  careersUrl: string;
  directoryVisible: boolean;
  sources: number;
  jobs: number;
  runs: number;
  events: number;
  savedJobs: number;
}>;

export type CleanupPlan = Readonly<{
  matched: readonly CompanyInventoryRow[];
  blockedBySavedJobs: readonly CompanyInventoryRow[];
  mismatched: readonly {
    expectedName: string;
    expectedSlug: string;
    actualName: string;
    actualSlug: string;
  }[];
  missing: readonly SyntheticCatalogTarget[];
  preserved: readonly CompanyInventoryRow[];
  unexpected: readonly CompanyInventoryRow[];
}>;

export type CleanupOptions = Readonly<{ apply: boolean; confirmed: boolean }>;

export function parseCleanupOptions(argv: readonly string[]): CleanupOptions {
  const confirmed = argv.includes("--confirm-local");
  const apply = argv.includes("--apply");
  if (apply && !confirmed) {
    throw new Error("Refusing to write: --apply requires --confirm-local.");
  }
  return { apply, confirmed };
}

export function isLoopbackDatabaseUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return (
      hostname === "127.0.0.1" ||
      hostname === "localhost" ||
      hostname === "::1" ||
      hostname === "[::1]"
    );
  } catch {
    return false;
  }
}

export function buildCleanupPlan(
  targets: readonly SyntheticCatalogTarget[],
  preserve: readonly SyntheticCatalogPreserve[],
  rows: readonly CompanyInventoryRow[],
): CleanupPlan {
  const preserveIds = new Set(preserve.map((item) => item.id));
  const targetIds = new Set(targets.map((item) => item.id));
  const rowsById = new Map(rows.map((item) => [item.id, item]));

  const matched: CompanyInventoryRow[] = [];
  const blockedBySavedJobs: CompanyInventoryRow[] = [];
  const mismatched: Array<CleanupPlan["mismatched"][number]> = [];
  const missing: SyntheticCatalogTarget[] = [];
  const preserved: CompanyInventoryRow[] = [];
  const unexpected: CompanyInventoryRow[] = [];

  for (const target of targets) {
    const row = rowsById.get(target.id);
    if (!row) {
      missing.push(target);
      continue;
    }
    if (row.name !== target.expectedName || row.slug !== target.expectedSlug) {
      mismatched.push({
        expectedName: target.expectedName,
        expectedSlug: target.expectedSlug,
        actualName: row.name,
        actualSlug: row.slug,
      });
      continue;
    }
    if (row.savedJobs > 0) {
      blockedBySavedJobs.push(row);
      continue;
    }
    matched.push(row);
  }

  for (const row of rows) {
    if (preserveIds.has(row.id)) {
      preserved.push(row);
      continue;
    }
    if (!targetIds.has(row.id)) {
      unexpected.push(row);
    }
  }

  return { blockedBySavedJobs, matched, mismatched, missing, preserved, unexpected };
}

/**
 * Reviewed deletion order for synthetic catalogue fixtures, child tables
 * first. app.job_location cascades with its job; every other relationship is
 * RESTRICT and is removed explicitly. No cascade reaches member-owned data.
 */
export const catalogueDeleteOrder = [
  "app.job_ingestion_run",
  "app.job_source_event",
  "app.job",
  "app.job_source",
  "app.company",
] as const;

export function assertCatalogueDeleteScope(tables: readonly string[]): void {
  for (const table of tables) {
    if (!(catalogueDeleteOrder as readonly string[]).includes(table)) {
      throw new Error(`Refusing to delete from ${table}: outside the reviewed catalogue scope.`);
    }
  }
}
