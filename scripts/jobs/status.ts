import {
  closeCrawlerDatabase,
  withCrawlerRole,
} from "../../src/modules/job-catalog/infrastructure/crawler-database";
import { listJobSourcesForAdmin } from "../../src/modules/job-catalog/infrastructure/job-source-repository";
import {
  listRecentEvents,
  listRecentRuns,
} from "../../src/modules/job-catalog/infrastructure/ingestion-run-repository";
import { loadLocalEnvironment } from "../shared/load-local-environment";

loadLocalEnvironment();

await withCrawlerRole(async (database) => {
  const [sources, runs, events] = await Promise.all([
    listJobSourcesForAdmin(database),
    listRecentRuns(database, 15),
    listRecentEvents(database, 10),
  ]);

  process.stdout.write("\n== Job sources ==\n");
  for (const source of sources) {
    const lastCheck = source.last_checked_at ? source.last_checked_at.toISOString() : "never";
    process.stdout.write(
      `${source.status.padEnd(8)} failures=${source.consecutive_failures} next=${source.next_check_at ? source.next_check_at.toISOString() : "due-now"} last=${lastCheck} landing=${source.landing_health_status} endpoint=${source.endpoint_health_status} ${source.company_name} (${source.company_slug}/${source.source_slug}, ${source.source_type})\n`,
    );
  }

  process.stdout.write("\n== Recent ingestion runs ==\n");
  for (const run of runs) {
    process.stdout.write(
      `${run.started_at.toISOString()} ${run.status.padEnd(9)} discovered=${run.jobs_discovered} new=${run.jobs_new} updated=${run.jobs_updated} unchanged=${run.jobs_unchanged} deactivated=${run.jobs_deactivated} errors=${run.error_count} ${run.duration_ms}ms ${run.company_name}${run.source_name ? ` / ${run.source_name}` : ""}${run.error_summary ? ` [${run.error_summary}]` : ""}\n`,
    );
  }

  process.stdout.write("\n== Recent source events ==\n");
  for (const event of events) {
    process.stdout.write(
      `${event.occurred_at.toISOString()} ${event.kind.padEnd(20)} ${event.company_name}${event.source_name ? ` / ${event.source_name}` : ""}${event.message ? ` ${event.message}` : ""}\n`,
    );
  }
});

try {
  await closeCrawlerDatabase();
} catch {
  process.exitCode = 1;
}
