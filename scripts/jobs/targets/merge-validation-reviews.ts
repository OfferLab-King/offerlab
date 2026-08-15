import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import postgres from "postgres";

import { importReviewCandidates } from "../../../src/modules/employer-research/application/import-targets";
import type { EmployerResearchRow } from "../../../src/modules/employer-research/domain/research-row";
import { isLocalDatabaseUrl } from "../../learn-demo-content";
import { loadLocalEnvironment } from "../../shared/load-local-environment";
import { GENERATED_TARGETS_JSON } from "./workbook";

/**
 * Merges a ChatGPT URL-validation verdict file back into a review sheet and,
 * with --import-candidates, inserts accepted URLs as unverified source
 * candidates.
 *
 * Expected input (JSON array, one object per ranked employer):
 *   [{ "rank": 1, "verdict": "ok|suspect|better_url|needs_review",
 *      "suggestedUrl": "https://...",
 *      "earlyCareerUrls": ["https://..."] (optional: separate early-career pages),
 *      "reason": "...", "confidence": "high|low" }]
 *
 * The review sheet is written to
 * data/generated/employer-targets/url-validation-review.csv and never edits
 * the workbook or the dataset; apply accepted corrections to the XLSX
 * workbook (the source of truth) and regenerate with pnpm jobs:targets:export.
 *
 * --import-candidates inserts accepted URLs into app.job_source_candidate as
 * unverified candidates (channel general/early_career, discovery method
 * external_url_review). It never verifies URLs, never activates sources and
 * never touches app.job_source.
 */

const REVIEW_CSV_PATH = "data/generated/employer-targets/url-validation-review.csv";

type ValidationReview = Readonly<{
  rank: number;
  verdict: string;
  suggestedUrl: string | null;
  earlyCareerUrls: readonly string[];
  reason: string | null;
  confidence: string | null;
}>;

const IMPORT_CANDIDATES = process.argv.includes("--import-candidates");

function readInputFlag(): string {
  const flag = process.argv.find((argument) => argument.startsWith("--input="));
  if (!flag) {
    throw new Error(
      "Usage: pnpm jobs:targets:merge-validation-reviews --input=<chatgpt-verdicts.json> [--import-candidates]",
    );
  }
  return flag.slice("--input=".length);
}

/**
 * Unwraps markdown link syntax that chat models sometimes emit
 * (`[https://a](https://a)` -> `https://a`), trims, and keeps only plain
 * https URLs. Non-URL text is rejected so a broken value can never become a
 * candidate.
 */
function normalizeUrlValue(value: string): string | null {
  const trimmed = value.trim();
  const unwrapped =
    /^\[(https?:\/\/[^\]\s]+)\]\((?:https?:\/\/[^)\s]+)\)$/u.exec(trimmed)?.[1] ?? trimmed;
  if (!/^https:\/\/[^\s]+$/u.test(unwrapped)) return null;
  return unwrapped;
}

function normalizeUrls(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const urls: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const url = normalizeUrlValue(entry);
    if (url) urls.push(url);
  }
  return urls;
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
    const verdict = String(record.verdict ?? record["verdict"] ?? "needs_review").toLowerCase();
    return {
      rank,
      verdict,
      suggestedUrl:
        typeof suggested === "string" && suggested.trim() ? normalizeUrlValue(suggested) : null,
      earlyCareerUrls: normalizeUrls(
        record.earlyCareerUrls ??
          record.early_career_urls ??
          record.earlyCareerUrl ??
          record.early_career_url,
      ),
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
  "earlyCareerUrls",
  "state",
  "reason",
  "confidence",
];
const lines = reviews.map((review) => {
  const row = byRank.get(review.rank);
  if (!row) return null;
  const current = row.careerSearchUrl ?? "";
  const suggested = review.suggestedUrl ?? "";
  const state = suggested !== "" && suggested !== current ? "changed" : "unchanged";
  return [
    review.rank,
    row.canonicalEmployer,
    current,
    review.verdict,
    suggested,
    review.earlyCareerUrls.join(" ; "),
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

if (!IMPORT_CANDIDATES) {
  process.stdout.write(
    "Apply accepted corrections to the XLSX workbook, then run pnpm jobs:targets:export.\n",
  );
  process.exit(0);
}

loadLocalEnvironment();
const databaseUrl = process.env.DATABASE_MIGRATION_URL;
if (!databaseUrl) throw new Error("Refusing to import: DATABASE_MIGRATION_URL is required.");
if (!isLocalDatabaseUrl(databaseUrl)) {
  throw new Error(
    "Refusing to import: DATABASE_MIGRATION_URL must use an approved local database host.",
  );
}

const database = postgres(databaseUrl, { max: 2, prepare: false });
try {
  const companyIdsByRank = new Map<number, string>();
  const snapshotRows = await database<{ companyId: string; internalRank: number }[]>`
    select distinct on (s.company_id) s.company_id as "companyId", s.internal_rank as "internalRank"
    from app.employer_research_snapshot s
    where s.internal_rank = any(${reviews.map((review) => review.rank)})
      and s.company_id is not null
    order by s.company_id, s.research_date desc, s.dataset_version desc
  `;
  for (const row of snapshotRows) companyIdsByRank.set(row.internalRank, row.companyId);

  const inputs: Array<{
    companyId: string;
    channel: "general" | "early_careers";
    url: string;
    confidence: string | null;
    notes: string | null;
  }> = [];
  const skippedUnmatched: number[] = [];
  for (const review of reviews) {
    const companyId = companyIdsByRank.get(review.rank);
    if (!companyId) {
      skippedUnmatched.push(review.rank);
      continue;
    }
    const row = byRank.get(review.rank);
    const current = row?.careerSearchUrl ?? null;
    if (
      review.suggestedUrl &&
      review.suggestedUrl !== current &&
      review.suggestedUrl.startsWith("https://")
    ) {
      inputs.push({
        companyId,
        channel: "general",
        url: review.suggestedUrl,
        confidence: review.confidence,
        notes: review.reason,
      });
    }
    for (const url of review.earlyCareerUrls) {
      if (url.startsWith("https://")) {
        inputs.push({
          companyId,
          channel: "early_careers",
          url,
          confidence: review.confidence,
          notes: review.reason,
        });
      }
    }
  }

  const report = await database.begin((transaction) => importReviewCandidates(transaction, inputs));
  process.stdout.write(
    `Imported ${report.inserted} candidates (${report.skippedExisting} already present).\n`,
  );
  if (skippedUnmatched.length > 0) {
    process.stdout.write(
      `  WARNING: ${skippedUnmatched.length} ranks have no researched company in the database: ${skippedUnmatched.join(", ")}\n`,
    );
  }
  process.stdout.write(
    "Candidates stay unverified (candidate_found). Verify them with pnpm jobs:discover-source --verify, then promote from /admin/source-discovery.\n",
  );
} finally {
  await database.end();
}
