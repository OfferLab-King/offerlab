import { runEnrichmentBatch } from "../../src/modules/job-catalog/application/enrichment";
import { readEnrichmentConfiguration } from "../../src/modules/job-catalog/application/config";
import { closeCrawlerDatabase } from "../../src/modules/job-catalog/infrastructure/crawler-database";
import { logger } from "../../src/modules/job-catalog/infrastructure/logging";
import { loadLocalEnvironment } from "../shared/load-local-environment";
import { readCliOptions } from "./options";

loadLocalEnvironment();

const options = readCliOptions();
const configuration = {
  ...readEnrichmentConfiguration(process.env),
  batchLimit: options.limit,
};

if (!configuration.catalogEnabled) {
  logger.info({ event: "job_enrichment_skipped", reason: "job catalog disabled" });
  await closeCrawlerDatabase();
  process.exit(0);
}

logger.info({
  batchLimit: configuration.batchLimit,
  dryRun: options.dryRun,
  event: "job_enrichment_started",
  llmEnabled: configuration.llmEnabled,
});

const outcome = await runEnrichmentBatch({
  configuration,
  dryRun: options.dryRun,
});

logger.info({ event: "job_enrichment_finished", ...outcome });

await closeCrawlerDatabase();
if (outcome.failed > 0) process.exit(1);
