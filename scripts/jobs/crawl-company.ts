import { runSourceCrawl } from "../../src/modules/job-catalog/application/ingestion";
import { readCrawlerConfiguration } from "../../src/modules/job-catalog/application/config";
import { findCompanyBySlug } from "../../src/modules/job-catalog/infrastructure/company-repository";
import {
  closeCrawlerDatabase,
  withCrawlerRole,
} from "../../src/modules/job-catalog/infrastructure/crawler-database";
import { logger } from "../../src/modules/job-catalog/infrastructure/logging";
import { loadLocalEnvironment } from "../shared/load-local-environment";
import { readCliOptions } from "./options";

loadLocalEnvironment();

const options = readCliOptions();
if (!options.company) {
  throw new Error("Usage: pnpm jobs:crawl --company=<slug> [--dry-run]");
}

const configuration = readCrawlerConfiguration(process.env);
if (!configuration.catalogEnabled) {
  logger.info({ event: "job_crawl_company_skipped", reason: "job catalog disabled" });
  await closeCrawlerDatabase();
  process.exit(0);
}

const company = await withCrawlerRole((database) => findCompanyBySlug(database, options.company!));
if (!company) {
  logger.error({ event: "job_crawl_company_unknown", company: options.company });
  await closeCrawlerDatabase();
  process.exit(1);
}

logger.info({
  event: "job_crawl_company_started",
  crawlAllowed: company.crawlAllowed,
  crawlStatus: company.crawlStatus,
  dryRun: options.dryRun,
  source: company.slug,
});

const outcome = await runSourceCrawl({
  company,
  configuration,
  dryRun: options.dryRun,
});

logger.info({
  event: "job_crawl_company_finished",
  ...outcome,
  source: company.slug,
});

await closeCrawlerDatabase();
if (outcome.status === "failed") process.exit(1);
