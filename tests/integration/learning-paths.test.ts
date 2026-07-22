import postgres from "postgres";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const analyticsCapture = vi.hoisted(() => vi.fn());
vi.mock("../../src/infrastructure/analytics/capture", () => ({
  captureAnalyticsEvent: analyticsCapture,
}));

import {
  readAdminPath,
  updatePath,
} from "../../src/modules/learning-paths/application/admin-learning-paths";
import {
  readLearningPath,
  readLearningPaths,
  setPathFollowing,
} from "../../src/modules/learning-paths/application/learning-paths";
import { changeResourceState } from "../../src/modules/preparation-resources/application/resources";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const migration = postgres(databaseUrl, { max: 2, prepare: false });
const runtimeUrl = new URL(databaseUrl);
runtimeUrl.username = "offerlab_runtime_login";
runtimeUrl.password = "postgres";
process.env.DATABASE_URL = runtimeUrl.toString();

const adminId = "20000000-0000-4000-8000-000000000001";
const memberTwo = "20000000-0000-4000-8000-000000000002";
let categoryId = "";
let primaryResourceId = "";
let secondaryResourceId = "";
let pathId = "";
let pathSlug = "";
let createdPathIds: string[] = [];

function form(
  path: NonNullable<Awaited<ReturnType<typeof readAdminPath>>>,
  sections = path.sections,
) {
  const value = new FormData();
  value.set("slug", path.slug);
  value.set("title", path.title);
  value.set("shortDescription", path.shortDescription);
  value.set("introduction", path.introduction);
  value.set("primaryCategoryId", path.primaryCategoryId ?? "");
  value.set("sections", JSON.stringify(sections));
  return value;
}

async function createPathFixture(resourceId = primaryResourceId) {
  const suffix = crypto.randomUUID();
  const inserted = (
    await migration<
      { id: string }[]
    >`insert into app.learning_path(path_key,slug,title,short_description,introduction,primary_category_id) values(${`test_path_${suffix.replaceAll("-", "")}`},${`test-path-${suffix}`},'Integration learning path','Synthetic integration fixture.','',${categoryId}::uuid) returning id`
  )[0]!;
  const section = (
    await migration<
      { id: string }[]
    >`insert into app.learning_path_section(learning_path_id,heading,position) values(${inserted.id}::uuid,'Prepare',1) returning id`
  )[0]!;
  await migration`insert into app.learning_path_item(learning_path_id,section_id,preparation_resource_id,position) values(${inserted.id}::uuid,${section.id}::uuid,${resourceId}::uuid,1)`;
  createdPathIds.push(inserted.id);
  return inserted.id;
}

async function publish(id = pathId) {
  const draft = await readAdminPath(adminId, id);
  if (!draft) throw new Error("Missing learning-path fixture.");
  const result = await updatePath(adminId, id, draft.version, form(draft), "publish");
  expect(result).toMatchObject({ ok: true, outcome: "changed" });
  return await readAdminPath(adminId, id);
}

beforeAll(async () => {
  await migration`update app."user" set role='administrator' where id=${adminId}::uuid`;
  const resources = await migration<
    { category_id: string; id: string; resource_key: string }[]
  >`select id,resource_key,primary_category_id category_id from app.preparation_resource where resource_key in ('online_test_preparation','application_planning_checklist') order by resource_key`;
  const primary = resources.find((resource) => resource.resource_key === "online_test_preparation");
  const secondary = resources.find(
    (resource) => resource.resource_key === "application_planning_checklist",
  );
  if (!primary || !secondary) throw new Error("Missing canonical resource fixtures.");
  primaryResourceId = primary.id;
  secondaryResourceId = secondary.id;
  categoryId = primary.category_id;
});

beforeEach(async () => {
  analyticsCapture.mockClear();
  pathId = await createPathFixture();
  pathSlug = (await readAdminPath(adminId, pathId))!.slug;
});

afterEach(async () => {
  const resourceStateIds = await migration<
    { id: string }[]
  >`select id from app.member_resource_state where owner_user_id=${memberTwo}::uuid and resource_id=any(${[primaryResourceId, secondaryResourceId]}::uuid[])`;
  const pathStateIds = createdPathIds.length
    ? await migration<
        { id: string }[]
      >`select id from app.member_learning_path_state where learning_path_id=any(${createdPathIds}::uuid[])`
    : [];
  const entityIds = [
    ...createdPathIds,
    ...resourceStateIds.map((row) => row.id),
    ...pathStateIds.map((row) => row.id),
  ];
  if (entityIds.length)
    await migration`delete from app.audit_event where entity_id=any(${entityIds}::uuid[])`;
  if (pathStateIds.length)
    await migration`delete from app.member_learning_path_state where id=any(${pathStateIds.map((row) => row.id)}::uuid[])`;
  if (resourceStateIds.length)
    await migration`delete from app.member_resource_state where id=any(${resourceStateIds.map((row) => row.id)}::uuid[])`;
  if (createdPathIds.length)
    await migration`delete from app.learning_path where id=any(${createdPathIds}::uuid[])`;
  createdPathIds = [];
});

afterAll(async () => {
  await migration`update app."user" set role='member' where id=${adminId}::uuid`;
  await migration.end();
});

describe("learning paths", () => {
  it("publishes canonical structure, detects no-op, rejects duplicates and protects stale edits", async () => {
    const draft = await readAdminPath(adminId, pathId);
    expect(draft?.publicationState).toBe("draft");
    if (!draft) return;
    const published = await updatePath(adminId, pathId, draft.version, form(draft), "publish");
    expect(published).toMatchObject({ ok: true, outcome: "changed", version: draft.version + 1 });
    const current = await readAdminPath(adminId, pathId);
    if (!current) throw new Error("Missing path after publication.");
    expect(await updatePath(adminId, pathId, current.version, form(current), "save")).toMatchObject(
      { ok: true, outcome: "unchanged", version: current.version },
    );
    expect(await updatePath(adminId, pathId, current.version - 1, form(current), "save")).toEqual({
      conflict: true,
      ok: false,
    });
    const duplicateSections = [
      {
        ...current.sections[0]!,
        items: [...current.sections[0]!.items, current.sections[0]!.items[0]!],
      },
    ];
    expect(
      await updatePath(adminId, pathId, current.version, form(current, duplicateSections), "save"),
    ).toMatchObject({ ok: false });
  });

  it("derives progress from canonical completion and emits only a genuine final transition", async () => {
    await publish();
    let path = await readLearningPath(memberTwo, pathSlug);
    expect(path).toMatchObject({ completedCount: 0, progress: 0, totalCount: 1 });
    analyticsCapture.mockClear();
    expect(await changeResourceState(memberTwo, primaryResourceId, "complete")).toEqual({
      outcome: "completed",
    });
    expect(analyticsCapture.mock.calls.map(([name]) => name)).toEqual([
      "resource_completed",
      "learning_path_completed",
    ]);
    analyticsCapture.mockClear();
    expect(await changeResourceState(memberTwo, primaryResourceId, "complete")).toEqual({
      outcome: "unchanged",
    });
    expect(analyticsCapture).not.toHaveBeenCalled();
    path = await readLearningPath(memberTwo, pathSlug);
    expect(path).toMatchObject({ completedCount: 1, progress: 100, totalCount: 1 });
    expect((await readLearningPaths(memberTwo)).find((item) => item.id === pathId)?.progress).toBe(
      100,
    );
  });

  it("emits once for every path completed by one shared resource", async () => {
    const secondPathId = await createPathFixture();
    await publish(pathId);
    await publish(secondPathId);
    analyticsCapture.mockClear();
    await changeResourceState(memberTwo, primaryResourceId, "complete");
    expect(analyticsCapture.mock.calls.map(([name]) => name)).toEqual([
      "resource_completed",
      "learning_path_completed",
      "learning_path_completed",
    ]);
  });

  it("becomes incomplete after a structural addition and emits on the new completion", async () => {
    await publish();
    await changeResourceState(memberTwo, primaryResourceId, "complete");
    const current = await readAdminPath(adminId, pathId);
    if (!current) throw new Error("Missing published path.");
    const expanded = [
      {
        ...current.sections[0]!,
        items: [
          ...current.sections[0]!.items,
          { contextNote: "Complete the additional requirement.", resourceId: secondaryResourceId },
        ],
      },
    ];
    const changed = await updatePath(
      adminId,
      pathId,
      current.version,
      form(current, expanded),
      "save",
    );
    expect(changed).toMatchObject({
      ok: true,
      outcome: "changed",
      version: current.version + 1,
    });
    expect(await readLearningPath(memberTwo, pathSlug)).toMatchObject({
      completedCount: 1,
      progress: 50,
      totalCount: 2,
    });
    analyticsCapture.mockClear();
    await changeResourceState(memberTwo, secondaryResourceId, "complete");
    expect(analyticsCapture.mock.calls.map(([name]) => name)).toEqual([
      "resource_completed",
      "learning_path_completed",
    ]);
  });

  it("keeps following owner-isolated and applies the archive/restore lifecycle", async () => {
    let current = await publish();
    expect(await setPathFollowing(memberTwo, pathId, true)).toBe("changed");
    expect(await setPathFollowing(memberTwo, pathId, true)).toBe("unchanged");
    expect((await readLearningPath(memberTwo, pathSlug))?.following).toBe(true);
    expect((await readLearningPath(adminId, pathSlug))?.following).toBe(false);
    if (!current) throw new Error("Missing published path.");
    expect(
      await updatePath(adminId, pathId, current.version, form(current), "archive"),
    ).toMatchObject({ ok: true, outcome: "changed" });
    expect(await readLearningPath(memberTwo, pathSlug)).toBeNull();
    current = await readAdminPath(adminId, pathId);
    if (!current) throw new Error("Missing archived path.");
    expect(
      await updatePath(adminId, pathId, current.version, form(current), "restore"),
    ).toMatchObject({ ok: true, outcome: "changed" });
    expect((await readAdminPath(adminId, pathId))?.publicationState).toBe("draft");
  });

  it("rolls following state back when its audit insertion fails", async () => {
    await publish();
    await migration.unsafe(`
      create function app.test_reject_learning_path_audit() returns trigger language plpgsql as $$
      begin
        if new.action='learning_path.started' then raise exception 'expected_test_failure'; end if;
        return new;
      end $$;
      create trigger test_reject_learning_path_audit before insert on app.audit_event
      for each row execute function app.test_reject_learning_path_audit();
    `);
    try {
      await expect(setPathFollowing(memberTwo, pathId, true)).rejects.toThrow();
      expect((await readLearningPath(memberTwo, pathSlug))?.following).toBe(false);
    } finally {
      await migration.unsafe(`
        drop trigger if exists test_reject_learning_path_audit on app.audit_event;
        drop function if exists app.test_reject_learning_path_audit();
      `);
    }
  });

  it("denies browser roles, identity sync and a different owner direct state access", async () => {
    await publish();
    await setPathFollowing(memberTwo, pathId, true);
    const rows = await migration<
      { allowed: boolean; role_name: string }[]
    >`select v.role_name,has_table_privilege(v.role_name,'app.learning_path','select') allowed from (values('anon'),('authenticated'),('offerlab_identity_sync')) v(role_name)`;
    expect(rows.every((row) => !row.allowed)).toBe(true);
    expect((await readLearningPath(adminId, pathSlug))?.following).toBe(false);
  });
});
