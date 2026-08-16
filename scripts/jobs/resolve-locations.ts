import { readCrawlerConfiguration } from "../../src/modules/job-catalog/application/config";
import { runLocationResolution } from "../../src/modules/job-catalog/application/location-resolution";
import { createHttpClient } from "../../src/modules/job-catalog/infrastructure/connectors/http-client";
import { RobotsGate } from "../../src/modules/job-catalog/infrastructure/connectors/robots";
import { closeCrawlerDatabase } from "../../src/modules/job-catalog/infrastructure/crawler-database";
import { loadLocalEnvironment } from "../shared/load-local-environment";

/**
 * Resolves ambiguous Workday job locations from the job detail pages.
 *
 * The CXS search response returns aggregate location strings ("2 Locations"),
 * which the eligibility gate cannot confirm. This script fetches each pending
 * job's detail page, extracts the embedded JSON-LD jobLocation entries and
 * re-runs the deterministic eligibility pipeline, so genuinely UK roles are
 * published and clearly non-UK roles are suppressed.
 */
loadLocalEnvironment();

const dryRun = !process.argv.includes("--confirm");
const rawLimit = Number(
  process.argv.find((argument) => argument.startsWith("--limit="))?.slice("--limit=".length) ??
    "100",
);
if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 500) {
  throw new Error("--limit must be an integer between 1 and 500");
}

const configuration = readCrawlerConfiguration(process.env);
const httpClient = createHttpClient({
  timeoutMs: configuration.timeoutMs,
  userAgent: configuration.userAgent,
});
const robotsGate = new RobotsGate({ httpClient });

const report = await runLocationResolution({
  dryRun,
  httpClient,
  limit: rawLimit,
  robotsGate,
});

process.stdout.write(
  `Processed ${report.processed} jobs (${report.published} published, ${report.suppressed} suppressed).\n`,
);
for (const [outcome, count] of Object.entries(report.outcomes)) {
  if (count > 0) process.stdout.write(`  ${outcome}: ${count}\n`);
}
if (dryRun) {
  process.stdout.write("Dry run — re-run with --confirm to write.\n");
}
await closeCrawlerDatabase();
