import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import type { EmployerResearchRow } from "../../../src/modules/employer-research/domain/research-row";
import { GENERATED_TARGETS_JSON } from "./workbook";

/**
 * Merges a ChatGPT URL-validation verdict file back into a review sheet.
 *
 * Expected input (JSON array, one object per ranked employer):
 *   [{ "rank": 1, "verdict": "ok|suspect|better_url|needs_review",
 *      "suggestedUrl": "https://...",
 *      "earlyCareerUrl": "https://..." (optional: separate early-career page),
 *      "reason": "...", "confidence": "high|low" }]
 *
 * Outputs data/generated/employer-targets/url-validation-review.csv, one row
 * per verdict matched to the current dataset by rank. It never edits the
 * workbook or the dataset; apply accepted changes to the XLSX workbook (the
 * source of truth) and regenerate with pnpm jobs:targets:export.
 */

const REVIEW_CSV_PATH = "data/generated/employer-targets/url-validation-review.csv";

type ValidationReview = Readonly<{
  rank: number;
  verdict: string;
  suggestedUrl: string | null;
  earlyCareerUrl: string | null;
  reason: string | null;
  confidence: string | null;
}>;

function readInputFlag(): string {
  const flag = process.argv.find((argument) => argument.startsWith("--input="));
  if (!flag) {
    throw new Error(
      "Usage: pnpm jobs:targets:merge-validation-reviews --input=<chatgpt-verdicts.json>",
    );
  }
  return flag.slice("--input=".length);
}

function normalizeReviews(input: unknown): ValidationReview[] {
  const raw: unknown[] = Array.isArray(input)
    ? input
    : ((input as { reviews?: unknown[] | undefined } | null)?.reviews ?? []);
  if (!Array.isArray(raw)) {
    throw new Error("Input must be a JSON array of verdicts (or { reviews: [...] }).");
  }
  return raw.map((entry) => {
    const record = (entry ?? {}) as Record<string, unknown>;
    const rank = Number(record.rank ?? record["rank"]);
    if (!Number.isInteger(rank) || rank < 1) {
      throw new Error(`Verdict entry is missing a valid integer rank: ${JSON.stringify(entry)}`);
    }
    const suggested =
      (record.suggestedUrl as string | undefined) ??
      (record.suggested_url as string | undefined) ??
      (record.url as string | undefined) ??
      null;
    const earlyCareer =
      (record.earlyCareerUrl as string | undefined) ??
      (record.early_career_url as string | undefined) ??
      null;
    const verdict = String(record.verdict ?? record["verdict"] ?? "needs_review").toLowerCase();
    return {
      rank,
      verdict,
      suggestedUrl: typeof suggested === "string" && suggested.trim() ? suggested.trim() : null,
      earlyCareerUrl:
        typeof earlyCareer === "string" && earlyCareer.trim() ? earlyCareer.trim() : null,
      reason:
        typeof record.reason === "string" && record.reason.trim() ? record.reason.trim() : null,
      confidence:
        typeof record.confidence === "string" && record.confidence.trim()
          ? record.confidence.trim()
          : null,
    };
  });
}

function csvCell(value: string | number | null): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const inputPath = readInputFlag();
const reviews = normalizeReviews(JSON.parse(readFileSync(inputPath, "utf8")));

const payload = JSON.parse(readFileSync(GENERATED_TARGETS_JSON, "utf8")) as {
  datasetVersion: string;
  rows: EmployerResearchRow[];
};
if (!Array.isArray(payload.rows)) {
  throw new Error(`${GENERATED_TARGETS_JSON} is malformed: missing rows array`);
}
const byRank = new Map<number, EmployerResearchRow>(payload.rows.map((row) => [row.rank, row]));

const header = [
  "rank",
  "canonicalEmployer",
  "currentCareerUrl",
  "verdict",
  "suggestedUrl",
  "earlyCareerUrl",
  "state",
  "reason",
  "confidence",
];
const lines = reviews.map((review) => {
  const row = byRank.get(review.rank);
  if (!row) return null;
  const current = row.careerSearchUrl ?? "";
  const suggested = review.suggestedUrl ?? "";
  const state = review.verdict === "ok" || suggested === current ? "unchanged" : "changed";
  return [
    review.rank,
    row.canonicalEmployer,
    current,
    review.verdict,
    suggested,
    review.earlyCareerUrl ?? "",
    state,
    review.reason,
    review.confidence,
  ];
});
const matched = lines.filter((line) => line !== null) as (string | number | null)[][];
const unknownRanks = reviews.map((review) => review.rank).filter((rank) => !byRank.has(rank));

mkdirSync("data/generated/employer-targets", { recursive: true });
writeFileSync(
  REVIEW_CSV_PATH,
  `${header.join(",")}\n${matched.map((line) => line.map(csvCell).join(",")).join("\n")}\n`,
);

const verdictCounts = new Map<string, number>();
for (const review of reviews) {
  verdictCounts.set(review.verdict, (verdictCounts.get(review.verdict) ?? 0) + 1);
}
const changedCount = matched.filter((line) => line[6] === "changed").length;

process.stdout.write(`Merged ${matched.length} reviews into ${REVIEW_CSV_PATH}\n`);
for (const [verdict, count] of [...verdictCounts.entries()].sort()) {
  process.stdout.write(`  ${verdict}: ${count}\n`);
}
process.stdout.write(`  suggested URL changes: ${changedCount}\n`);
if (unknownRanks.length > 0) {
  process.stdout.write(
    `  WARNING: ${unknownRanks.length} verdict ranks not found in the dataset.\n`,
  );
}
process.stdout.write(
  "Apply accepted corrections to the XLSX workbook, then run pnpm jobs:targets:export.\n",
);
