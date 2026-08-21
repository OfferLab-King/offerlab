import { classifyDiscoveredJob } from "./classification-pipeline";
import { withCrawlerRole } from "../infrastructure/crawler-database";
import {
  applyDeterministicClassification,
  listJobsForReclassification,
  type ReclassificationRow,
} from "../infrastructure/job-repository";
import type { DiscoveredJob } from "../domain/deduplication";
import { workdayLocationTextWithPathHint } from "../domain/workday-location";

export type ReclassificationResult = Readonly<{
  processed: number;
  skipped: number;
}>;

export function discoveredJobFromReclassificationRow(row: ReclassificationRow): DiscoveredJob {
  const externalPath = sourcePayloadString(row.source_payload, "externalPath");
  return {
    applicationDeadline: row.application_deadline,
    applicationUrl: "https://invalid.offerlab.internal/reclassification",
    descriptionText: row.description_text ?? "",
    employmentType: null,
    externalJobId: null,
    locationText: workdayLocationTextWithPathHint(row.location_text ?? "", externalPath),
    locations: row.locations,
    postedAt: null,
    remoteType: null,
    salaryCurrency: null,
    salaryMax: null,
    salaryMin: null,
    salaryPeriod: null,
    sourceUrl: "https://invalid.offerlab.internal/reclassification",
    sourcePayload: row.source_payload,
    title: row.title,
  };
}

function sourcePayloadString(payload: unknown, key: string): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const value = (payload as Readonly<Record<string, unknown>>)[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export async function reclassifyActiveJobs(): Promise<ReclassificationResult> {
  const rows = await withCrawlerRole((database) => listJobsForReclassification(database));
  let processed = 0;
  let skipped = 0;

  for (const row of rows) {
    if (row.classification_source === "administrator") {
      skipped += 1;
      continue;
    }
    const classification = classifyDiscoveredJob(discoveredJobFromReclassificationRow(row));
    await withCrawlerRole((database) =>
      applyDeterministicClassification(database, row.id, classification),
    );
    processed += 1;
  }

  return { processed, skipped };
}
