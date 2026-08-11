import {
  closeCrawlerDatabase,
  withCrawlerRole,
} from "../../src/modules/job-catalog/infrastructure/crawler-database";
import { listCompaniesForAdmin } from "../../src/modules/job-catalog/infrastructure/company-repository";
import {
  listRecentEvents,
  listRecentRuns,
} from "../../src/modules/job-catalog/infrastructure/ingestion-run-repository";
import { loadLocalEnvironment } from "../shared/load-local-environment";

loadLocalEnvironment();

await withCrawlerRole(async (database) => {
  const [companies, runs, events] = await Promise.all([
    listCompaniesForAdmin(database),
    listRecentRuns(database, 15),
    listRecentEvents(database, 10),
  ]);

  process.stdout.write("\n== Job sources ==\n");
  for (const company of companies) {
    const lastCheck = company.last_checked_at ? company.last_checked_at.toISOString() : "never";
    process.stdout.write(
      `${company.active ? "on " : "off"} ${company.crawl_allowed.padEnd(7)} ${company.crawl_status.padEnd(8)} failures=${company.consecutive_failures} next=${company.next_check_at ? company.next_check_at.toISOString() : "due-now"} last=${lastCheck} ${company.name} (${company.slug}, ${company.source_type})\n`,
    );
  }

  process.stdout.write("\n== Recent ingestion runs ==\n");
  for (const run of runs) {
    process.stdout.write(
      `${run.started_at.toISOString()} ${run.status.padEnd(9)} discovered=${run.jobs_discovered} new=${run.jobs_new} updated=${run.jobs_updated} unchanged=${run.jobs_unchanged} deactivated=${run.jobs_deactivated} errors=${run.error_count} ${run.duration_ms}ms ${run.company_name}${run.error_summary ? ` [${run.error_summary}]` : ""}\n`,
    );
  }

  process.stdout.write("\n== Recent source events ==\n");
  for (const event of events) {
    process.stdout.write(
      `${event.occurred_at.toISOString()} ${event.kind.padEnd(20)} ${event.company_name}${event.message ? ` ${event.message}` : ""}\n`,
    );
  }
});

try {
  await closeCrawlerDatabase();
} catch {
  process.exitCode = 1;
}
