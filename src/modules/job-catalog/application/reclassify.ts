import { classifyDiscoveredJob } from "./classification-pipeline";
import { withCrawlerRole } from "../infrastructure/crawler-database";
import {
  applyDeterministicClassification,
  listJobsForReclassification,
} from "../infrastructure/job-repository";
import type { DiscoveredJob } from "../domain/deduplication";

export type ReclassificationResult = Readonly<{
  processed: number;
  skipped: number;
}>;

export async function reclassifyActiveJobs(): Promise<ReclassificationResult> {
  const rows = await withCrawlerRole((database) => listJobsForReclassification(database));
  let processed = 0;
  let skipped = 0;

  for (const row of rows) {
    if (row.classification_source === "administrator") {
      skipped += 1;
      continue;
    }
    const discovered: DiscoveredJob = {
      applicationDeadline: row.application_deadline,
      applicationUrl: "https://invalid.offerlab.internal/reclassification",
      descriptionText: row.description_text ?? "",
      employmentType: null,
      externalJobId: null,
      locationText: "",
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
    const classification = classifyDiscoveredJob(discovered);
    await withCrawlerRole((database) =>
      applyDeterministicClassification(database, row.id, classification),
    );
    processed += 1;
  }

  return { processed, skipped };
}
