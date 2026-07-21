import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  parseLibraryFilters,
  readLibrary,
} from "../../src/modules/preparation-resources/application/resources";
import {
  LIBRARY_PAGE_SIZE,
  SEARCH_QUERY_LIMIT,
} from "../../src/modules/preparation-resources/domain/resource";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const migration = postgres(databaseUrl, { max: 2, prepare: false });
const runtimeUrl = new URL(databaseUrl);
runtimeUrl.username = "offerlab_runtime_login";
runtimeUrl.password = "postgres";
process.env.DATABASE_URL = runtimeUrl.toString();

const ownerId = "20000000-0000-4000-8000-000000000002";
const prefix = "acceptance_matrix_";
let categoryId = "";
let archivedCategoryId = "";
let tagId = "";
const ids: string[] = [];

function filters(query = "") {
  return parseLibraryFilters(new URLSearchParams(query));
}

async function titles(query = "") {
  return (await readLibrary(ownerId, filters(query))).map((resource) => resource.title);
}

beforeAll(async () => {
  const categories = await migration<{ id: string }[]>`
    insert into app.content_category(name,slug,description)
    values('Matrix category','acceptance-matrix-category','Synthetic acceptance fixture'),
          ('Archived matrix category','acceptance-matrix-archived','Synthetic acceptance fixture')
    returning id`;
  categoryId = categories[0]!.id;
  archivedCategoryId = categories[1]!.id;
  await migration`update app.content_category set archived_at=now() where id=${archivedCategoryId}::uuid`;
  const tags = await migration<{ id: string }[]>`
    insert into app.content_tag(name,slug,normalized_name)
    values('Matrix tag','acceptance-matrix-tag','matrix tag') returning id`;
  tagId = tags[0]!.id;

  for (let index = 0; index < 29; index += 1) {
    const state = index === 26 ? "draft" : index === 27 ? "archived" : "published";
    const access = index === 25 ? "public" : "member";
    const primaryCategory = index === 28 ? archivedCategoryId : categoryId;
    const title =
      index === 0
        ? "Nebula title match"
        : index >= 1 && index <= 26
          ? "Stable title"
          : `Hidden ${index}`;
    const summary = index === 1 ? "Contains quasar summary token" : `Matrix summary ${index}`;
    const body = index === 2 ? "Markdown pulsar body token" : `Matrix body ${index}`;
    const rows = await migration<{ id: string }[]>`
      insert into app.preparation_resource(
        resource_key,slug,title,short_description,resource_type,access_level,publication_state,
        markdown_body,primary_category_id,published_at,first_published_at,archived_at
      ) values(
        ${`${prefix}${index}`},${`acceptance-matrix-${index}`},${title},${summary},
        ${index % 2 === 0 ? "guide" : "checklist"},${access},${state},${body},${primaryCategory}::uuid,
        ${state === "published" ? new Date() : null},${state === "published" ? new Date() : null},
        ${state === "archived" ? new Date() : null}
      ) returning id`;
    ids.push(rows[0]!.id);
    await migration`insert into app.preparation_resource_stage(resource_id,stage) values(${rows[0]!.id}::uuid,${index % 2 === 0 ? "video_interview" : "interview"})`;
    await migration`insert into app.preparation_resource_opportunity_type(resource_id,opportunity_type) values(${rows[0]!.id}::uuid,${index % 2 === 0 ? "graduate_scheme" : "internship"})`;
    if (index < 6)
      await migration`insert into app.preparation_resource_tag(resource_id,tag_id) values(${rows[0]!.id}::uuid,${tagId}::uuid)`;
  }
  await migration`
    insert into app.member_resource_state(owner_user_id,resource_id,saved_at,completed_at)
    values(${ownerId}::uuid,${ids[0]!}::uuid,now(),now()),
          (${ownerId}::uuid,${ids[1]!}::uuid,now(),null),
          (${ownerId}::uuid,${ids[2]!}::uuid,null,now())`;
});

afterAll(async () => {
  await migration`delete from app.audit_event where actor_user_id=${ownerId}::uuid and entity_type='member_resource_state'`;
  await migration`delete from app.member_resource_state where resource_id=any(${ids}::uuid[])`;
  await migration`delete from app.preparation_resource where id=any(${ids}::uuid[])`;
  await migration`delete from app.content_tag where id=${tagId}::uuid`;
  await migration`delete from app.content_category where id in (${categoryId}::uuid,${archivedCategoryId}::uuid)`;
  await migration.end();
});

describe("knowledge library search, filter, pagination, and availability matrix", () => {
  it("matches title, summary, Markdown, case-insensitively, and after trimming", async () => {
    expect(await titles("q=nebula")).toContain("Nebula title match");
    expect(await titles("q=QUASAR")).toEqual(["Stable title"]);
    expect(await titles("q=pulsar")).toEqual(["Stable title"]);
    expect(await titles("q=%20%20NeBuLa%20%20")).toContain("Nebula title match");
    expect(await titles("q=definitely-no-result")).toEqual([]);
    expect(filters(`q=${"x".repeat(SEARCH_QUERY_LIMIT)}`).query).toHaveLength(SEARCH_QUERY_LIMIT);
    expect(filters(`q=${"x".repeat(SEARCH_QUERY_LIMIT + 1)}`).query).toBe("");
    expect(filters("q=unsafe%00query").query).toBe("");
    expect(await titles(`q=${"x".repeat(SEARCH_QUERY_LIMIT + 1)}`)).toEqual([]);
    expect(await titles("q=unsafe%00query")).toEqual([]);
  });

  it("applies every individual state and taxonomy filter", async () => {
    expect(await titles("category=acceptance-matrix-category")).toContain("Nebula title match");
    expect(await titles("tag=acceptance-matrix-tag")).toHaveLength(6);
    expect(await titles("stage=video_interview")).toContain("Nebula title match");
    expect(
      (await readLibrary(ownerId, filters("type=checklist"))).every(
        (r) => r.resourceType === "checklist",
      ),
    ).toBe(true);
    expect(await titles("saved=1")).toEqual(["Nebula title match", "Stable title"]);
    expect(await titles("completed=complete")).toEqual(["Nebula title match", "Stable title"]);
    expect(await titles("saved=1&completed=incomplete")).toEqual(["Stable title"]);
  });

  it.each([
    ["q=nebula&category=acceptance-matrix-category", 1],
    ["q=nebula&stage=video_interview", 1],
    ["category=acceptance-matrix-category&tag=acceptance-matrix-tag", 6],
    ["stage=interview&type=checklist", 12],
    ["saved=1&completed=complete", 1],
    ["saved=1&completed=incomplete", 1],
    ["q=nebula&category=acceptance-matrix-category&stage=video_interview", 1],
    ["q=quasar&tag=acceptance-matrix-tag&type=checklist", 1],
    ["q=nebula&category=missing&stage=video_interview", 0],
  ])("applies substantive combined filters: %s", async (query, expected) => {
    expect(await titles(query)).toHaveLength(expected);
  });

  it("covers three genuine pages with deterministic, gap-free UUID-tied ordering", async () => {
    expect(filters("page=0").page).toBe(1);
    expect(filters("page=-1").page).toBe(1);
    expect(filters("page=nope").page).toBe(1);
    expect(filters("page=999999999999999999999").page).toBe(1);
    expect(filters("page=1001").page).toBe(1000);
    const first = await readLibrary(ownerId, filters("category=acceptance-matrix-category&page=1"));
    const second = await readLibrary(
      ownerId,
      filters("category=acceptance-matrix-category&page=2"),
    );
    const final = await readLibrary(ownerId, filters("category=acceptance-matrix-category&page=3"));
    const beyond = await readLibrary(
      ownerId,
      filters("category=acceptance-matrix-category&page=4"),
    );
    expect(first).toHaveLength(LIBRARY_PAGE_SIZE);
    expect(second).toHaveLength(LIBRARY_PAGE_SIZE);
    expect(final).toHaveLength(2);
    expect(beyond).toEqual([]);
    expect(second.map((resource) => resource.id)).not.toEqual(first.map((resource) => resource.id));
    expect(second.map((resource) => resource.id)).not.toEqual(final.map((resource) => resource.id));

    const validPages = [...first, ...second, ...final];
    const returnedIds = validPages.map((resource) => resource.id);
    const expectedIds = ids.slice(0, 26).sort((left, right) => {
      const leftTitle = left === ids[0] ? "Nebula title match" : "Stable title";
      const rightTitle = right === ids[0] ? "Nebula title match" : "Stable title";
      return leftTitle === rightTitle
        ? left.localeCompare(right)
        : leftTitle.localeCompare(rightTitle);
    });
    expect(new Set(returnedIds).size).toBe(returnedIds.length);
    expect(returnedIds).toEqual(expectedIds);
    expect(new Set(returnedIds)).toEqual(new Set(ids.slice(0, 26)));
    expect(first.at(-1)!.id < second[0]!.id).toBe(true);
    expect(second.at(-1)!.id < final[0]!.id).toBe(true);

    const repeated = await Promise.all(
      [1, 2, 3].map((page) =>
        readLibrary(ownerId, filters(`category=acceptance-matrix-category&page=${page}`)),
      ),
    );
    expect(repeated.flat().map((resource) => resource.id)).toEqual(returnedIds);
    await expect(
      readLibrary(ownerId, filters("category=acceptance-matrix-category&page=-1")),
    ).resolves.toEqual(first);
  });

  it("excludes draft, archived, and resources whose primary category is archived", async () => {
    const all = await readLibrary(ownerId, filters("page=1"));
    const returned = new Set(all.map((resource) => resource.id));
    expect(returned.has(ids[26]!)).toBe(false);
    expect(returned.has(ids[27]!)).toBe(false);
    expect(returned.has(ids[28]!)).toBe(false);
  });
});
