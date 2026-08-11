import { JOB_ENRICHMENT_PROMPT_VERSION } from "../domain/enrichment-schema";

export type CrawlerConfiguration = Readonly<{
  browserMaxConcurrency: number;
  catalogEnabled: boolean;
  failurePauseThreshold: number;
  llmEnabled: boolean;
  llmMaxConcurrency: number;
  maxConcurrency: number;
  maxDetailPages: number;
  maxJobsPerSource: number;
  missingCrawlThreshold: number;
  robotsCacheTtlMs: number;
  timeoutMs: number;
  userAgent: string;
}>;

export type EnrichmentConfiguration = Readonly<{
  batchLimit: number;
  catalogEnabled: boolean;
  llmEnabled: boolean;
  llmMaxConcurrency: number;
  promptVersion: number;
}>;

const DEFAULT_USER_AGENT =
  "OfferLabJobCrawler/1.0 (UK graduate job discovery; contact via website)";

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

type Environment = Readonly<Record<string, string | undefined>>;

export function readCrawlerConfiguration(environment: Environment): CrawlerConfiguration {
  return {
    browserMaxConcurrency: parsePositiveInteger(environment.JOB_BROWSER_MAX_CONCURRENCY, 1),
    catalogEnabled: environment.JOB_CATALOG_ENABLED === "true",
    failurePauseThreshold: parsePositiveInteger(environment.JOB_CRAWLER_FAILURE_PAUSE_THRESHOLD, 5),
    llmEnabled: environment.JOB_LLM_ENABLED === "true",
    llmMaxConcurrency: parsePositiveInteger(environment.JOB_LLM_MAX_CONCURRENCY, 2),
    maxConcurrency: parsePositiveInteger(environment.JOB_CRAWLER_MAX_CONCURRENCY, 2),
    maxDetailPages: parsePositiveInteger(environment.JOB_CRAWLER_MAX_DETAIL_PAGES, 40),
    maxJobsPerSource: parsePositiveInteger(environment.JOB_CRAWLER_MAX_JOBS_PER_SOURCE, 500),
    missingCrawlThreshold: parsePositiveInteger(environment.JOB_CRAWLER_MISSING_THRESHOLD, 2),
    robotsCacheTtlMs: parsePositiveInteger(
      environment.JOB_CRAWLER_ROBOTS_CACHE_TTL_MS,
      6 * 60 * 60_000,
    ),
    timeoutMs: parsePositiveInteger(environment.JOB_CRAWLER_TIMEOUT_MS, 20_000),
    userAgent: environment.JOB_CRAWLER_USER_AGENT ?? DEFAULT_USER_AGENT,
  };
}

export function isJobCatalogEnabled(environment: Environment = process.env): boolean {
  return environment.JOB_CATALOG_ENABLED === "true";
}

export function readEnrichmentConfiguration(environment: Environment): EnrichmentConfiguration {
  const crawler = readCrawlerConfiguration(environment);
  return {
    batchLimit: parsePositiveInteger(environment.JOB_ENRICHMENT_BATCH_LIMIT, 20),
    catalogEnabled: crawler.catalogEnabled,
    llmEnabled: crawler.llmEnabled,
    llmMaxConcurrency: crawler.llmMaxConcurrency,
    promptVersion: parsePositiveInteger(
      environment.JOB_ENRICHMENT_PROMPT_VERSION,
      JOB_ENRICHMENT_PROMPT_VERSION,
    ),
  };
}
