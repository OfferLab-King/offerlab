import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createDraft,
  createTaxonomy,
  updateResource,
  updateTaxonomy,
} from "../../src/modules/preparation-resources/application/admin-content";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const migration = postgres(databaseUrl, { max: 1, prepare: false });
const runtimeUrl = new URL(databaseUrl);
runtimeUrl.username = "offerlab_runtime_login";
runtimeUrl.password = "postgres";
process.env.DATABASE_URL = runtimeUrl.toString();
const adminId = "20000000-0000-4000-8000-000000000001";

beforeAll(async () => {
  await migration`update app."user" set role='administrator' where id=${adminId}::uuid`;
});

afterAll(async () => {
  await migration`update app."user" set role='member' where id=${adminId}::uuid`;
  await migration.end();
});

describe("authorized malformed CMS submissions", () => {
  it("returns safe validation for every mutation shape without repository mutation or audit", async () => {
    const before = await migration<
      { audits: number; categories: number; resources: number; tags: number }[]
    >`select
      (select count(*)::int from app.audit_event) audits,
      (select count(*)::int from app.content_category) categories,
      (select count(*)::int from app.preparation_resource) resources,
      (select count(*)::int from app.content_tag) tags`;
    const malformedResource = new FormData();
    malformedResource.set("title", "MALFORMED_CMS_SENTINEL");

    const results = await Promise.all([
      createDraft(adminId, malformedResource),
      updateResource(adminId, "00000000-0000-4000-8000-000000000001", 1, malformedResource, "save"),
      createTaxonomy(adminId, "category", { name: "MALFORMED_CMS_SENTINEL", slug: "Bad Slug" }),
      createTaxonomy(adminId, "tag", { name: "", slug: "bad" }),
      updateTaxonomy(
        adminId,
        "category",
        "00000000-0000-4000-8000-000000000001",
        1,
        { name: "" },
        "save",
      ),
      updateTaxonomy(
        adminId,
        "tag",
        "00000000-0000-4000-8000-000000000001",
        1,
        { name: "" },
        "save",
      ),
    ]);

    for (const result of results) {
      expect(result).toMatchObject({ ok: false });
      expect(JSON.stringify(result)).not.toContain("MALFORMED_CMS_SENTINEL");
    }
    await expect(
      migration`select
        (select count(*)::int from app.audit_event) audits,
        (select count(*)::int from app.content_category) categories,
        (select count(*)::int from app.preparation_resource) resources,
        (select count(*)::int from app.content_tag) tags`,
    ).resolves.toEqual(before);
  });
});
