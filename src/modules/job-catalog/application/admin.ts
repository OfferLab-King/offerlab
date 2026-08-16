import { withApplicationUser } from "../../../infrastructure/database/runtime-connections";
import type { SourceStatus } from "../domain/source";
import {
  deriveSourceOperationalState,
  type LatestSourceRun,
  type SourceOperationalState,
} from "../domain/source-operational-state";
import {
  listJobSourcesForAdmin,
  requestJobSourceRun,
  setJobSourceStatus,
  updateJobSourceUrls,
  type JobSourceAdminRow,
} from "../infrastructure/job-source-repository";
import {
  listRecentEvents,
  listRecentRuns,
  type RecentEventRow,
  type RecentRunRow,
} from "../infrastructure/ingestion-run-repository";
import {
  listClassificationReviewQueue,
  listEligibilityReviewQueue,
  overrideJobClassification,
  type ClassificationOverrideInput,
} from "../infrastructure/job-repository";

export type JobSourceAdminViewRow = JobSourceAdminRow &
  Readonly<{
    operationalState: SourceOperationalState;
  }>;

export type JobCatalogAdminView = Readonly<{
  sources: readonly JobSourceAdminViewRow[];
  classificationQueue: readonly ClassificationQueueRow[];
  eligibilityQueue: readonly EligibilityQueueRow[];
  recentEvents: readonly RecentEventRow[];
  recentRuns: readonly RecentRunRow[];
}>;

export type EligibilityQueueRow = Readonly<{
  application_url: string;
  company_name: string;
  eligibility_evidence: string | null;
  eligibility_reasons: readonly string[];
  eligibility_status: string;
  id: string;
  location_text: string | null;
  opportunity_type: string;
  publication_status: string;
  title: string;
  updated_at: Date;
}>;

export type ClassificationQueueRow = Readonly<{
  company_name: string;
  id: string;
  opportunity_type: string;
  publication_status: string;
  sector_key: string | null;
  subsector_key: string | null;
  title: string;
  updated_at: Date;
}>;

export async function readJobCatalogAdmin(
  administratorUserId: string,
): Promise<JobCatalogAdminView> {
  return withApplicationUser(administratorUserId, async (database) => {
    const [sources, recentRuns, recentEvents, eligibilityQueue, classificationQueue] =
      await Promise.all([
        listJobSourcesForAdmin(database),
        listRecentRuns(database, 25),
        listRecentEvents(database, 25),
        listEligibilityReviewQueue(database, 200),
        listClassificationReviewQueue(database, 50),
      ]);
    return {
      classificationQueue,
      sources: sources.map((source) => ({
        ...source,
        operationalState: deriveSourceOperationalState({
          status: source.status as SourceStatus,
          runRequestedAt: source.run_requested_at,
          latestRun: latestRunOf(source),
        }),
      })),
      eligibilityQueue,
      recentEvents,
      recentRuns,
    };
  });
}

function latestRunOf(source: JobSourceAdminRow): LatestSourceRun | null {
  if (!source.latest_run_started_at) return null;
  return {
    status: source.latest_run_status as LatestSourceRun["status"],
    startedAt: source.latest_run_started_at,
    finishedAt: source.latest_run_finished_at,
    jobsDeactivated: source.latest_run_jobs_deactivated,
    jobsDiscovered: source.latest_run_jobs_discovered,
    jobsNew: source.latest_run_jobs_new,
    jobsUnchanged: source.latest_run_jobs_unchanged,
    jobsUpdated: source.latest_run_jobs_updated,
    errorSummary: source.latest_run_error_summary,
  };
}

async function insertAuditEvent(
  userId: string,
  action: string,
  entityType: "job_source" | "job",
  entityId: string,
): Promise<void> {
  await withApplicationUser(
    userId,
    (database) =>
      database`
      insert into app.audit_event (actor_user_id, action, entity_type, entity_id)
      values (${userId}::uuid, ${action}, ${entityType}, ${entityId}::uuid)
    `,
  );
}

export async function pauseCompanySource(
  administratorUserId: string,
  sourceId: string,
  paused: boolean,
): Promise<void> {
  await withApplicationUser(administratorUserId, (database) =>
    setJobSourceStatus(database, sourceId, paused ? "paused" : "active"),
  );
  await insertAuditEvent(
    administratorUserId,
    paused ? "job_source.paused" : "job_source.resumed",
    "job_source",
    sourceId,
  );
}

export async function requestSourceRunForAdmin(
  administratorUserId: string,
  sourceId: string,
): Promise<void> {
  const result = await withApplicationUser(administratorUserId, (database) =>
    requestJobSourceRun(database, sourceId, administratorUserId),
  );
  if (result === "unavailable") throw new Error("job_source_not_active");
  if (result === "already_requested") return;
  await insertAuditEvent(administratorUserId, "job_source.run_requested", "job_source", sourceId);
}

export async function updateSourceUrlsForAdmin(
  administratorUserId: string,
  sourceId: string,
  input: Readonly<{
    careersUrl: string;
    crawlEndpointUrl: string | null;
    configuration?: Readonly<Record<string, unknown>> | null;
  }>,
): Promise<void> {
  const updated = await withApplicationUser(administratorUserId, (database) =>
    updateJobSourceUrls(
      database,
      sourceId,
      input.careersUrl,
      input.crawlEndpointUrl,
      input.configuration ?? null,
    ),
  );
  if (!updated) throw new Error("job_source_not_found");
  await insertAuditEvent(administratorUserId, "job_source.updated", "job_source", sourceId);
}

export async function overrideJobClassificationForAdmin(
  administratorUserId: string,
  jobId: string,
  input: ClassificationOverrideInput,
): Promise<void> {
  await withApplicationUser(administratorUserId, (database) =>
    overrideJobClassification(database, jobId, input),
  );
  await insertAuditEvent(administratorUserId, "job.classification_changed", "job", jobId);
}

export async function overrideJobEligibilityBatchForAdmin(
  administratorUserId: string,
  jobIds: readonly string[],
  eligibilityStatus: "eligible" | "ineligible",
): Promise<number> {
  let applied = 0;
  await withApplicationUser(administratorUserId, async (database) => {
    for (const jobId of jobIds) {
      await overrideJobClassification(database, jobId, {
        eligibilityStatus,
        publicationStatus: eligibilityStatus === "eligible" ? "published" : "suppressed",
      });
      applied += 1;
    }
  });
  for (const jobId of jobIds) {
    await insertAuditEvent(administratorUserId, "job.eligibility_changed", "job", jobId);
  }
  return applied;
}

export async function overrideJobPublicationForAdmin(
  administratorUserId: string,
  jobId: string,
  publicationStatus: "published" | "suppressed" | "draft",
): Promise<void> {
  await withApplicationUser(administratorUserId, (database) =>
    overrideJobClassification(database, jobId, { publicationStatus }),
  );
  await insertAuditEvent(administratorUserId, "job.publication_changed", "job", jobId);
}
