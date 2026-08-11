import { runSourceCrawl } from "../../src/modules/job-catalog/application/ingestion";
import { readCrawlerConfiguration } from "../../src/modules/job-catalog/application/config";
import { listDueCompanies } from "../../src/modules/job-catalog/infrastructure/company-repository";
import { withCrawlerRole } from "../../src/modules/job-catalog/infrastructure/crawler-database";
import {
  closeCrawlerDatabase,
  withGlobalCrawlLock,
} from "../../src/modules/job-catalog/infrastructure/crawler-database";
import { recoverStaleRuns } from "../../src/modules/job-catalog/infrastructure/ingestion-run-repository";
import { logger } from "../../src/modules/job-catalog/infrastructure/logging";
import { loadLocalEnvironment } from "../shared/load-local-environment";
import { readCliOptions } from "./options";

loadLocalEnvironment();

const options = readCliOptions();
const configuration = readCrawlerConfiguration(process.env);

if (!configuration.catalogEnabled) {
  logger.info({ event: "job_crawl_due_skipped", reason: "job catalog disabled" });
  await closeCrawlerDatabase();
  process.exit(0);
}

const locked = await withGlobalCrawlLock("due-run", async () => {
  const now = new Date();

  const recovered = await withCrawlerRole((database) => recoverStaleRuns(database, 2));
  if (recovered > 0) {
    logger.warn({ count: recovered, event: "job_stale_runs_recovered" });
  }

  const dueCompanies = await withCrawlerRole((database) =>
    listDueCompanies(database, now, options.limit),
  );

  logger.info({
    count: dueCompanies.length,
    dryRun: options.dryRun,
    event: "job_crawl_due_discovered",
    limit: options.limit,
  });

  const results: { outcome: Awaited<ReturnType<typeof runSourceCrawl>>; slug: string }[] = [];
  const queue = [...dueCompanies];
  const workers = Array.from({ length: Math.max(1, configuration.maxConcurrency) }, async () => {
    while (queue.length > 0) {
      const company = queue.shift()!;
      const outcome = await runSourceCrawl({
        company,
        configuration,
        dryRun: options.dryRun,
        now,
      });
      results.push({ outcome, slug: company.slug });
    }
  });
  await Promise.all(workers);

  const succeeded = results.filter(({ outcome }) => outcome.status === "succeeded").length;
  const failed = results.filter(({ outcome }) => outcome.status === "failed").length;
  const skipped = results.filter(({ outcome }) => outcome.status === "skipped").length;

  logger.info({
    event: "job_crawl_due_finished",
    failed,
    skipped,
    succeeded,
    total: results.length,
  });

  for (const { outcome, slug } of results) {
    if (outcome.status === "failed") {
      logger.warn({
        errorSummary: outcome.errorSummary,
        event: "job_crawl_due_failed",
        source: slug,
      });
    }
  }

  return failed;
});

if (!locked.acquired) {
  logger.info({ event: "job_crawl_due_skipped", reason: "another due run already in progress" });
  await closeCrawlerDatabase();
  process.exit(0);
}

await closeCrawlerDatabase();
if ((locked.result ?? 0) > 0) process.exit(1);
