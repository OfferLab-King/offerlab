import type { DiscoveredJob } from "../../domain/deduplication";
import type { SourceCompany, SourceType } from "../../domain/source";
import type { HttpClient } from "./http-client";
import type { RobotsGate } from "./robots";

export type { DiscoveredJob };

export type ConnectorContext = Readonly<{
  company: SourceCompany;
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

export function connectorConfiguration(company: SourceCompany): Readonly<Record<string, unknown>> {
  return company.configuration;
}

export function connectorToken(company: SourceCompany, key: string): string | null {
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
