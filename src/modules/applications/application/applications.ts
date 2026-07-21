import "server-only";

import type { TransactionSql } from "postgres";

import { captureAnalyticsEvent } from "../../../infrastructure/analytics/capture";
import { withApplicationUser } from "../../../infrastructure/database/runtime-connections";
import { parseApplicationInput } from "../domain/application";
import {
  createApplication,
  findApplication,
  listApplications,
  lockApplication,
  setApplicationArchived,
  updateApplication,
  type ApplicationMutationResult,
  type TrackedApplication,
} from "../infrastructure/application-repository";

const analyticsByOutcome = {
  archived: "application_archived",
  created: "application_created",
  restored: "application_restored",
  stage_changed: "application_stage_changed",
  updated: "application_updated",
} as const;

async function captureResult(result: ApplicationMutationResult): Promise<void> {
  if (result.outcome in analyticsByOutcome) {
    await captureAnalyticsEvent(
      analyticsByOutcome[result.outcome as keyof typeof analyticsByOutcome],
    );
  }
}

export async function readApplications(
  ownerId: string,
  archived = false,
): Promise<readonly TrackedApplication[]> {
  return withApplicationUser(ownerId, (database) => listApplications(database, ownerId, archived));
}

export async function readApplication(
  ownerId: string,
  applicationId: string,
): Promise<TrackedApplication | null> {
  return withApplicationUser(ownerId, (database) =>
    findApplication(database, ownerId, applicationId),
  );
}

/**
 * Public applications-module contract for a recommendation-state mutation.
 * The caller supplies its transaction so the stage/archive check, state write,
 * and audit event share one database snapshot and commit boundary.
 */
export async function lockApplicationForRecommendationMutation(
  database: TransactionSql,
  ownerId: string,
  applicationId: string,
): Promise<RecommendationApplicationContext | null> {
  const application = await lockApplication(database, ownerId, applicationId);
  return application ? recommendationApplicationContext(application) : null;
}

export type RecommendationApplicationContext = Readonly<{
  applicationDeadline: string | null;
  appliedDate: string | null;
  archivedAt: Date | null;
  id: string;
  nextStageDeadline: string | null;
  opportunityType: TrackedApplication["opportunityType"];
  stage: TrackedApplication["stage"];
}>;

export function recommendationApplicationContext(
  application: TrackedApplication,
): RecommendationApplicationContext {
  return {
    applicationDeadline: application.applicationDeadline,
    appliedDate: application.appliedDate,
    archivedAt: application.archivedAt,
    id: application.id,
    nextStageDeadline: application.nextStageDeadline,
    opportunityType: application.opportunityType,
    stage: application.stage,
  };
}

export async function addApplication(ownerId: string, input: unknown) {
  const parsed = parseApplicationInput(input);
  if (!parsed.ok) return parsed;
  const result = await withApplicationUser(ownerId, (database) =>
    createApplication(database, ownerId, parsed.value.values),
  );
  await captureResult(result);
  return { ok: true, ...result } as const;
}

export async function editApplication(ownerId: string, applicationId: string, input: unknown) {
  const parsed = parseApplicationInput(input, true);
  if (!parsed.ok) return parsed;
  const result = await withApplicationUser(ownerId, (database) =>
    updateApplication(database, ownerId, applicationId, parsed.value.version!, parsed.value.values),
  );
  await captureResult(result);
  return { ok: true, ...result } as const;
}

export async function archiveApplication(ownerId: string, applicationId: string, input: unknown) {
  const parsed = parseArchiveInput(input);
  if (!parsed.ok) return parsed;
  const result = await withApplicationUser(ownerId, (database) =>
    setApplicationArchived(
      database,
      ownerId,
      applicationId,
      parsed.value.version,
      parsed.value.archive,
    ),
  );
  await captureResult(result);
  return { ok: true, ...result } as const;
}

function parseArchiveInput(
  input: unknown,
):
  | Readonly<{ errors: { version: readonly string[] }; ok: false }>
  | Readonly<{ ok: true; value: { archive: boolean; version: number } }> {
  if (
    typeof input !== "object" ||
    input === null ||
    Object.keys(input).some((key) => key !== "archive" && key !== "version") ||
    typeof (input as { archive?: unknown }).archive !== "boolean" ||
    !Number.isInteger((input as { version?: unknown }).version) ||
    ((input as { version: number }).version ?? 0) <= 0
  ) {
    return { errors: { version: ["Reload this application and try again."] }, ok: false };
  }
  return {
    ok: true,
    value: {
      archive: (input as { archive: boolean }).archive,
      version: (input as { version: number }).version,
    },
  };
}
