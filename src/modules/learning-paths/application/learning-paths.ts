import "server-only";
import type { TransactionSql } from "postgres";
import { captureAnalyticsEvent } from "../../../infrastructure/analytics/capture";
import { withApplicationUser } from "../../../infrastructure/database/runtime-connections";
import {
  changeFollowing,
  completedPublishedPathIdsContainingResource,
  continueItem,
  findMemberPath,
  listMemberPaths,
  pathsForResource,
} from "../infrastructure/learning-path-repository";
export const readLearningPaths = (ownerId: string) =>
  withApplicationUser(ownerId, (db) => listMemberPaths(db, ownerId));
export async function readLearningPath(ownerId: string, slug: string) {
  const path = await withApplicationUser(ownerId, (db) => findMemberPath(db, ownerId, slug));
  if (path) await captureAnalyticsEvent("learning_path_opened");
  return path;
}
export const readPathsForResource = (ownerId: string, resourceId: string) =>
  withApplicationUser(ownerId, (db) => pathsForResource(db, resourceId));
export { continueItem };
export async function detectNewPathCompletions<T>(
  db: TransactionSql,
  ownerId: string,
  resourceId: string,
  mutation: () => Promise<T>,
) {
  const completedBefore = new Set(
    await completedPublishedPathIdsContainingResource(db, ownerId, resourceId),
  );
  const result = await mutation();
  const completedAfter = await completedPublishedPathIdsContainingResource(db, ownerId, resourceId);
  return {
    newlyCompletedPathCount: completedAfter.filter((id) => !completedBefore.has(id)).length,
    result,
  } as const;
}
export async function setPathFollowing(ownerId: string, pathId: string, follow: boolean) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(pathId))
    return "not_found" as const;
  const outcome = await withApplicationUser(ownerId, async (db) => {
    const path = await db<
      { id: string }[]
    >`select id from app.learning_path where id=${pathId}::uuid and publication_state='published'`;
    return path[0] ? changeFollowing(db, ownerId, pathId, follow) : ("not_found" as const);
  });
  if (outcome === "changed")
    await captureAnalyticsEvent(follow ? "learning_path_started" : "learning_path_stopped");
  return outcome;
}
