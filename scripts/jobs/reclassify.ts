import { readCrawlerConfiguration } from "../../src/modules/job-catalog/application/config";
import { reclassifyActiveJobs } from "../../src/modules/job-catalog/application/reclassify";
import { closeCrawlerDatabase } from "../../src/modules/job-catalog/infrastructure/crawler-database";
import { logger } from "../../src/modules/job-catalog/infrastructure/logging";
import { loadLocalEnvironment } from "../shared/load-local-environment";

loadLocalEnvironment();
const configuration = readCrawlerConfiguration(process.env);

if (!configuration.catalogEnabled) {
  logger.info({ event: "job_reclassify_skipped", reason: "job catalog disabled" });
  await closeCrawlerDatabase();
  process.exit(0);
}

const result = await reclassifyActiveJobs();
logger.info({ event: "job_reclassify_finished", ...result });
await closeCrawlerDatabase();
