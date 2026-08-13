import postgres from "postgres";

import {
  formatTaxonomyBackfillReport,
  runTaxonomyBackfill,
} from "../../src/modules/taxonomy/application/taxonomy-backfill";
import { isLocalDatabaseUrl } from "../learn-demo-content";
import { loadLocalEnvironment } from "../shared/load-local-environment";

loadLocalEnvironment();

const dryRun = !process.argv.includes("--confirm");
const databaseUrl = process.env.DATABASE_MIGRATION_URL;
if (!databaseUrl) throw new Error("Refusing to backfill: DATABASE_MIGRATION_URL is required.");
if (!isLocalDatabaseUrl(databaseUrl)) {
  throw new Error(
    "Refusing to backfill: DATABASE_MIGRATION_URL must use an approved local database host.",
  );
}

const database = postgres(databaseUrl, { max: 2, prepare: false });

try {
  const report = await database.begin((transaction) => runTaxonomyBackfill(transaction, !dryRun));
  process.stdout.write(formatTaxonomyBackfillReport(report));
} finally {
  await database.end();
}
