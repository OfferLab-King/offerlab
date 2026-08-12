import type { DiscoveredJob } from "../../domain/deduplication";
import type { JobSource, SourceCompany, SourceType } from "../../domain/source";
import type { HttpClient } from "./http-client";
import type { RobotsGate } from "./robots";

export type { DiscoveredJob };

export type ConnectorSource = JobSource | SourceCompany;

export type ConnectorContext = Readonly<{
  company: ConnectorSource;
  httpClient: HttpClient;
  robotsGate: RobotsGate;
  maxJobs: number;
  maxDetailPages: number;
}>;

export interface JobSourceConnector {
  readonly sourceType: SourceType;
  readonly name: string;
  discoverJobs(context: ConnectorContext): Promise<DiscoveredJob[]>;
  healthCheck(context: ConnectorContext): Promise<void>;
}

export function connectorConfiguration(
  company: ConnectorSource,
): Readonly<Record<string, unknown>> {
  return company.configuration;
}

export function connectorToken(company: ConnectorSource, key: string): string | null {
  const value = company.configuration[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function parseOptionalDate(value: unknown): Date | null {
  if (typeof value === "string" && value.length > 0) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export function limited<T>(items: readonly T[], max: number): T[] {
  return items.slice(0, max);
}

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.max(1, Math.min(concurrency, items.length)) },
    async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        results[index] = await mapper(items[index]!, index);
      }
    },
  );
  await Promise.all(workers);
  return results;
}
