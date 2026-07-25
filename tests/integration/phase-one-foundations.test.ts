import postgres, { type TransactionSql } from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createRequest,
  listOfferings,
  listOfferingsForAdmin,
  listRequestsForAdmin,
  updateOfferingAvailability,
  updateRequest,
} from "../../src/modules/practice-services/infrastructure/service-repository";
import {
  createReport,
  listReports,
  listReportsForAdmin,
  moderateReport,
} from "../../src/modules/recruitment-intelligence/infrastructure/report-repository";

const url =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const migration = postgres(url, { max: 2, prepare: false });
const runtimeUrl = new URL(url);
runtimeUrl.username = "offerlab_runtime_login";
runtimeUrl.password = "postgres";
const runtime = postgres(runtimeUrl.toString(), { max: 2, prepare: false });
const administrator = "20000000-0000-4000-8000-000000000001";
const member = "20000000-0000-4000-8000-000000000002";

async function as<T>(owner: string, operation: (database: TransactionSql) => PromiseLike<T>) {
  return runtime.begin(async (database) => {
    await database`set local role offerlab_app`;
    await database`select set_config('app.current_user_id',${owner},true)`;
    return operation(database);
  }) as Promise<T>;
}

beforeAll(async () => {
  await migration`update app."user" set role='administrator' where id=${administrator}::uuid`;
});
beforeEach(async () => {
  await migration`delete from app.audit_event where entity_type in ('recruitment_intelligence_report','service_request','service_offering')`;
  await migration`delete from app.service_request`;
  await migration`delete from app.recruitment_intelligence_report`;
});
afterAll(async () => {
  await migration`delete from app.audit_event where entity_type in ('recruitment_intelligence_report','service_request','service_offering')`;
  await migration`delete from app.service_request`;
  await migration`delete from app.recruitment_intelligence_report`;
  await migration`update app.service_offering set availability='interest' where stable_key in ('group_mock_pilot','answer_review_pilot','mock_interview_pilot')`;
  await migration`update app."user" set role='member' where id=${administrator}::uuid`;
  await Promise.all([migration.end(), runtime.end()]);
});

const report = {
  approximateDate: "2026-07-20",
  assessedSkills: ["Communication", "Prioritisation"],
  formatSummary: "Timed group discussion",
  industry: "consulting" as const,
  opportunityType: "graduate_scheme" as const,
  recruitmentCycle: "2026/27",
  recruitmentStage: "assessment_centre" as const,
  reflection: "State criteria early and include quieter contributors.",
  themes: "Prioritisation, trade-offs and a group recommendation.",
};

describe("Phase 1 moderated and manually operated foundations", () => {
  it("keeps a candidate report private until an administrator publishes it", async () => {
    const created = await as(member, (database) => createReport(database, member, report));
    expect(created).toMatchObject({ mine: true, moderationState: "pending", version: 1 });
    expect(
      await as(administrator, (database) => listReportsForAdmin(database, administrator)),
    ).toHaveLength(1);
    expect(await as(administrator, (database) => listReports(database, administrator))).toEqual([]);
    expect(
      await as(administrator, (database) =>
        moderateReport(database, administrator, created.id, 1, "published", "medium"),
      ),
    ).toEqual({ outcome: "changed" });
    const visible = await as(administrator, (database) => listReports(database, administrator));
    expect(visible).toEqual([
      expect.objectContaining({ moderationState: "published", version: 2 }),
    ]);
    expect(
      await as(administrator, (database) =>
        moderateReport(database, administrator, created.id, 1, "rejected", "low"),
      ),
    ).toEqual({ outcome: "conflict" });
    const audits = await migration<
      { metadata: object }[]
    >`select metadata from app.audit_event where entity_id=${created.id}::uuid`;
    expect(audits).toHaveLength(2);
    expect(audits.every((event) => JSON.stringify(event.metadata) === "{}")).toBe(true);
  });

  it("supports a privacy-minimal service request and administrator status update", async () => {
    const offering = (await as(member, (database) => listOfferings(database, member)))[0]!;
    expect(offering.requestId).toBeNull();
    expect(await as(member, (database) => createRequest(database, member, offering.id))).toEqual({
      outcome: "changed",
    });
    expect(await as(member, (database) => createRequest(database, member, offering.id))).toEqual({
      outcome: "unchanged",
    });
    const requests = await as(administrator, listRequestsForAdmin);
    expect(requests).toHaveLength(1);
    expect(
      await as(administrator, (database) =>
        updateRequest(database, administrator, requests[0]!.id, 1, "confirmed"),
      ),
    ).toEqual({ outcome: "changed" });
    expect(
      await as(administrator, (database) =>
        updateRequest(database, administrator, requests[0]!.id, 1, "completed"),
      ),
    ).toEqual({ outcome: "conflict" });
  });

  it("lets an administrator pause an offering with optimistic concurrency and safe audit", async () => {
    const offering = (await as(administrator, listOfferingsForAdmin))[0]!;
    expect(
      await as(administrator, (database) =>
        updateOfferingAvailability(
          database,
          administrator,
          offering.id,
          offering.version,
          "paused",
        ),
      ),
    ).toEqual({ outcome: "changed" });
    expect(
      await as(administrator, (database) =>
        updateOfferingAvailability(database, administrator, offering.id, offering.version, "open"),
      ),
    ).toEqual({ outcome: "conflict" });
    expect(
      (await as(member, (database) => listOfferings(database, member))).some(
        (item) => item.id === offering.id,
      ),
    ).toBe(false);
    const audit = await migration<
      { metadata: object }[]
    >`select metadata from app.audit_event where entity_type='service_offering' and entity_id=${offering.id}::uuid`;
    expect(audit).toEqual([{ metadata: {} }]);
  });

  it("forces RLS and withholds all three tables from identity-sync credentials", async () => {
    const rows = await migration<{ relforcerowsecurity: boolean; relrowsecurity: boolean }[]>`
      select relrowsecurity,relforcerowsecurity from pg_class where oid in (
        'app.recruitment_intelligence_report'::regclass,'app.service_offering'::regclass,'app.service_request'::regclass
      )`;
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.relrowsecurity && row.relforcerowsecurity)).toBe(true);
    const privileges = await migration<{ allowed: boolean }[]>`
      select has_table_privilege('offerlab_identity_sync',name,'select') allowed from unnest(array[
        'app.recruitment_intelligence_report','app.service_offering','app.service_request'
      ]) name`;
    expect(privileges.every((row) => !row.allowed)).toBe(true);
  });
});
