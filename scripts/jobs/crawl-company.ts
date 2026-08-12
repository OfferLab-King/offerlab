import { runSourceCrawl } from "../../src/modules/job-catalog/application/ingestion";
import { readCrawlerConfiguration } from "../../src/modules/job-catalog/application/config";
import { findJobSourceBySlugs } from "../../src/modules/job-catalog/infrastructure/job-source-repository";
import {
  closeCrawlerDatabase,
  withCrawlerRole,
} from "../../src/modules/job-catalog/infrastructure/crawler-database";
import { logger } from "../../src/modules/job-catalog/infrastructure/logging";
import { loadLocalEnvironment } from "../shared/load-local-environment";
import { readCliOptions } from "./options";

loadLocalEnvironment();

const options = readCliOptions();
if (!options.company || !options.company.includes("/")) {
  throw new Error("Usage: pnpm jobs:crawl --company=<company-slug>/<source-slug> [--dry-run]");
}

const configuration = readCrawlerConfiguration(process.env);
if (!configuration.catalogEnabled) {
  logger.info({ event: "job_crawl_company_skipped", reason: "job catalog disabled" });
  await closeCrawlerDatabase();
  process.exit(0);
}

const [companySlug, sourceSlug] = options.company.split("/", 2);
const company = await withCrawlerRole((database) =>
  findJobSourceBySlugs(database, companySlug!, sourceSlug!),
);
if (!company) {
  logger.error({ event: "job_crawl_company_unknown", company: options.company });
  await closeCrawlerDatabase();
  process.exit(1);
}

logger.info({
  event: "job_crawl_company_started",
  status: company.status,
  dryRun: options.dryRun,
  source: `${company.companySlug}/${company.sourceSlug}`,
});

const outcome = await runSourceCrawl({
  source: company,
  configuration,
  dryRun: options.dryRun,
});

logger.info({
  event: "job_crawl_company_finished",
  ...outcome,
  source: `${company.companySlug}/${company.sourceSlug}`,
});

await closeCrawlerDatabase();
if (outcome.status === "failed") process.exit(1);
