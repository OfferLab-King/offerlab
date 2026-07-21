import postgres from "postgres";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createDraft,
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
let alternateTagId = "";
let resourceId = "";

function form(values: Record<string, string | string[]>) {
  const result = new FormData();
  for (const [key, value] of Object.entries(values))
    for (const item of Array.isArray(value) ? value : [value]) result.append(key, item);
  return result;
}

function values(overrides: Record<string, string | string[]> = {}) {
  return form({
    accessLevel: "member",
    controlledLinks:
      '[{"type":"external","label":"Original link","url":"https://example.com/original"}]',
    estimatedMinutes: "10",
    markdownBody: "Original body",
    opportunityTypes: ["graduate_scheme"],
    primaryCategoryId: categoryId,
    relatedResourceIds: [],
    resourceType: "guide",
    shortDescription: "Original summary",
    slug: "audit-rollback-resource",
    stages: ["video_interview"],
    tagIds: [tagId],
    title: "Original title",
    youtubeVideo: "",
    ...overrides,
  });
}

async function snapshot() {
  return (
    await migration<
      {
        completed: unknown;
        publication_state: string;
        title: string;
        updated_at: Date;
        version: number;
      }[]
    >`
      select r.title,r.publication_state,r.version,r.updated_at,
        jsonb_build_object(
          'tags',(select jsonb_agg(tag_id order by tag_id) from app.preparation_resource_tag where resource_id=r.id),
          'stages',(select jsonb_agg(stage order by stage) from app.preparation_resource_stage where resource_id=r.id),
          'opportunities',(select jsonb_agg(opportunity_type order by opportunity_type) from app.preparation_resource_opportunity_type where resource_id=r.id),
          'links',(select jsonb_agg(jsonb_build_object('label',label,'url',url) order by position) from app.preparation_resource_link where resource_id=r.id)
        ) completed
      from app.preparation_resource r where r.id=${resourceId}::uuid`
  )[0]!;
}

beforeAll(async () => {
  await migration`update app."user" set role='administrator' where id=${adminId}::uuid`;
  const categories = await migration<{ id: string }[]>`
    insert into app.content_category(name,slug,description)
    values('Audit rollback category','audit-rollback-category','Synthetic fixture') returning id`;
  categoryId = categories[0]!.id;
  const tags = await migration<{ id: string }[]>`
    insert into app.content_tag(name,slug,normalized_name)
    values('Audit rollback tag','audit-rollback-tag','audit rollback tag'),
          ('Audit rollback alternate','audit-rollback-alternate','audit rollback alternate') returning id`;
  tagId = tags[0]!.id;
  alternateTagId = tags[1]!.id;
  const resources = await migration<{ id: string }[]>`
    insert into app.preparation_resource(resource_key,slug,title,short_description,resource_type,access_level,publication_state,markdown_body,primary_category_id,estimated_minutes,published_at,first_published_at)
    values('audit_rollback_resource','audit-rollback-resource','Original title','Original summary','guide','member','published','Original body',${categoryId}::uuid,10,now(),now()) returning id`;
  resourceId = resources[0]!.id;
  await migration`insert into app.preparation_resource_tag(resource_id,tag_id) values(${resourceId}::uuid,${tagId}::uuid)`;
  await migration`insert into app.preparation_resource_stage(resource_id,stage) values(${resourceId}::uuid,'video_interview')`;
  await migration`insert into app.preparation_resource_opportunity_type(resource_id,opportunity_type) values(${resourceId}::uuid,'graduate_scheme')`;
  await migration`insert into app.preparation_resource_link(resource_id,link_type,label,url,position) values(${resourceId}::uuid,'external','Original link','https://example.com/original',1)`;
});

beforeEach(async () => {
  await migration.unsafe(`
    create or replace function app.acceptance_reject_audit() returns trigger language plpgsql as $$
    begin raise exception 'injected audit failure'; end $$;
    create trigger acceptance_reject_audit before insert on app.audit_event
      for each row when (new.actor_user_id = '${adminId}'::uuid) execute function app.acceptance_reject_audit();
  `);
});

afterEach(async () => {
  await migration.unsafe(
    "drop trigger if exists acceptance_reject_audit on app.audit_event; drop function if exists app.acceptance_reject_audit();",
  );
});

afterAll(async () => {
  await migration`delete from app.audit_event where actor_user_id=${adminId}::uuid and entity_id in (${resourceId}::uuid,${categoryId}::uuid,${tagId}::uuid,${alternateTagId}::uuid)`;
  await migration`delete from app.preparation_resource where id=${resourceId}::uuid or resource_key like 'draft_%'`;
  await migration`delete from app.content_tag where id in (${tagId}::uuid,${alternateTagId}::uuid)`;
  await migration`delete from app.content_category where id=${categoryId}::uuid`;
  await migration`update app."user" set role='member' where id=${adminId}::uuid`;
  await migration.end();
});

describe("CMS audit failure transaction rollback", () => {
  it("rolls back resource creation when its audit insert fails", async () => {
    const before = await migration<
      { count: number }[]
    >`select count(*)::int count from app.preparation_resource`;
    await expect(createDraft(adminId, values({ slug: "audit-failed-create" }))).rejects.toThrow(
      "injected audit failure",
    );
    const after = await migration<
      { count: number }[]
    >`select count(*)::int count from app.preparation_resource`;
    expect(after).toEqual(before);
  });

  it("rolls back scalar and every association in one logical resource update", async () => {
    const before = await snapshot();
    await expect(
      updateResource(
        adminId,
        resourceId,
        before.version,
        values({
          controlledLinks:
            '[{"type":"external","label":"Changed","url":"https://example.com/changed"}]',
          opportunityTypes: ["internship"],
          stages: ["interview"],
          tagIds: [alternateTagId],
          title: "Changed title",
        }),
        "save",
      ),
    ).rejects.toThrow("injected audit failure");
    expect(await snapshot()).toEqual(before);
  });

  it("rolls back publication state, version, and updated_at", async () => {
    const before = await snapshot();
    await expect(
      updateResource(adminId, resourceId, before.version, values(), "unpublish"),
    ).rejects.toThrow("injected audit failure");
    expect(await snapshot()).toEqual(before);
  });

  it.each(["category", "tag"] as const)("rolls back %s mutation", async (kind) => {
    const id = kind === "category" ? categoryId : tagId;
    const table = kind === "category" ? "content_category" : "content_tag";
    const before = (
      await migration.unsafe<{ name: string; updated_at: Date; version: number }[]>(
        `select name,updated_at,version from app.${table} where id='${id}'::uuid`,
      )
    )[0]!;
    await expect(
      updateTaxonomy(adminId, kind, id, before.version, { name: "Should roll back" }, "save"),
    ).rejects.toThrow("injected audit failure");
    const after = (
      await migration.unsafe<{ name: string; updated_at: Date; version: number }[]>(
        `select name,updated_at,version from app.${table} where id='${id}'::uuid`,
      )
    )[0]!;
    expect(after).toEqual(before);
  });
});
