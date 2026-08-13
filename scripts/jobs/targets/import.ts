import { readFileSync } from "node:fs";

import postgres from "postgres";

import {
  formatImportReport,
  runEmployerTargetsImport,
} from "../../../src/modules/employer-research/application/import-targets";
import type { EmployerResearchRow } from "../../../src/modules/employer-research/domain/research-row";
import { isLocalDatabaseUrl } from "../../learn-demo-content";
import { loadLocalEnvironment } from "../../shared/load-local-environment";
import { GENERATED_TARGETS_JSON } from "./workbook";

loadLocalEnvironment();

const confirmed = process.argv.includes("--confirm");
const dryRun = !confirmed;
const databaseUrl = process.env.DATABASE_MIGRATION_URL;
if (!databaseUrl) throw new Error("Refusing to import: DATABASE_MIGRATION_URL is required.");
if (!isLocalDatabaseUrl(databaseUrl)) {
  throw new Error(
    "Refusing to import: DATABASE_MIGRATION_URL must use an approved local database host.",
  );
}

const payload = JSON.parse(readFileSync(GENERATED_TARGETS_JSON, "utf8")) as {
  datasetVersion: string;
  researchDate: string;
  rows: EmployerResearchRow[];
};
if (!Array.isArray(payload.rows)) {
  throw new Error(`${GENERATED_TARGETS_JSON} is malformed: missing rows array`);
}

const database = postgres(databaseUrl, { max: 2, prepare: false });
try {
  const report = await database.begin((transaction) =>
    runEmployerTargetsImport(transaction, payload.rows, {
      datasetVersion: payload.datasetVersion,
      researchDate: payload.researchDate,
      apply: confirmed,
    }),
  );
  process.stdout.write(formatImportReport(report));
  process.stdout.write("\n");
  if (dryRun) {
    process.stdout.write("Dry run - no writes. Re-run with --confirm to apply.\n");
  }
} finally {
  await database.end();
}
