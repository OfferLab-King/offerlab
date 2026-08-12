import {
  withApplicationRole,
  withApplicationUser,
} from "../../../infrastructure/database/runtime-connections";
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

export type JobCatalogAdminView = Readonly<{
  sources: readonly JobSourceAdminRow[];
  classificationQueue: readonly ClassificationQueueRow[];
  eligibilityQueue: readonly EligibilityQueueRow[];
  recentEvents: readonly RecentEventRow[];
  recentRuns: readonly RecentRunRow[];
}>;

export type EligibilityQueueRow = Readonly<{
  company_name: string;
  eligibility_evidence: string | null;
  eligibility_reasons: readonly string[];
  eligibility_status: string;
  id: string;
  opportunity_type: string;
  title: string;
  updated_at: Date;
}>;

export type ClassificationQueueRow = Readonly<{
  company_name: string;
  id: string;
  opportunity_type: string;
  sector_key: string | null;
  subsector_key: string | null;
  title: string;
  updated_at: Date;
}>;

export async function readJobCatalogAdmin(): Promise<JobCatalogAdminView> {
  return withApplicationRole(async (database) => {
    const [sources, recentRuns, recentEvents, eligibilityQueue, classificationQueue] =
      await Promise.all([
        listJobSourcesForAdmin(database),
        listRecentRuns(database, 25),
        listRecentEvents(database, 25),
        listEligibilityReviewQueue(database, 50),
        listClassificationReviewQueue(database, 50),
      ]);
    return {
      classificationQueue,
      sources,
      eligibilityQueue,
      recentEvents,
      recentRuns,
    };
  });
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
  const requested = await withApplicationUser(administratorUserId, (database) =>
    requestJobSourceRun(database, sourceId, administratorUserId),
  );
  if (!requested) throw new Error("job_source_not_active");
  await insertAuditEvent(administratorUserId, "job_source.run_requested", "job_source", sourceId);
}

export async function updateSourceUrlsForAdmin(
  administratorUserId: string,
  sourceId: string,
  input: Readonly<{ careersUrl: string; crawlEndpointUrl: string | null }>,
): Promise<void> {
  const updated = await withApplicationUser(administratorUserId, (database) =>
    updateJobSourceUrls(database, sourceId, input.careersUrl, input.crawlEndpointUrl),
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
