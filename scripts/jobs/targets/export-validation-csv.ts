import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import type { EmployerResearchRow } from "../../../src/modules/employer-research/domain/research-row";
import { GENERATED_TARGETS_JSON } from "./workbook";

/**
 * Exports a minimal URL-validation CSV for a third-party review pass (e.g. a
 * ChatGPT batch). Deliberately excludes every internal research field:
 * scores, ranks, confidence and notes are administrator-only and must never
 * leave the repository.
 *
 * The CSV is derived from the generated top-1000.json, so it can never drift
 * from the workbook-derived dataset.
 */
const VALIDATION_COLUMNS = [
  "rank",
  "canonicalEmployer",
  "primarySponsorLegalEntity",
  "townCity",
  "careerSearchUrl",
  "atsPlatform",
  "researchStatus",
] as const;

const VALIDATION_CSV_PATH = "data/generated/employer-targets/url-validation.csv";

function csvCell(value: string | number | null): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows: readonly EmployerResearchRow[]): string {
  const header = VALIDATION_COLUMNS.join(",");
  const lines = rows.map((row) =>
    VALIDATION_COLUMNS.map((column) =>
      csvCell((row[column] as string | number | null) ?? null),
    ).join(","),
  );
  return `${header}\n${lines.join("\n")}\n`;
}

const payload = JSON.parse(readFileSync(GENERATED_TARGETS_JSON, "utf8")) as {
  datasetVersion: string;
  rows: EmployerResearchRow[];
};
if (!Array.isArray(payload.rows)) {
  throw new Error(`${GENERATED_TARGETS_JSON} is malformed: missing rows array`);
}

mkdirSync("data/generated/employer-targets", { recursive: true });
writeFileSync(VALIDATION_CSV_PATH, toCsv(payload.rows));
process.stdout.write(
  `Exported ${payload.rows.length} rows to ${VALIDATION_CSV_PATH} (${payload.datasetVersion})\n`,
);
process.stdout.write(
  `Give ChatGPT the CSV in batches of ~200-250 rows and ask for JSON-only verdicts:\n`,
);
process.stdout.write(
  `  [{"rank": 1, "verdict": "ok|suspect|better_url|needs_review", "suggestedUrl": "...", "reason": "...", "confidence": "high|low"}]\n`,
);
process.stdout.write(
  `Then run: pnpm jobs:targets:merge-validation-reviews --input=<chatgpt-verdicts.json>\n`,
);
