import { planCrawlChanges } from "../domain/change-detection";
import type { DiscoveredJob } from "../domain/deduplication";
import { nextCheckAtWithJitter } from "../domain/scheduler";
import { sourceUrlHealthAfterCheck, type SourceUrlHealth } from "../domain/source-health";
import { isCrawlable, sourceKey, type JobSource, type SourceStatus } from "../domain/source";
import { canonicalizeJobUrl, slugifyTitle } from "../domain/urls";
import {
  updateJobSourceAfterRun,
  recordJobSourceHealth,
  type SourceRunOutcome,
} from "../infrastructure/job-source-repository";
import { createConnectorForSource } from "../infrastructure/connectors/registry";
import { JobFetchError } from "../infrastructure/connectors/errors";
import { createHttpClient } from "../infrastructure/connectors/http-client";
import { RobotsGate } from "../infrastructure/connectors/robots";
import { withCompanyCrawlLock, withCrawlerRole } from "../infrastructure/crawler-database";
import {
  finishIngestionRun,
  recordSourceEvent,
  startIngestionRun,
} from "../infrastructure/ingestion-run-repository";
import {
  applyCrawlPlan,
  existingRecord,
  listJobsForSource,
} from "../infrastructure/job-repository";
import { logger } from "../infrastructure/logging";
import { classifyDiscoveredJob } from "./classification-pipeline";
import type { CrawlerConfiguration } from "./config";

export type CrawlOutcome = Readonly<{
  status: "succeeded" | "failed" | "skipped";
  errorCount: number;
  errorSummary: string | null;
  jobsDeactivated: number;
  jobsDiscovered: number;
  jobsNew: number;
  jobsUnchanged: number;
  jobsUpdated: number;
  reason: string | null;
}>;

export type CrawlOptions = Readonly<{
  source: JobSource;
  configuration: CrawlerConfiguration;
  dryRun?: boolean;
  now?: Date;
}>;

export async function runSourceCrawl(options: CrawlOptions): Promise<CrawlOutcome> {
  const source = options.source;

  if (!options.configuration.catalogEnabled) {
    logger.info({
      event: "job_source_skipped",
      reason: "job catalog disabled",
      source: sourceKey(source),
    });
    return {
      errorCount: 0,
      errorSummary: null,
      jobsDeactivated: 0,
      jobsDiscovered: 0,
      jobsNew: 0,
      jobsUnchanged: 0,
      jobsUpdated: 0,
      reason: "job catalog disabled",
      status: "skipped",
    };
  }

  if (!isCrawlable(source)) {
    const reason = source.status === "paused" ? "source paused" : "source archived";
    logger.info({ event: "job_source_skipped", reason, source: sourceKey(source) });
    return {
      errorCount: 0,
      errorSummary: null,
      jobsDeactivated: 0,
      jobsDiscovered: 0,
      jobsNew: 0,
      jobsUnchanged: 0,
      jobsUpdated: 0,
      reason,
      status: "skipped",
    };
  }

  const locked = await withCompanyCrawlLock(source.id, () => runLockedSourceCrawl(options));
  if (locked.acquired) return locked.result!;
  logger.info({
    event: "job_source_skipped",
    reason: "crawl already running",
    source: sourceKey(source),
  });
  return {
    errorCount: 0,
    errorSummary: null,
    jobsDeactivated: 0,
    jobsDiscovered: 0,
    jobsNew: 0,
    jobsUnchanged: 0,
    jobsUpdated: 0,
    reason: "crawl already running",
    status: "skipped",
  };
}

async function runLockedSourceCrawl(options: CrawlOptions): Promise<CrawlOutcome> {
  const now = options.now ?? new Date();
  const startedAt = Date.now();
  const configuration = options.configuration;
  const source = options.source;

  const connector = createConnectorForSource(source.sourceType);
  const httpClient = createHttpClient({
    timeoutMs: configuration.timeoutMs,
    userAgent: configuration.userAgent,
  });
  const robotsGate = new RobotsGate({
    cacheTtlMs: configuration.robotsCacheTtlMs,
    httpClient,
  });

  if (options.dryRun) {
    logger.info({ event: "job_crawl_dry_run_started", source: sourceKey(source) });
  }

  let runId: string | null = null;
  if (!options.dryRun) {
    try {
      runId = await withCrawlerRole((transaction) =>
        startIngestionRun(
          transaction,
          source.companyId,
          source.id,
          source.runRequestedAt ? "manual" : "scheduled",
        ),
      );
    } catch {
      return {
        errorCount: 1,
        errorSummary: "database_error",
        jobsDeactivated: 0,
        jobsDiscovered: 0,
        jobsNew: 0,
        jobsUnchanged: 0,
        jobsUpdated: 0,
        reason: "database_error",
        status: "failed",
      };
    }
  }

  let discovered: DiscoveredJob[] = [];
  let fetchError: Error | null = null;
  try {
    const connectorJobs = await connector.discoverJobs({
      company: source,
      httpClient,
      maxDetailPages: configuration.maxDetailPages,
      maxJobs: configuration.maxJobsPerSource,
      robotsGate,
    });
    discovered = connectorJobs.map(validateDiscoveredJob);
  } catch (error) {
    fetchError = error instanceof Error ? error : new Error("unknown_crawl_error");
  }

  if (fetchError) {
    const code = fetchError instanceof JobFetchError ? fetchError.code : "source_unavailable";
    const durationMs = Date.now() - startedAt;
    const outcome: SourceRunOutcome = {
      automaticPauseReason:
        source.consecutiveFailures + 1 >= configuration.failurePauseThreshold
          ? "repeated_failures"
          : null,
      consecutiveFailures: source.consecutiveFailures + 1,
      status: sourceStatusAfterFailure(
        source.consecutiveFailures + 1,
        configuration.failurePauseThreshold,
      ),
      lastCheckedAt: now,
      lastSuccessfulCheckAt: null,
      nextCheckAt: nextCheckAtWithJitter(source.crawlFrequencyMinutes, now),
    };
    if (!options.dryRun) {
      await withCrawlerRole(async (transaction) => {
        await finishIngestionRun(transaction, runId!, {
          durationMs,
          errorCount: 1,
          errorSummary: code,
          jobsDeactivated: 0,
          jobsDiscovered: 0,
          jobsNew: 0,
          jobsUnchanged: 0,
          jobsUpdated: 0,
          metadata: { errorCode: code },
          status: "failed",
        });
        await recordSourceEvent(
          transaction,
          source.companyId,
          "crawl_failed",
          code,
          {
            consecutiveFailures: outcome.consecutiveFailures,
          },
          source.id,
        );
        if (code === "robots_blocked") {
          await recordSourceEvent(
            transaction,
            source.companyId,
            "robots_blocked",
            null,
            {},
            source.id,
          );
        }
        if (outcome.status === "paused") {
          await recordSourceEvent(
            transaction,
            source.companyId,
            "source_paused",
            "repeated failures",
            {
              threshold: configuration.failurePauseThreshold,
            },
            source.id,
          );
        }
        await updateJobSourceAfterRun(transaction, source.id, outcome);
        const target = source.crawlEndpointUrl ? "endpoint" : "landing";
        await recordJobSourceHealth(
          transaction,
          source.id,
          target,
          sourceUrlHealthAfterCheck(uncheckedUrlHealth, {
            checkedAt: now,
            errorCode: code,
            requestedUrl: source.crawlEndpointUrl ?? source.careersUrl,
            statusCode:
              fetchError instanceof JobFetchError ? (fetchError.statusCode ?? null) : null,
          }),
        );
      });
    }
    logger.warn({
      durationMs,
      errorCode: code,
      event: "job_source_crawl_failed",
      source: sourceKey(source),
    });
    return {
      errorCount: 1,
      errorSummary: code,
      jobsDeactivated: 0,
      jobsDiscovered: 0,
      jobsNew: 0,
      jobsUnchanged: 0,
      jobsUpdated: 0,
      reason: code,
      status: "failed",
    };
  }

  try {
    const existing = await withCrawlerRole((transaction) =>
      listJobsForSource(transaction, source.id),
    );
    const plan = planCrawlChanges(existing.map(existingRecord), discovered, {
      missingCrawlThreshold: configuration.missingCrawlThreshold,
    });

    let newIds: string[] = [];
    let updatedIds: string[] = [];
    let reactivatedIds: string[] = [];
    if (!options.dryRun) {
      const applied = await withCrawlerRole((transaction) =>
        applyCrawlPlan(transaction, source.companyId, plan, {
          missingCrawlThreshold: configuration.missingCrawlThreshold,
          now,
          slugFor: (job, companySlug) => slugifyTitle(job.title, companySlug),
          classifyFor: classifyDiscoveredJob,
          sourceId: source.id,
        }),
      );
      newIds = applied.newIds;
      updatedIds = applied.updatedIds;
      reactivatedIds = applied.reactivatedIds;
    }

    const durationMs = Date.now() - startedAt;
    const outcome: SourceRunOutcome = {
      consecutiveFailures: 0,
      status: "active",
      lastCheckedAt: now,
      lastSuccessfulCheckAt: now,
      nextCheckAt: nextCheckAtWithJitter(source.crawlFrequencyMinutes, now),
    };

    if (!options.dryRun) {
      await withCrawlerRole(async (transaction) => {
        await finishIngestionRun(transaction, runId!, {
          durationMs,
          errorCount: 0,
          errorSummary: null,
          jobsDeactivated: plan.deactivate.length,
          jobsDiscovered: discovered.length,
          jobsNew: plan.insert.length,
          jobsUnchanged: plan.touch.length,
          jobsUpdated: plan.update.length + reactivatedIds.length,
          metadata: {
            deactivatedIds: plan.deactivate.map((job) => job.id),
            newIds,
            reactivatedIds,
            updatedIds,
          },
          status: "succeeded",
        });
        if (plan.deactivate.length > 0) {
          await recordSourceEvent(
            transaction,
            source.companyId,
            "job_deactivated",
            `${plan.deactivate.length} jobs no longer listed`,
            { ids: plan.deactivate.map((job) => job.id) },
            source.id,
          );
        }
        if (reactivatedIds.length > 0) {
          await recordSourceEvent(
            transaction,
            source.companyId,
            "job_reactivated",
            `${reactivatedIds.length} jobs relisted`,
            { ids: reactivatedIds },
            source.id,
          );
        }
        if (discovered.length === 0) {
          await recordSourceEvent(
            transaction,
            source.companyId,
            "listing_empty",
            null,
            {},
            source.id,
          );
        }
        await updateJobSourceAfterRun(transaction, source.id, outcome);
        const checkedUrl = source.crawlEndpointUrl ?? source.careersUrl;
        await recordJobSourceHealth(
          transaction,
          source.id,
          source.crawlEndpointUrl ? "endpoint" : "landing",
          sourceUrlHealthAfterCheck(uncheckedUrlHealth, {
            checkedAt: now,
            finalUrl: checkedUrl,
            requestedUrl: checkedUrl,
            statusCode: 200,
          }),
        );
      });
    }

    logger.info({
      durationMs,
      event: "job_source_crawl_succeeded",
      jobsDeactivated: plan.deactivate.length,
      jobsDiscovered: discovered.length,
      jobsNew: plan.insert.length,
      jobsUnchanged: plan.touch.length,
      jobsUpdated: plan.update.length,
      source: sourceKey(source),
    });

    return {
      errorCount: 0,
      errorSummary: null,
      jobsDeactivated: plan.deactivate.length,
      jobsDiscovered: discovered.length,
      jobsNew: plan.insert.length,
      jobsUnchanged: plan.touch.length,
      jobsUpdated: plan.update.length,
      reason: null,
      status: "succeeded",
    };
  } catch {
    const durationMs = Date.now() - startedAt;
    const failureOutcome: SourceRunOutcome = {
      automaticPauseReason:
        source.consecutiveFailures + 1 >= configuration.failurePauseThreshold
          ? "repeated_failures"
          : null,
      consecutiveFailures: source.consecutiveFailures + 1,
      status: sourceStatusAfterFailure(
        source.consecutiveFailures + 1,
        configuration.failurePauseThreshold,
      ),
      lastCheckedAt: now,
      lastSuccessfulCheckAt: null,
      nextCheckAt: nextCheckAtWithJitter(source.crawlFrequencyMinutes, now),
    };
    if (!options.dryRun && runId) {
      try {
        await withCrawlerRole(async (transaction) => {
          await finishIngestionRun(transaction, runId!, {
            durationMs,
            errorCount: 1,
            errorSummary: "database_error",
            jobsDeactivated: 0,
            jobsDiscovered: discovered.length,
            jobsNew: 0,
            jobsUnchanged: 0,
            jobsUpdated: 0,
            metadata: { errorCode: "database_error" },
            status: "failed",
          });
          await recordSourceEvent(
            transaction,
            source.companyId,
            "crawl_failed",
            "database_error",
            {},
            source.id,
          );
          await updateJobSourceAfterRun(transaction, source.id, failureOutcome);
        });
      } catch {
        logger.error({ event: "job_source_failure_recording_failed", source: sourceKey(source) });
      }
    }
    logger.error({
      event: "job_source_crawl_failed",
      errorCode: "database_error",
      source: sourceKey(source),
    });
    return {
      errorCount: 1,
      errorSummary: "database_error",
      jobsDeactivated: 0,
      jobsDiscovered: discovered.length,
      jobsNew: 0,
      jobsUnchanged: 0,
      jobsUpdated: 0,
      reason: "database_error",
      status: "failed",
    };
  }
}

const uncheckedUrlHealth: SourceUrlHealth = {
  checkedAt: null,
  errorCode: null,
  finalUrl: null,
  invalidSince: null,
  status: "unchecked",
  statusCode: null,
};

function sourceStatusAfterFailure(failures: number, pauseThreshold: number): SourceStatus {
  return failures >= pauseThreshold ? "paused" : "active";
}

function validateDiscoveredJob(job: DiscoveredJob): DiscoveredJob {
  const applicationUrl = canonicalizeJobUrl(job.applicationUrl);
  const sourceUrl = job.sourceUrl === null ? null : canonicalizeJobUrl(job.sourceUrl);
  const title = job.title.trim();
  const externalJobId = job.externalJobId?.trim() || null;
  const payloadIsObject =
    typeof job.sourcePayload === "object" &&
    job.sourcePayload !== null &&
    !Array.isArray(job.sourcePayload);
  const validDate = (date: Date | null): boolean => date === null || !Number.isNaN(date.getTime());
  const validNumber = (value: number | null): boolean => value === null || Number.isFinite(value);
  if (
    !applicationUrl ||
    (job.sourceUrl !== null && !sourceUrl) ||
    title.length === 0 ||
    title.length > 300 ||
    (externalJobId !== null && externalJobId.length > 500) ||
    !payloadIsObject ||
    !validDate(job.applicationDeadline) ||
    !validDate(job.postedAt) ||
    !validNumber(job.salaryMin) ||
    !validNumber(job.salaryMax) ||
    (job.salaryMin !== null && job.salaryMin < 0) ||
    (job.salaryMax !== null && job.salaryMax < 0) ||
    (job.salaryMin !== null && job.salaryMax !== null && job.salaryMax < job.salaryMin)
  ) {
    throw new JobFetchError("parser_changed", "connector returned an invalid job record");
  }
  return { ...job, applicationUrl, externalJobId, sourceUrl, title };
}
