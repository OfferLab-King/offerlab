import postgres, { type TransactionSql } from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { findPublishedResource } from "../../src/modules/preparation-resources/infrastructure/resource-repository";

const url =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const admin = postgres(url, { prepare: false });
const runtimeUrl = new URL(url);
runtimeUrl.username = "offerlab_runtime_login";
runtimeUrl.password = "postgres";
const runtime = postgres(runtimeUrl.toString(), { prepare: false });
const member = "20000000-0000-4000-8000-000000000001";

async function asMember<T>(operation: (db: TransactionSql) => PromiseLike<T>) {
  return runtime.begin(async (db) => {
    await db`set local role offerlab_app`;
    await db`select set_config('app.current_user_id',${member},true)`;
    return operation(db);
  }) as Promise<T>;
}

afterAll(async () => Promise.all([admin.end(), runtime.end()]));

describe("structured coaching case persistence", () => {
  it("returns the published case with validated, reproducible tracked changes", async () => {
    const resource = await asMember((db) =>
      findPublishedResource(db, "annotated-teamwork-answer-case", member),
    );
    expect(resource?.coachingCase?.changes).toHaveLength(3);
    expect(resource?.coachingCase?.improvedAnswer).toContain(
      "I interviewed six current volunteers",
    );
  });

  it("forces RLS and prevents member editorial writes", async () => {
    const [security] = await admin<
      { relforcerowsecurity: boolean; relrowsecurity: boolean }[]
    >`select relrowsecurity,relforcerowsecurity from pg_class where oid='app.coaching_case_detail'::regclass`;
    expect(security).toEqual({ relforcerowsecurity: true, relrowsecurity: true });
    await expect(
      asMember(
        (db) =>
          db`update app.coaching_case_detail set why_stronger='Member edit' where resource_id=(select id from app.preparation_resource where resource_key='annotated_teamwork_answer_case') returning resource_id`,
      ),
    ).resolves.toEqual([]);
    const [unchanged] = await admin<
      { why_stronger: string }[]
    >`select why_stronger from app.coaching_case_detail where resource_id=(select id from app.preparation_resource where resource_key='annotated_teamwork_answer_case')`;
    expect(unchanged?.why_stronger).not.toBe("Member edit");
  });

  it("requires explicit confirmation for any anonymised previous-student source", async () => {
    const [resource] = await admin<
      { id: string }[]
    >`select id from app.preparation_resource where resource_key='annotated_teamwork_answer_case'`;
    await expect(
      admin`update app.coaching_case_detail set source_kind='anonymised_approved' where resource_id=${resource!.id}::uuid`,
    ).rejects.toThrow();
  });
});
