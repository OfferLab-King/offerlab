import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createDraft,
  createTaxonomy,
  findAdminResource,
  updateResource,
  updateTaxonomy,
} from "../../src/modules/preparation-resources/application/admin-content";
import { readPublicResource } from "../../src/modules/preparation-resources/application/resources";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const migration = postgres(databaseUrl, { max: 2, prepare: false });
const runtimeUrl = new URL(databaseUrl);
runtimeUrl.username = "offerlab_runtime_login";
runtimeUrl.password = "postgres";
const runtime = postgres(runtimeUrl.toString(), { max: 2, prepare: false });
const adminId = "20000000-0000-4000-8000-000000000001";
const memberTwo = "20000000-0000-4000-8000-000000000002";
process.env.DATABASE_URL = runtimeUrl.toString();

function form(values: Record<string, string | string[]>) {
  const result = new FormData();
  for (const [key, value] of Object.entries(values))
    for (const item of Array.isArray(value) ? value : [value]) result.append(key, item);
  return result;
}
let categoryId = "";
let tagId = "";
let resourceId = "";

beforeAll(async () => {
  await migration`update app."user" set role='administrator' where id=${adminId}::uuid`;
  const category = await createTaxonomy(adminId, "category", {
    name: "Acceptance Category",
    slug: "acceptance-category",
    description: "Synthetic integration fixture.",
  });
  if (!category.ok) throw new Error("category fixture failed");
  categoryId = category.id;
  const tag = await createTaxonomy(adminId, "tag", {
    name: "Acceptance Tag",
    slug: "acceptance-tag",
  });
  if (!tag.ok) throw new Error("tag fixture failed");
  tagId = tag.id;
});
afterAll(async () => {
  await migration`delete from app.audit_event where actor_user_id=${adminId}::uuid and (entity_id=${resourceId || null}::uuid or entity_id=${categoryId || null}::uuid or entity_id=${tagId || null}::uuid)`;
  if (resourceId)
    await migration`delete from app.preparation_resource where id=${resourceId}::uuid`;
  if (tagId) await migration`delete from app.content_tag where id=${tagId}::uuid`;
  if (categoryId) await migration`delete from app.content_category where id=${categoryId}::uuid`;
  await migration`update app."user" set role='member' where id=${adminId}::uuid`;
  await Promise.all([migration.end(), runtime.end()]);
});

describe("knowledge library CMS and production-equivalent policies", () => {
  it("reads the seeded public resource through the anonymous application path", async () => {
    await expect(readPublicResource("application-planning-checklist")).resolves.toMatchObject({
      resourceKey: "application_planning_checklist",
      slug: "application-planning-checklist",
    });
  });
  it("creates an incomplete draft, atomically saves associations, publishes, detects no-op, and rejects stale writes", async () => {
    const draft = await createDraft(
      adminId,
      form({
        accessLevel: "member",
        estimatedMinutes: "",
        markdownBody: "",
        primaryCategoryId: "",
        resourceType: "guide",
        shortDescription: "",
        slug: "acceptance-resource",
        title: "",
        youtubeVideo: "",
        controlledLinks: "[]",
      }),
    );
    expect(draft).toMatchObject({ ok: true });
    if (!draft.ok) return;
    resourceId = draft.id;
    const incomplete = await findAdminResource(adminId, resourceId);
    expect(incomplete).toMatchObject({ publicationState: "draft", title: "", version: 1 });
    const values = {
      accessLevel: "member",
      estimatedMinutes: "12",
      markdownBody: "## Safe body\n\n- one\n- two",
      primaryCategoryId: categoryId,
      resourceType: "guide",
      shortDescription: "Acceptance summary",
      slug: "acceptance-resource",
      title: "Acceptance resource",
      youtubeVideo: "",
      tagIds: [tagId],
      stages: ["video_interview"],
      opportunityTypes: ["graduate_scheme"],
      controlledLinks: JSON.stringify([
        { type: "external", label: "Safe example", url: "https://example.com/guide" },
      ]),
    };
    const published = await updateResource(adminId, resourceId, 1, form(values), "publish");
    expect(published).toMatchObject({ ok: true, outcome: "changed", version: 2 });
    const unchanged = await updateResource(adminId, resourceId, 2, form(values), "publish");
    expect(unchanged).toEqual({ ok: true, outcome: "unchanged", version: 2 });
    const stale = await updateResource(
      adminId,
      resourceId,
      1,
      form({ ...values, title: "Leaked title attempt" }),
      "save",
    );
    expect(stale).toMatchObject({ ok: false, conflict: true });
    expect(stale).not.toHaveProperty("resource");
    const persisted = await findAdminResource(adminId, resourceId);
    expect(persisted).toMatchObject({
      title: "Acceptance resource",
      tagIds: [tagId],
      stages: ["video_interview"],
      opportunityTypes: ["graduate_scheme"],
      version: 2,
    });
    const audits = await migration<
      { action: string }[]
    >`select action from app.audit_event where entity_id=${resourceId}::uuid order by created_at`;
    expect(audits.map((x) => x.action)).toEqual(["content.created", "content.published"]);
  });

  it("keeps recommendation and standalone resource state independent", async () => {
    await migration`insert into app.member_resource_state(owner_user_id,resource_id,completed_at) values(${memberTwo}::uuid,${resourceId}::uuid,now())`;
    const recommendation = await migration<
      { count: number }[]
    >`select count(*)::int count from app.recommendation_state where owner_user_id=${memberTwo}::uuid`;
    expect(recommendation).toEqual([{ count: 0 }]);
    await migration`delete from app.member_resource_state where owner_user_id=${memberTwo}::uuid and resource_id=${resourceId}::uuid`;
  });

  it("allows exactly one winner for concurrent association-aware publish attempts", async () => {
    if (!resourceId) {
      const rows = await migration<{ id: string }[]>`
        insert into app.preparation_resource(
          resource_key,slug,title,short_description,resource_type,access_level,publication_state,
          markdown_body,primary_category_id,published_at,first_published_at
        ) values(
          'acceptance_concurrency_resource','acceptance-concurrency-resource','Concurrency resource',
          'Synthetic independent concurrency fixture.','guide','member','published','Safe body',
          ${categoryId}::uuid,now(),now()
        ) returning id`;
      resourceId = rows[0]!.id;
    }
    const current = await findAdminResource(adminId, resourceId);
    expect(current).not.toBeNull();
    if (!current) return;
    const values = {
      accessLevel: current.accessLevel,
      controlledLinks: JSON.stringify(current.links),
      estimatedMinutes: String(current.estimatedMinutes ?? ""),
      markdownBody: current.markdownBody,
      opportunityTypes: [...current.opportunityTypes],
      primaryCategoryId: current.primaryCategoryId ?? "",
      relatedResourceIds: [...current.relatedResourceIds],
      resourceType: current.resourceType,
      shortDescription: current.shortDescription,
      slug: current.slug,
      stages: [...current.stages],
      tagIds: [...current.tagIds],
      title: current.title,
      youtubeVideo: current.youtubeVideoId ?? "",
    };
    const [left, right] = await Promise.all([
      updateResource(
        adminId,
        resourceId,
        current.version,
        form({ ...values, title: "Concurrent left" }),
        "publish",
      ),
      updateResource(
        adminId,
        resourceId,
        current.version,
        form({ ...values, stages: ["interview"], title: "Concurrent right" }),
        "publish",
      ),
    ]);
    expect([left, right].filter((result) => result.ok)).toHaveLength(1);
    expect(
      [left, right].filter((result) => !result.ok && "conflict" in result && result.conflict),
    ).toHaveLength(1);
  });

  it("forces RLS, denies browser/identity roles, and isolates member state by owner", async () => {
    const flags = await migration<
      { forced: boolean; rls: boolean }[]
    >`select relforcerowsecurity forced,relrowsecurity rls from pg_class where oid='app.member_resource_state'::regclass`;
    expect(flags).toEqual([{ forced: true, rls: true }]);
    for (const role of ["anon", "authenticated", "offerlab_identity_sync"]) {
      const privilege = await migration<
        { read: boolean; write: boolean }[]
      >`select has_table_privilege(${role},'app.preparation_resource','select') read,has_table_privilege(${role},'app.preparation_resource','insert,update,delete') write`;
      expect(privilege).toEqual([{ read: false, write: false }]);
    }
    await runtime.begin(async (tx) => {
      await tx`set local role offerlab_app`;
      await tx`select set_config('app.current_user_id',${memberTwo},true)`;
      await tx`insert into app.member_resource_state(owner_user_id,resource_id,saved_at) values(${memberTwo}::uuid,${resourceId}::uuid,now())`;
    });
    const invisible = await runtime.begin(async (tx) => {
      await tx`set local role offerlab_app`;
      await tx`select set_config('app.current_user_id',${adminId},true)`;
      return tx`select id from app.member_resource_state where resource_id=${resourceId}::uuid`;
    });
    expect(invisible).toEqual([]);
    await migration`delete from app.member_resource_state where resource_id=${resourceId}::uuid`;
  });

  it("archives taxonomy with optimistic concurrency and safely unpublishes affected content", async () => {
    const tag = await migration<
      { version: number }[]
    >`select version from app.content_tag where id=${tagId}::uuid`;
    const archived = await updateTaxonomy(
      adminId,
      "tag",
      tagId,
      tag[0]!.version,
      { name: "Acceptance Tag" },
      "archive",
    );
    expect(archived).toMatchObject({ ok: true, outcome: "changed" });
    const stale = await updateTaxonomy(
      adminId,
      "tag",
      tagId,
      tag[0]!.version,
      { name: "Acceptance Tag" },
      "restore",
    );
    expect(stale).toMatchObject({ ok: false, conflict: true });
    const resource = await findAdminResource(adminId, resourceId);
    expect(resource?.publicationState).toBe("draft");
    const current = await migration<
      { version: number }[]
    >`select version from app.content_tag where id=${tagId}::uuid`;
    await expect(
      updateTaxonomy(
        adminId,
        "tag",
        tagId,
        current[0]!.version,
        { name: "Acceptance Tag" },
        "restore",
      ),
    ).resolves.toMatchObject({ ok: true, outcome: "changed" });
  });
});
