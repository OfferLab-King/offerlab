import "server-only";
import { captureAnalyticsEvent } from "../../../infrastructure/analytics/capture";
import {
  withApplicationRole,
  withApplicationUser,
} from "../../../infrastructure/database/runtime-connections";
import { normalizeSearch, resourceTypes, SEARCH_QUERY_LIMIT } from "../domain/resource";
import { LIBRARY_PAGE_SIZE } from "../domain/resource";
import {
  findPublishedResource,
  listLibraryTaxonomy,
  listPublishedResources,
  mutateMemberResourceState,
  type LibraryFilters,
} from "../infrastructure/resource-repository";
import { detectNewPathCompletions } from "../../learning-paths/application/learning-paths";

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
export const readLibraryPage = async (ownerId: string, filters: LibraryFilters) => {
  const resources = await withApplicationUser(ownerId, (db) =>
    listPublishedResources(db, ownerId, filters, LIBRARY_PAGE_SIZE + 1),
  );
  return {
    hasNextPage: resources.length > LIBRARY_PAGE_SIZE,
    resources: resources.slice(0, LIBRARY_PAGE_SIZE),
  } as const;
};
export const readMemberResource = (ownerId: string, slug: string) =>
  withApplicationUser(ownerId, (db) => findPublishedResource(db, slug, ownerId));
export const readLibraryTaxonomy = (ownerId: string) =>
  withApplicationUser(ownerId, listLibraryTaxonomy);
export const readPublicResource = (slug: string) =>
  withApplicationRole((db) => findPublishedResource(db, slug, null));

export const readPublicResourceList = () =>
  withApplicationRole((db) =>
    listPublishedResources(db, null, { page: 1, query: "", queryInvalid: false, saved: false }),
  );
export async function changeResourceState(
  ownerId: string,
  resourceId: string,
  action: "save" | "unsave" | "complete" | "incomplete",
) {
  const mutation = await withApplicationUser(ownerId, async (db) => {
    const found = await db<
      { id: string }[]
    >`select id from app.preparation_resource where id=${resourceId}::uuid and publication_state='published'`;
    if (!found[0]) return { outcome: "not_found" } as const;
    if (action !== "complete")
      return {
        newlyCompletedPathCount: 0,
        result: await mutateMemberResourceState(db, ownerId, resourceId, action),
      } as const;
    return detectNewPathCompletions(db, ownerId, resourceId, () =>
      mutateMemberResourceState(db, ownerId, resourceId, action),
    );
  });
  if (!("result" in mutation)) return mutation;
  const result = mutation.result;
  const analytics = {
    saved: "resource_saved",
    unsaved: "resource_unsaved",
    completed: "resource_completed",
    marked_incomplete: "resource_marked_incomplete",
  } as const;
  if (result.outcome in analytics)
    await captureAnalyticsEvent(analytics[result.outcome as keyof typeof analytics]);
  if (result.outcome === "completed")
    for (let index = 0; index < mutation.newlyCompletedPathCount; index += 1)
      await captureAnalyticsEvent("learning_path_completed");
  return result;
}
