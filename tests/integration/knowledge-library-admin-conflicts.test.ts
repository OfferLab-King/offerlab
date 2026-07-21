import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const analyticsCapture = vi.hoisted(() => vi.fn());
vi.mock("../../src/infrastructure/analytics/capture", () => ({
  captureAnalyticsEvent: analyticsCapture,
}));

import {
  updateResource,
  updateTaxonomy,
} from "../../src/modules/preparation-resources/application/admin-content";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const migration = postgres(databaseUrl, { max: 2, prepare: false });
const runtimeUrl = new URL(databaseUrl);
runtimeUrl.username = "offerlab_runtime_login";
runtimeUrl.password = "postgres";
process.env.DATABASE_URL = runtimeUrl.toString();

const adminId = "20000000-0000-4000-8000-000000000001";
let categoryId = "";
let tagId = "";
let resourceId = "";

function resourceForm(title: string) {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    accessLevel: "member",
    controlledLinks: "[]",
    estimatedMinutes: "15",
    markdownBody: "Conflict fixture Markdown",
    opportunityTypes: "graduate_scheme",
    primaryCategoryId: categoryId,
    resourceType: "guide",
    shortDescription: "Conflict fixture summary",
    slug: "acceptance-conflict-resource",
    stages: "video_interview",
    tagIds: tagId,
    title,
    youtubeVideo: "",
  }))
    form.append(key, value);
  return form;
}

async function auditCount() {
  const rows = await migration<{ count: number }[]>`
    select count(*)::int count from app.audit_event
    where actor_user_id=${adminId}::uuid
      and entity_id in (${resourceId}::uuid,${categoryId}::uuid,${tagId}::uuid)`;
  return rows[0]!.count;
}

beforeAll(async () => {
  await migration`update app."user" set role='administrator' where id=${adminId}::uuid`;
  const categories = await migration<{ id: string }[]>`
    insert into app.content_category(name,slug,description)
    values('Conflict category','acceptance-conflict-category','Synthetic conflict fixture')
    returning id`;
  categoryId = categories[0]!.id;
  const tags = await migration<{ id: string }[]>`
    insert into app.content_tag(name,slug,normalized_name)
    values('Conflict tag','acceptance-conflict-tag','conflict tag') returning id`;
  tagId = tags[0]!.id;
  const resources = await migration<{ id: string }[]>`
    insert into app.preparation_resource(
      resource_key,slug,title,short_description,resource_type,access_level,publication_state,
      markdown_body,primary_category_id,estimated_minutes,published_at,first_published_at
    ) values(
      'acceptance_conflict_resource','acceptance-conflict-resource','Conflict resource',
      'Conflict fixture summary','guide','member','published','Conflict fixture Markdown',
      ${categoryId}::uuid,15,now(),now()
    ) returning id`;
  resourceId = resources[0]!.id;
  await migration`insert into app.preparation_resource_tag(resource_id,tag_id) values(${resourceId}::uuid,${tagId}::uuid)`;
  await migration`insert into app.preparation_resource_stage(resource_id,stage) values(${resourceId}::uuid,'video_interview')`;
  await migration`insert into app.preparation_resource_opportunity_type(resource_id,opportunity_type) values(${resourceId}::uuid,'graduate_scheme')`;
});

afterAll(async () => {
  await migration`delete from app.audit_event where actor_user_id=${adminId}::uuid and entity_id in (${resourceId}::uuid,${categoryId}::uuid,${tagId}::uuid)`;
  await migration`delete from app.preparation_resource where id=${resourceId}::uuid`;
  await migration`delete from app.content_tag where id=${tagId}::uuid`;
  await migration`delete from app.content_category where id=${categoryId}::uuid`;
  await migration`update app."user" set role='member' where id=${adminId}::uuid`;
  await migration.end();
});

describe("administrator CMS stale-mutation conflicts", () => {
  it.each([
    ["resource update", "save"],
    ["resource publication", "publish"],
  ] as const)(
    "returns a generic %s conflict with no mutation, audit, or analytics",
    async (_case, intent) => {
      const before = await migration<
        { publicationState: string; title: string; version: number }[]
      >`select publication_state "publicationState",title,version from app.preparation_resource where id=${resourceId}::uuid`;
      const auditsBefore = await auditCount();
      const result = await updateResource(
        adminId,
        resourceId,
        before[0]!.version - 1,
        resourceForm(`UNCOMMITTED_${intent.toUpperCase()}_TITLE`),
        intent,
      );

      expect(result).toEqual({ conflict: true, ok: false });
      await expect(
        migration`select publication_state "publicationState",title,version from app.preparation_resource where id=${resourceId}::uuid`,
      ).resolves.toEqual(before);
      expect(await auditCount()).toBe(auditsBefore);
      expect(analyticsCapture).not.toHaveBeenCalled();
    },
  );

  it.each(["category", "tag"] as const)(
    "returns a generic stale %s update conflict with no mutation, audit, or analytics",
    async (kind) => {
      const id = kind === "category" ? categoryId : tagId;
      const table = kind === "category" ? "content_category" : "content_tag";
      const before = await migration<
        { archivedAt: Date | null; name: string; version: number }[]
      >`select name,version,archived_at "archivedAt" from ${migration(`app.${table}`)} where id=${id}::uuid`;
      const auditsBefore = await auditCount();
      const result = await updateTaxonomy(
        adminId,
        kind,
        id,
        before[0]!.version - 1,
        {
          description: kind === "category" ? "UNCOMMITTED_CATEGORY_DESCRIPTION" : undefined,
          name: `UNCOMMITTED_${kind.toUpperCase()}_NAME`,
        },
        "save",
      );

      expect(result).toEqual({ conflict: true, ok: false });
      await expect(
        migration`select name,version,archived_at "archivedAt" from ${migration(`app.${table}`)} where id=${id}::uuid`,
      ).resolves.toEqual(before);
      expect(await auditCount()).toBe(auditsBefore);
      expect(analyticsCapture).not.toHaveBeenCalled();
    },
  );
});
