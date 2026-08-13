import * as fs from "node:fs";

import XLSX from "xlsx";

XLSX.set_fs(fs);

export const TARGET_WORKBOOK_PATH =
  "data/research/employer-targets/offerlab_target_employers_top_1000_enhanced.xlsx";
export const TARGET_TOP_1000_SHEET = "Top 1000 v2";
export const GENERATED_TARGETS_DIR = "data/generated/employer-targets";
export const GENERATED_TARGETS_JSON = `${GENERATED_TARGETS_DIR}/top-1000.json`;
export const GENERATED_TARGETS_MANIFEST = `${GENERATED_TARGETS_DIR}/manifest.json`;

export function readTop1000Sheet(
  filePath: string = TARGET_WORKBOOK_PATH,
): readonly Readonly<Record<string, unknown>>[] {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[TARGET_TOP_1000_SHEET];
  if (!sheet)
    throw new Error(`Workbook ${filePath} does not contain sheet ${TARGET_TOP_1000_SHEET}`);
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
}
