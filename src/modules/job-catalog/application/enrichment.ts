import { JOB_ENRICHMENT_PROMPT_VERSION } from "../domain/enrichment-schema";
import type { JobEnrichmentInput } from "../domain/enrichment-schema";
import { withCompanyCrawlLock, withCrawlerRole } from "../infrastructure/crawler-database";
import {
  createEnrichmentProvider,
  type EnrichmentConfiguration as ProviderConfiguration,
} from "../infrastructure/enrichment-provider";
import {
  listPendingEnrichment,
  markEnrichmentCompleted,
  markEnrichmentFailed,
} from "../infrastructure/job-repository";
import { recordSourceEvent } from "../infrastructure/ingestion-run-repository";
import { logger } from "../infrastructure/logging";
import type { EnrichmentConfiguration } from "./config";

export type EnrichmentBatchOutcome = Readonly<{
  completed: number;
  failed: number;
  processed: number;
  skipped: number;
}>;

export type EnrichmentBatchOptions = Readonly<{
  configuration: EnrichmentConfiguration;
  dryRun?: boolean;
  environment?: NodeJS.ProcessEnv;
}>;

export async function runEnrichmentBatch(
  options: EnrichmentBatchOptions,
): Promise<EnrichmentBatchOutcome> {
  const configuration = options.configuration;
  if (!configuration.catalogEnabled) {
    logger.info({ event: "job_enrichment_disabled", reason: "job catalog disabled" });
    return { completed: 0, failed: 0, processed: 0, skipped: 0 };
  }
  if (!configuration.llmEnabled) {
    logger.info({ event: "job_enrichment_disabled" });
    return { completed: 0, failed: 0, processed: 0, skipped: 0 };
  }
  const locked = await withCompanyCrawlLock("job-enrichment-worker", () =>
    runLockedEnrichmentBatch(options),
  );
  if (locked.acquired) return locked.result!;
  logger.info({ event: "job_enrichment_skipped", reason: "enrichment already running" });
  return { completed: 0, failed: 0, processed: 0, skipped: 0 };
}

async function runLockedEnrichmentBatch(
  options: EnrichmentBatchOptions,
): Promise<EnrichmentBatchOutcome> {
  const configuration = options.configuration;
  const environment = options.environment ?? process.env;
  const providerName: "deepseek" | "opencode_go" =
    environment.JOB_ENRICHMENT_PROVIDER === "opencode_go" ? "opencode_go" : "deepseek";
  const apiKey =
    providerName === "opencode_go" ? environment.OPENCODE_API_KEY : environment.DEEPSEEK_API_KEY;
  const baseUrl =
    environment.JOB_ENRICHMENT_BASE_URL ??
    (providerName === "opencode_go"
      ? "https://opencode.ai/zen/go/v1"
      : environment.DEEPSEEK_BASE_URL);
  const model =
    environment.JOB_ENRICHMENT_MODEL ??
    (providerName === "opencode_go" ? "deepseek-v4-flash" : environment.DEEPSEEK_MODEL);
  if (!apiKey || !baseUrl || !model) {
    logger.error({ event: "job_enrichment_not_configured" });
    return { completed: 0, failed: 0, processed: 0, skipped: 0 };
  }
  if (configuration.promptVersion !== JOB_ENRICHMENT_PROMPT_VERSION) {
    logger.warn({
      event: "job_enrichment_prompt_version_mismatch",
      configured: configuration.promptVersion,
      expected: JOB_ENRICHMENT_PROMPT_VERSION,
    });
  }

  const providerConfiguration: ProviderConfiguration = {
    apiKey,
    baseUrl,
    model,
    providerName,
    timeoutMs: 30_000,
  };
  const provider = createEnrichmentProvider(providerConfiguration);
  const candidates = await withCrawlerRole((transaction) =>
    listPendingEnrichment(transaction, configuration.batchLimit),
  );

  if (options.dryRun) {
    logger.info({ event: "job_enrichment_dry_run", candidates: candidates.length });
    return { completed: 0, failed: 0, processed: 0, skipped: candidates.length };
  }

  let completed = 0;
  let failed = 0;
  const queue = [...candidates];
  const workerCount = Math.max(1, Math.min(configuration.llmMaxConcurrency, candidates.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (queue.length > 0) {
      const candidate = queue.shift()!;
      const input: JobEnrichmentInput = {
        applicationDeadline: candidate.application_deadline?.toISOString() ?? null,
        descriptionText: candidate.description_text,
        employmentType: candidate.employment_type,
        locationText: candidate.location_text,
        postedAt: candidate.posted_at?.toISOString() ?? null,
        remoteType: candidate.remote_type,
        salaryCurrency: candidate.salary_currency,
        salaryMax: candidate.salary_max === null ? null : Number(candidate.salary_max),
        salaryMin: candidate.salary_min === null ? null : Number(candidate.salary_min),
        title: candidate.title,
      };
      const startedAt = Date.now();
      try {
        const result = await provider.enrich(input);
        await withCrawlerRole((transaction) =>
          markEnrichmentCompleted(transaction, candidate.id, {
            inputTokens: result.inputTokens,
            latencyMs: result.latencyMs,
            model,
            output: {
              ...result.output,
              essentialRequirements: result.output.essentialRequirements,
              skills: result.output.coreSkills,
            },
            outputTokens: result.outputTokens,
            version: result.version,
          }),
        );
        completed += 1;
        logger.info({
          durationMs: Date.now() - startedAt,
          event: "job_enriched",
          jobId: candidate.id,
          status: "completed",
        });
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : "enrichment_error";
        await withCrawlerRole(async (transaction) => {
          await markEnrichmentFailed(transaction, candidate.id, message);
          await recordSourceEvent(
            transaction,
            candidate.company_id,
            "enrichment_failed",
            message.slice(0, 500),
            {},
          );
        });
        logger.warn({
          event: "job_enrichment_failed",
          jobId: candidate.id,
          reason: message.slice(0, 200),
          status: "failed",
        });
      }
    }
  });
  await Promise.all(workers);

  return { completed, failed, processed: candidates.length, skipped: 0 };
}
