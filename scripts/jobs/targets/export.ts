import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

import {
  EMPLOYER_TARGETS_DATASET_VERSION,
  EMPLOYER_TARGETS_RESEARCH_DATE,
} from "../../../src/modules/employer-research/domain/research-row";
import {
  sortByRank,
  validateWorkbookRows,
} from "../../../src/modules/employer-research/domain/workbook-parse";
import {
  GENERATED_TARGETS_DIR,
  GENERATED_TARGETS_JSON,
  GENERATED_TARGETS_MANIFEST,
  readTop1000Sheet,
} from "./workbook";

const records = readTop1000Sheet();
const outcome = validateWorkbookRows(records);
if (outcome.errorCount > 0) {
  process.stderr.write(`Refusing to export: ${outcome.errorCount} validation errors.\n`);
  for (const issue of outcome.issues.filter((entry) => entry.severity === "error")) {
    process.stderr.write(`  rank=${issue.rank ?? "-"} ${issue.field}: ${issue.message}\n`);
  }
  process.exit(1);
}

const rows = sortByRank(outcome.rows);
const generatedAt = new Date().toISOString();
const payload = {
  datasetVersion: EMPLOYER_TARGETS_DATASET_VERSION,
  researchDate: EMPLOYER_TARGETS_RESEARCH_DATE,
  generatedAt,
  rows,
};

mkdirSync(GENERATED_TARGETS_DIR, { recursive: true });
writeFileSync(GENERATED_TARGETS_JSON, `${JSON.stringify(payload, null, 2)}\n`);
const checksum = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
writeFileSync(
  GENERATED_TARGETS_MANIFEST,
  `${JSON.stringify(
    {
      datasetVersion: EMPLOYER_TARGETS_DATASET_VERSION,
      researchDate: EMPLOYER_TARGETS_RESEARCH_DATE,
      generatedAt,
      rowCount: rows.length,
      sourceWorkbook:
        "data/research/employer-targets/offerlab_target_employers_top_1000_enhanced.xlsx",
      sourceSheet: "Top 1000 v2",
      sha256: checksum,
      validation: { errors: outcome.errorCount, warnings: outcome.warningCount },
    },
    null,
    2,
  )}\n`,
);
process.stdout.write(
  `Exported ${rows.length} rows to ${GENERATED_TARGETS_JSON}\nmanifest: ${GENERATED_TARGETS_MANIFEST} sha256=${checksum.slice(0, 16)}...\n`,
);
