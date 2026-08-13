import { spawn } from "node:child_process";

import { isJobCatalogEnabled } from "../src/modules/job-catalog/application/config";
import { logger } from "../src/modules/job-catalog/infrastructure/logging";
import { readPollIntervalMs } from "./dev-jobs/poller";
import { DevWithJobsSupervisor } from "./dev-jobs/supervisor";
import { readBatchLimit } from "./dev-jobs/worker-command";
import { loadLocalEnvironment } from "./shared/load-local-environment";

loadLocalEnvironment();

const catalogEnabled = isJobCatalogEnabled(process.env);
const pollIntervalMs = readPollIntervalMs(process.env);
const batchLimit = readBatchLimit(process.env);

const supervisor = new DevWithJobsSupervisor({
  spawnProcess: spawn,
  terminateProcess: (pid, signal) => process.kill(pid, signal),
  onLog: (message) => logger.info({ event: "dev_jobs_supervisor", message }),
  onPollError: (error) =>
    logger.warn({
      event: "dev_jobs_poll_failed",
      error: error instanceof Error ? error.message : String(error),
    }),
  pollIntervalMs,
  batchLimit,
  pollEnabled: catalogEnabled,
  childExitTimeoutMs: 10_000,
});

logger.info({
  event: "dev_jobs_starting",
  batchLimit,
  catalogEnabled,
  pollIntervalMs,
});

process.on("exit", () => supervisor.terminateAll("SIGKILL"));

const shutdown = (signal: NodeJS.Signals): void => {
  void supervisor.shutdown(signal);
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

const exitCode = await supervisor.run();
process.exit(exitCode);
