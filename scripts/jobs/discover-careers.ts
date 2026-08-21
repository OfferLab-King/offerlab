import postgres from "postgres";

import {
  buildCareerSearchQuery,
  estimateBraveSearchCost,
  planCareerSearchResults,
  type CareerSearchResult,
} from "../../src/modules/employer-research/domain/career-search-discovery";
import {
  countSponsorEmployersMissingWebPresence,
  fillOfficialCompanyWebsite,
  listSponsorEmployersMissingWebPresence,
  recordEmployerWebDiscoveryAttempt,
  upsertDiscoveryCandidate,
} from "../../src/modules/employer-research/infrastructure/discovery-repository";
import { isLocalDatabaseUrl } from "../learn-demo-content";
import { loadLocalEnvironment } from "../shared/load-local-environment";

loadLocalEnvironment();

function readFlag(name: string): string | undefined {
  const argument = process.argv.find((item) => item.startsWith(`--${name}=`));
  return argument?.split("=").slice(1).join("=");
}

function readBoundedInteger(name: string, fallback: number, maximum: number): number {
  const value = Number(readFlag(name) ?? String(fallback));
  if (!Number.isInteger(value) || value < 0 || value > maximum) {
    throw new Error(`--${name} must be an integer between 0 and ${maximum}`);
  }
  return value;
}

const maxQueries = readBoundedInteger("max-queries", 1_000, 1_000);
const execute = process.argv.includes("--execute");
const discoveryVersion = "official-careers-v1";
if (execute && maxQueries === 0) throw new Error("--max-queries must be positive with --execute");

const databaseUrl = process.env.DATABASE_MIGRATION_URL;
if (!databaseUrl) throw new Error("DATABASE_MIGRATION_URL is required.");
if (!isLocalDatabaseUrl(databaseUrl)) {
  throw new Error("Career discovery is limited to the approved local operations database.");
}

async function braveSearch(query: string, apiKey: string): Promise<CareerSearchResult[]> {
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("country", "GB");
  url.searchParams.set("search_lang", "en");
  url.searchParams.set("count", "10");
  const response = await fetch(url, {
    headers: { Accept: "application/json", "X-Subscription-Token": apiKey },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Brave Search returned HTTP ${response.status}`);
  const payload = (await response.json()) as {
    web?: { results?: { title?: unknown; url?: unknown; description?: unknown }[] };
  };
  return (payload.web?.results ?? []).flatMap((result) =>
    typeof result.title === "string" &&
    typeof result.url === "string" &&
    typeof result.description === "string"
      ? [{ title: result.title, url: result.url, description: result.description }]
      : [],
  );
}

const database = postgres(databaseUrl, { max: 2, prepare: false });
try {
  const queued = await countSponsorEmployersMissingWebPresence(database, discoveryVersion);
  const plannedQueries = Math.min(maxQueries, queued);
  process.stdout.write("\n== Sponsor careers discovery ==\n");
  process.stdout.write(`eligible employers remaining: ${queued.toLocaleString("en-GB")}\n`);
  process.stdout.write(`version: ${discoveryVersion}; next batch: up to ${plannedQueries}\n`);
  process.stdout.write(
    `maximum provider cost at current list price: $${estimateBraveSearchCost(plannedQueries).toFixed(2)}\n`,
  );

  if (!execute) {
    process.stdout.write(
      "Plan only: no network requests and no writes. Set BRAVE_SEARCH_API_KEY and re-run with --execute to authorise this bounded paid batch.\n",
    );
    process.exitCode = 0;
  } else {
    const apiKey = process.env.BRAVE_SEARCH_API_KEY;
    if (!apiKey) throw new Error("BRAVE_SEARCH_API_KEY is required with --execute.");
    const targets = await listSponsorEmployersMissingWebPresence(database, {
      limit: plannedQueries,
      discoveryVersion,
    });
    let queried = 0;
    let websites = 0;
    let candidates = 0;
    let empty = 0;
    let failed = 0;
    const channelCounts = new Map<string, number>();

    for (const target of targets) {
      try {
        const location = target.townCity ? ` ${target.townCity}` : "";
        const results = await braveSearch(
          `${buildCareerSearchQuery(target.legalName)}${location}`,
          apiKey,
        );
        queried += 1;
        const plan = planCareerSearchResults(target.companyName, results);
        if (plan.officialWebsiteUrl && !target.websiteUrl) {
          const outcome = await fillOfficialCompanyWebsite(
            database,
            target.companyId,
            plan.officialWebsiteUrl,
          );
          if (outcome === "updated") websites += 1;
        }
        if (plan.candidates.length === 0) empty += 1;
        for (const candidate of plan.candidates) {
          const outcome = await database.begin((transaction) =>
            upsertDiscoveryCandidate(transaction, {
              companyId: target.companyId,
              url: candidate.url,
              channel: candidate.channel,
              platformHint: candidate.platformHint,
              status: candidate.platformHint ? "platform_identified" : "candidate_found",
              discoveryMethod: "brave_search",
              evidence: candidate.evidence,
              notes: `Bounded official-site discovery; ${candidate.confidence} identity confidence. Requires typed API or manual official-domain verification before activation.`,
            }),
          );
          if (outcome === "inserted") {
            candidates += 1;
            channelCounts.set(candidate.channel, (channelCounts.get(candidate.channel) ?? 0) + 1);
          }
        }
        await recordEmployerWebDiscoveryAttempt(database, {
          companyId: target.companyId,
          discoveryVersion,
          status: plan.candidates.length > 0 ? "matched" : "no_safe_match",
          resultCount: results.length,
          safeCandidateCount: plan.candidates.length,
        });
      } catch (error) {
        failed += 1;
        const reason = error instanceof Error ? error.message : "unknown error";
        process.stderr.write(`Discovery failed for ${target.companyName}: ${reason}\n`);
        await recordEmployerWebDiscoveryAttempt(database, {
          companyId: target.companyId,
          discoveryVersion,
          status: "failed",
          resultCount: 0,
          safeCandidateCount: 0,
        });
      }
    }

    process.stdout.write(`queries completed: ${queried}; failures: ${failed}\n`);
    process.stdout.write(`official websites filled: ${websites}\n`);
    process.stdout.write(`career candidates inserted: ${candidates}; no safe match: ${empty}\n`);
    for (const [channel, count] of [...channelCounts].sort()) {
      process.stdout.write(`  ${channel}: ${count}\n`);
    }
    process.stdout.write(
      "Candidates remain inactive. Run jobs:discover-source --verify, then jobs:sources:automate for typed connectors.\n",
    );
  }
} finally {
  await database.end();
}
