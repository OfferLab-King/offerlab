import postgres, { type TransactionSql } from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import {
  isEmployerSavedForMember,
  listSavedEmployersForMember,
  saveEmployerForMember,
  unsaveEmployerForMember,
} from "../../src/modules/job-catalog/application/saved-employers";
import { searchEmployersForAutocomplete } from "../../src/modules/job-catalog/application/catalog";
import { parseApplicationInput } from "../../src/modules/applications/domain/application";
import {
  createApplication,
  updateApplication,
} from "../../src/modules/applications/infrastructure/application-repository";
import { saveCareerJobTarget } from "../../src/modules/career-documents/infrastructure/career-repository";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const migrationDatabase = postgres(databaseUrl, { max: 2, prepare: false });
const runtimeUrl = new URL(databaseUrl);
runtimeUrl.username = "offerlab_runtime_login";
runtimeUrl.password = "postgres";
const runtimeDatabase = postgres(runtimeUrl.toString(), { max: 2, prepare: false });
process.env.DATABASE_URL = runtimeUrl.toString();

const userOne = "20000000-0000-4000-8000-000000000001";
const userTwo = "20000000-0000-4000-8000-000000000002";

const uniqueSlug = (base: string): string =>
  `${base}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

async function asUser<T>(
  userId: string,
  operation: (database: TransactionSql) => PromiseLike<T>,
): Promise<T> {
  return (await runtimeDatabase.begin(async (transaction) => {
    await transaction`set local role offerlab_app`;
    await transaction`select set_config('app.current_user_id', ${userId}, true)`;
    return operation(transaction);
  })) as T;
}

async function setupVisibleEmployer(name: string): Promise<{ id: string; slug: string }> {
  const company = await migrationDatabase<{ id: string; slug: string }[]>`
    insert into app.company (name, slug, careers_url, source_type, employer_industry_key)
    values (${name}, ${uniqueSlug("mem")}, ${`https://member-${uniqueSlug("u")}.example.com/careers`},
      'unknown', 'financial_services')
    returning id, slug
  `;
  await migrationDatabase`
    insert into app.employer_research_snapshot (
      company_id, canonical_name, dataset_version, research_date, priority_tier,
      internal_rank, research_status, employee_band
    ) values (
      ${company[0]!.id}::uuid, ${name}, ${`member-test-${uniqueSlug("s")}`},
      '2026-08-12'::date, 'P0', ${Math.floor(Math.random() * 900) + 1000},
      'not_researched', '10,000–49,999'
    )
  `;
  await migrationDatabase`
    insert into app.employer_alias (company_id, alias, alias_type, source)
    values (${company[0]!.id}::uuid, ${`${name} Trading Alias`}, 'trading_name', 'test')
  `;
  return { id: company[0]!.id, slug: company[0]!.slug };
}

afterAll(async () => {
  await migrationDatabase.end();
  await runtimeDatabase.end();
});

describe("saved employers", () => {
  it("saves, lists and unsaves employers owner-scoped with two-user isolation", async () => {
    const { id: companyId, slug } = await setupVisibleEmployer("Saved Employer Bank");
    await saveEmployerForMember(userOne, companyId);

    expect(await isEmployerSavedForMember(userOne, companyId)).toBe(true);
    expect(await isEmployerSavedForMember(userTwo, companyId)).toBe(false);

    const mine = await listSavedEmployersForMember(userOne);
    expect(mine.map((entry) => entry.slug)).toContain(slug);
    expect(mine[0]!.current_jobs).toBeGreaterThanOrEqual(0);

    const theirs = await listSavedEmployersForMember(userTwo);
    expect(theirs).toHaveLength(0);

    await unsaveEmployerForMember(userOne, companyId);
    expect(await isEmployerSavedForMember(userOne, companyId)).toBe(false);
  });

  it("is idempotent and does not duplicate saves", async () => {
    const { id: companyId } = await setupVisibleEmployer("Idempotent Save Co");
    await saveEmployerForMember(userOne, companyId);
    await saveEmployerForMember(userOne, companyId);
    const mine = await listSavedEmployersForMember(userOne);
    expect(mine.filter((entry) => entry.companyId === companyId)).toHaveLength(1);
  });
});

describe("employer autocomplete", () => {
  it("matches canonical names and aliases with bounded results", async () => {
    const { id } = await setupVisibleEmployer(`Autocomplete Co ${uniqueSlug("ac")}`);
    const name = `Autocomplete Co ${uniqueSlug("ac")}`;
    void name;
    const byName = await searchEmployersForAutocomplete(name.slice(0, 12));
    expect(byName.some((option) => option.id === id)).toBe(true);
    const byAlias = await searchEmployersForAutocomplete("trading alias");
    expect(byAlias.some((option) => option.id === id)).toBe(true);
    expect(await searchEmployersForAutocomplete("x")).toEqual([]);
    const many = await searchEmployersForAutocomplete("a");
    expect(many.length).toBeLessThanOrEqual(8);
  });
});

describe("application canonical employer linkage", () => {
  it("stores a nullable canonical company id with free-text fallback", async () => {
    const { id: companyId } = await setupVisibleEmployer("Application Linked Co");
    const parsed = parseApplicationInput({
      appliedDate: null,
      applicationDeadline: "2026-12-01",
      company: "Application Linked Co",
      companyId,
      industry: "financial_services",
      location: "London",
      nextStageDeadline: null,
      notes: null,
      opportunityType: "graduate_scheme",
      role: "Graduate Analyst",
      stage: "preparing",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const created = await asUser(userOne, (database) =>
      createApplication(database, userOne, parsed.value.values),
    );
    expect(created.outcome).toBe("created");
    if (created.outcome !== "created") throw new Error("expected created");
    expect(created.application.companyId).toBe(companyId);

    const withoutLink = parseApplicationInput({
      appliedDate: null,
      applicationDeadline: null,
      company: "Some Free Text Company",
      companyId: null,
      industry: null,
      location: null,
      nextStageDeadline: null,
      notes: null,
      opportunityType: "graduate_scheme",
      role: "Graduate Role",
      stage: "preparing",
    });
    expect(withoutLink.ok).toBe(true);
    if (!withoutLink.ok) return;
    const createdFree = await asUser(userOne, (database) =>
      createApplication(database, userOne, withoutLink.value.values),
    );
    expect(createdFree.outcome).toBe("created");
    if (createdFree.outcome !== "created") throw new Error("expected created");
    expect(createdFree.application.companyId).toBeNull();
  });

  it("canonicalizes valid selections, rejects false links, and preserves a link on update", async () => {
    const { id: companyId } = await setupVisibleEmployer("Canonical Application Co");
    const values = {
      appliedDate: null,
      applicationDeadline: null,
      company: "Tampered company name",
      companyId,
      industry: "financial_services" as const,
      location: "London",
      nextStageDeadline: null,
      notes: null,
      opportunityType: "graduate_scheme" as const,
      role: "Graduate Analyst",
      stage: "preparing" as const,
    };
    const created = await asUser(userOne, (database) =>
      createApplication(database, userOne, values),
    );
    expect(created).toMatchObject({
      application: { company: "Canonical Application Co", companyId },
      outcome: "created",
    });
    if (!("application" in created)) throw new Error("expected created application");

    const updated = await asUser(userOne, (database) =>
      updateApplication(database, userOne, created.application.id, 1, {
        ...values,
        company: "Canonical Application Co",
        role: "Graduate Consultant",
      }),
    );
    expect(updated).toMatchObject({
      application: { company: "Canonical Application Co", companyId },
      outcome: "updated",
    });

    const falseLink = await asUser(userOne, (database) =>
      createApplication(database, userOne, {
        ...values,
        company: "Free Text Employer",
        companyId: "00000000-0000-4000-8000-000000000999",
      }),
    );
    expect(falseLink).toMatchObject({
      application: { company: "Free Text Employer", companyId: null },
      outcome: "created",
    });
  });
});

describe("career job target canonical employer linkage", () => {
  it("stores and updates a nullable canonical company id", async () => {
    const { id: companyId } = await setupVisibleEmployer("Target Linked Co");
    const providerJobId = uniqueSlug("target-link");
    const target = await asUser(userOne, (database) =>
      saveCareerJobTarget(database, userOne, {
        applyUrl: null,
        companyId,
        companyName: "Tampered target name",
        description: "Graduate programme description for testing.",
        employmentType: "full_time",
        fetchedAt: new Date("2026-08-13T12:00:00Z"),
        location: "London",
        provider: "jsearch",
        providerJobId,
        publishedAt: null,
        roleTitle: "Graduate Programme",
        sourcePublisher: null,
        sourceUrl: null,
      }),
    );
    const row = await migrationDatabase<{ company_id: string | null; company_name: string }[]>`
      select company_id, company_name from app.career_job_target where id = ${target.id}::uuid
    `;
    expect(row[0]).toEqual({ company_id: companyId, company_name: "Target Linked Co" });

    const { id: replacementCompanyId } = await setupVisibleEmployer("Replacement Target Co");
    await asUser(userOne, (database) =>
      saveCareerJobTarget(database, userOne, {
        applyUrl: null,
        companyId: replacementCompanyId,
        companyName: "Replacement Target Co",
        description: "Updated graduate programme description for testing.",
        employmentType: "full_time",
        fetchedAt: new Date("2026-08-13T13:00:00Z"),
        location: "Manchester",
        provider: "jsearch",
        providerJobId,
        publishedAt: null,
        roleTitle: "Updated Graduate Programme",
        sourcePublisher: null,
        sourceUrl: null,
      }),
    );
    const updated = await migrationDatabase<{ company_id: string | null; company_name: string }[]>`
      select company_id, company_name from app.career_job_target where id = ${target.id}::uuid
    `;
    expect(updated[0]).toEqual({
      company_id: replacementCompanyId,
      company_name: "Replacement Target Co",
    });

    await asUser(userOne, (database) =>
      saveCareerJobTarget(database, userOne, {
        applyUrl: null,
        companyId: "00000000-0000-4000-8000-000000000998",
        companyName: "Free Text Target Co",
        description: "Free-text fallback description.",
        employmentType: "full_time",
        fetchedAt: new Date("2026-08-13T14:00:00Z"),
        location: "Bristol",
        provider: "jsearch",
        providerJobId,
        publishedAt: null,
        roleTitle: "Free-text Graduate Programme",
        sourcePublisher: null,
        sourceUrl: null,
      }),
    );
    const unlinked = await migrationDatabase<{ company_id: string | null; company_name: string }[]>`
      select company_id, company_name from app.career_job_target where id = ${target.id}::uuid
    `;
    expect(unlinked[0]).toEqual({ company_id: null, company_name: "Free Text Target Co" });
  });
});
