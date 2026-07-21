import "server-only";
import { captureAnalyticsEvent } from "../../../infrastructure/analytics/capture";
import {
  withApplicationRole,
  withApplicationUser,
} from "../../../infrastructure/database/runtime-connections";
import { normalizeSearch, resourceTypes, SEARCH_QUERY_LIMIT } from "../domain/resource";
import {
  findPublishedResource,
  listLibraryTaxonomy,
  listPublishedResources,
  mutateMemberResourceState,
  type LibraryFilters,
} from "../infrastructure/resource-repository";

const stages = new Set([
  "preparing",
  "applied",
  "online_assessment",
  "video_interview",
  "interview",
  "assessment_centre",
  "offer",
  "rejected",
  "withdrawn",
]);
const opportunityTypes = new Set([
  "graduate_scheme",
  "internship",
  "placement",
  "entry_level_role",
]);
export function parseLibraryFilters(params: URLSearchParams): LibraryFilters {
  const rawQuery = params.get("q") ?? "";
  const pageValue = Number(params.get("page") ?? "1");
  const type = params.get("type") ?? undefined;
  const stage = params.get("stage") ?? undefined;
  const completed = params.get("completed");
  return {
    ...(params.get("category") ? { category: params.get("category")!.slice(0, 120) } : {}),
    ...(completed === "complete" || completed === "incomplete" ? { completed } : {}),
    page: Number.isSafeInteger(pageValue) && pageValue > 0 ? Math.min(pageValue, 1000) : 1,
    ...(params.get("opportunityType") && opportunityTypes.has(params.get("opportunityType")!)
      ? { opportunityType: params.get("opportunityType")! }
      : {}),
    query: normalizeSearch(rawQuery),
    queryInvalid:
      rawQuery.normalize("NFC").trim().replace(/\s+/gu, " ").length > SEARCH_QUERY_LIMIT ||
      /[\u0000-\u001f\u007f]/u.test(rawQuery),
    saved: params.get("saved") === "1",
    ...(stage && stages.has(stage) ? { stage } : {}),
    ...(params.get("tag") ? { tag: params.get("tag")!.slice(0, 120) } : {}),
    ...(type && resourceTypes.includes(type as never) ? { type } : {}),
  };
}
export const readLibrary = (ownerId: string, filters: LibraryFilters) =>
  withApplicationUser(ownerId, (db) => listPublishedResources(db, ownerId, filters));
export const readMemberResource = (ownerId: string, slug: string) =>
  withApplicationUser(ownerId, (db) => findPublishedResource(db, slug, ownerId));
export const readLibraryTaxonomy = (ownerId: string) =>
  withApplicationUser(ownerId, listLibraryTaxonomy);
export const readPublicResource = (slug: string) =>
  withApplicationRole((db) => findPublishedResource(db, slug, null));
export async function changeResourceState(
  ownerId: string,
  resourceId: string,
  action: "save" | "unsave" | "complete" | "incomplete",
) {
  const result = await withApplicationUser(ownerId, async (db) => {
    const found = await db<
      { id: string }[]
    >`select id from app.preparation_resource where id=${resourceId}::uuid and publication_state='published'`;
    if (!found[0]) return { outcome: "not_found" } as const;
    return mutateMemberResourceState(db, ownerId, resourceId, action);
  });
  const analytics = {
    saved: "resource_saved",
    unsaved: "resource_unsaved",
    completed: "resource_completed",
    marked_incomplete: "resource_marked_incomplete",
  } as const;
  if (result.outcome in analytics)
    await captureAnalyticsEvent(analytics[result.outcome as keyof typeof analytics]);
  return result;
}
