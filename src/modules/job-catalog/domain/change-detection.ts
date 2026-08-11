import { hashJobContent, type CanonicalJobContent } from "./content-hash";
import { resolveJobIdentity, type DiscoveredJob, type ExistingJobIdentity } from "./deduplication";

export type ExistingJobRecord = ExistingJobIdentity &
  Readonly<{
    active: boolean;
    contentHash: string;
    missedCrawls: number;
    lastSeenAt: Date;
  }>;

export type CrawlChangePlan = Readonly<{
  insert: readonly DiscoveredJob[];
  update: readonly Readonly<{ existing: ExistingJobRecord; discovered: DiscoveredJob }>[];
  touch: readonly ExistingJobRecord[];
  deactivate: readonly ExistingJobRecord[];
  reactivate: readonly Readonly<{ existing: ExistingJobRecord; discovered: DiscoveredJob }>[];
  incrementMissed: readonly ExistingJobRecord[];
}>;

export function jobContentForHash(discovered: DiscoveredJob): CanonicalJobContent {
  return {
    applicationDeadline: discovered.applicationDeadline?.toISOString() ?? null,
    applicationUrl: discovered.applicationUrl,
    descriptionText: discovered.descriptionText,
    employmentType: discovered.employmentType,
    externalJobId: discovered.externalJobId,
    locationText: discovered.locationText,
    postedAt: discovered.postedAt?.toISOString() ?? null,
    remoteType: discovered.remoteType,
    salaryCurrency: discovered.salaryCurrency,
    salaryMax: discovered.salaryMax,
    salaryMin: discovered.salaryMin,
    salaryPeriod: discovered.salaryPeriod,
    title: discovered.title,
  };
}

export function contentHashForDiscovered(discovered: DiscoveredJob): string {
  return hashJobContent(jobContentForHash(discovered));
}

export const DEFAULT_MISSING_CRAWL_THRESHOLD = 2;

export function planCrawlChanges(
  existingJobs: readonly ExistingJobRecord[],
  discoveredJobs: readonly DiscoveredJob[],
  options: Readonly<{
    missingCrawlThreshold?: number;
    fullListing?: boolean;
  }> = {},
): CrawlChangePlan {
  const threshold = options.missingCrawlThreshold ?? DEFAULT_MISSING_CRAWL_THRESHOLD;
  const fullListing = options.fullListing ?? true;
  const insert: DiscoveredJob[] = [];
  const update: { existing: ExistingJobRecord; discovered: DiscoveredJob }[] = [];
  const touch: ExistingJobRecord[] = [];
  const reactivate: { existing: ExistingJobRecord; discovered: DiscoveredJob }[] = [];
  const matchedExistingIds = new Set<string>();
  const plannedInserts: ExistingJobIdentity[] = [];

  for (const discovered of discoveredJobs) {
    const match = resolveJobIdentity(discovered, existingJobs);
    if (!match) {
      const duplicateInsert = resolveJobIdentity(discovered, plannedInserts);
      if (duplicateInsert) continue;
      insert.push(discovered);
      plannedInserts.push({
        applicationUrl: discovered.applicationUrl,
        externalJobId: discovered.externalJobId,
        id: `planned-${plannedInserts.length}`,
        locationText: discovered.locationText,
        sourceUrl: discovered.sourceUrl,
        title: discovered.title,
      });
      continue;
    }
    if (matchedExistingIds.has(match.existingId)) continue;
    matchedExistingIds.add(match.existingId);
    const existing = existingJobs.find((job) => job.id === match.existingId)!;
    if (!existing.active) {
      reactivate.push({ discovered, existing });
      continue;
    }
    const discoveredHash = contentHashForDiscovered(discovered);
    if (existing.contentHash === discoveredHash) {
      touch.push(existing);
    } else {
      update.push({ discovered, existing });
    }
  }

  const incrementMissed: ExistingJobRecord[] = [];
  const deactivate: ExistingJobRecord[] = [];
  if (fullListing && discoveredJobs.length > 0) {
    for (const existing of existingJobs) {
      if (!existing.active || matchedExistingIds.has(existing.id)) continue;
      const missed = existing.missedCrawls + 1;
      if (missed >= threshold) {
        deactivate.push(existing);
      } else {
        incrementMissed.push(existing);
      }
    }
  }

  return { deactivate, incrementMissed, insert, reactivate, touch, update };
}
