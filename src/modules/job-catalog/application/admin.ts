import {
  withApplicationRole,
  withApplicationUser,
} from "../../../infrastructure/database/runtime-connections";
import {
  listCompaniesForAdmin,
  recordSourceReview,
  setCompanyCrawlAllowed,
  setCompanyPaused,
  type CompanyAdminRow,
  type SourceReviewInput,
} from "../infrastructure/company-repository";
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
  companies: readonly CompanyAdminRow[];
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
    const [companies, recentRuns, recentEvents, eligibilityQueue, classificationQueue] =
      await Promise.all([
        listCompaniesForAdmin(database),
        listRecentRuns(database, 25),
        listRecentEvents(database, 25),
        listEligibilityReviewQueue(database, 50),
        listClassificationReviewQueue(database, 50),
      ]);
    return {
      classificationQueue,
      companies,
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
  companyId: string,
  paused: boolean,
): Promise<void> {
  await withApplicationUser(administratorUserId, (database) =>
    setCompanyPaused(database, companyId, paused),
  );
  await insertAuditEvent(
    administratorUserId,
    paused ? "job_source.paused" : "job_source.resumed",
    "job_source",
    companyId,
  );
}

export async function setCompanyCrawlPermission(
  administratorUserId: string,
  companyId: string,
  crawlAllowed: "allowed" | "unknown" | "blocked",
): Promise<void> {
  await withApplicationUser(administratorUserId, (database) =>
    setCompanyCrawlAllowed(database, companyId, crawlAllowed),
  );
  await insertAuditEvent(
    administratorUserId,
    "job_source.permission_changed",
    "job_source",
    companyId,
  );
}

export async function recordCompanySourceReview(
  administratorUserId: string,
  companyId: string,
  input: Omit<SourceReviewInput, "reviewerUserId">,
): Promise<void> {
  await withApplicationUser(administratorUserId, (database) =>
    recordSourceReview(database, companyId, { ...input, reviewerUserId: administratorUserId }),
  );
  await insertAuditEvent(administratorUserId, "job_source.reviewed", "job_source", companyId);
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
