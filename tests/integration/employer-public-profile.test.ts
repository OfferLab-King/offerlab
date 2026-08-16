import postgres, { type TransactionSql } from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import {
  findEmployerPublicProfile,
  listEmployerPublicDirectory,
  listIndexableEmployersForSitemap,
} from "../../src/modules/job-catalog/infrastructure/catalog-repository";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const migrationDatabase = postgres(databaseUrl, { max: 2, prepare: false });
const runtimeUrl = new URL(databaseUrl);
runtimeUrl.username = "offerlab_runtime_login";
runtimeUrl.password = "postgres";
const runtimeDatabase = postgres(runtimeUrl.toString(), { max: 2, prepare: false });

const userOne = "20000000-0000-4000-8000-000000000001";
const administrator = "20000000-0000-4000-8000-000000000003";

const uniqueSlug = (base: string): string =>
  `${base}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const createdCompanyIds = new Set<string>();

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

async function setupEmployer(
  input: Readonly<{
    name: string;
    careersUrl: string;
    industry?: string | null;
    employeeBand?: string | null;
    hasSponsor?: boolean;
    jobPublished?: boolean;
  }>,
): Promise<{ companyId: string }> {
  const company = await migrationDatabase<{ id: string }[]>`
    insert into app.company (name, slug, careers_url, source_type, employer_industry_key)
    values (${input.name}, ${uniqueSlug("pub")}, ${input.careersUrl}, 'unknown', ${input.industry ?? null})
    returning id
  `;
  const companyId = company[0]!.id;
  createdCompanyIds.add(companyId);
  if (input.employeeBand || input.industry) {
    await migrationDatabase`
      insert into app.employer_research_snapshot (
        company_id, canonical_name, dataset_version, research_date, priority_tier,
        internal_rank, research_status, employee_band
      ) values (
        ${companyId}::uuid, ${input.name}, ${`pub-test-${uniqueSlug("s")}`},
        '2026-08-12'::date, 'P0', ${Math.floor(Math.random() * 800) + 1000},
        'not_researched', ${input.employeeBand ?? null}
      )
    `;
  }
  if (input.hasSponsor) {
    await migrationDatabase`
      insert into app.employer_sponsor_entity (
        company_id, legal_name, source_snapshot_date, active_in_snapshot
      ) values (
        ${companyId}::uuid, ${`${input.name} Ltd ${uniqueSlug("s")}`}, '2026-08-12'::date, true
      )
    `;
  }
  if (input.jobPublished) {
    await migrationDatabase`
      insert into app.job (
        company_id, slug, external_job_id, application_url, title, content_hash,
        eligibility_status, publication_status, opportunity_type, sector_key
      ) values (
        ${companyId}::uuid, ${uniqueSlug("job")}, 'pub-1',
        'https://apply.example.com/x', 'Software Engineer', ${"b".repeat(64)},
        'eligible', 'published', 'graduate_job', 'technology_it'
      )
    `;
  }
  return { companyId };
}

afterAll(async () => {
  const companyIds = [...createdCompanyIds];
  if (companyIds.length > 0) {
    // app.job, app.job_source and app.job_event restrict company deletion, so
    // remove dependent rows first, then the fixtures themselves. This keeps
    // repeated local runs from accumulating employers that can push the
    // directory fixtures off the first page.
    await migrationDatabase`
      delete from app.job_event where company_id = any(${companyIds}::uuid[])
    `;
    await migrationDatabase`
      delete from app.job_source where company_id = any(${companyIds}::uuid[])
    `;
    await migrationDatabase`
      delete from app.job where company_id = any(${companyIds}::uuid[])
    `;
    await migrationDatabase`
      delete from app.employer_research_snapshot where company_id = any(${companyIds}::uuid[])
    `;
    await migrationDatabase`
      delete from app.employer_sponsor_entity where company_id = any(${companyIds}::uuid[])
    `;
    await migrationDatabase`
      delete from app.company where id = any(${companyIds}::uuid[])
    `;
  }
  await migrationDatabase.end();
  await runtimeDatabase.end();
});

describe("employer public profile view", () => {
  it("exposes public facts to the app role but never research internals", async () => {
    const { companyId } = await setupEmployer({
      name: "Public Facts Co",
      careersUrl: `https://public-facts-${uniqueSlug("u")}.example.com/careers`,
      industry: "financial_services",
      employeeBand: "10,000–49,999",
      hasSponsor: true,
    });
    await migrationDatabase`
      insert into app.job_source (
        company_id, slug, name, channel, careers_url, source_type, status
      ) values (
        ${companyId}::uuid, ${uniqueSlug("paused-public")}, 'Paused public source', 'general',
        ${`https://paused-public-${uniqueSlug("u")}.example.com`}, 'custom', 'paused'
      )
    `;
    const rows = await migrationDatabase.begin((t) =>
      listEmployerPublicDirectory(t, {
        query: "public facts",
        industry: null,
        sponsor: false,
        hiring: false,
        sizeBand: null,
        ownership: null,
        sort: "az",
        page: 1,
      }),
    );
    const row = rows.rows.find((entry) => entry.name === "Public Facts Co")!;
    expect(row.employer_industry_key).toBe("financial_services");
    expect(row.employee_band).toBe("10,000–49,999");
    expect(row.has_sponsor).toBe(true);
    expect(row.sponsor_snapshot_date).not.toBeNull();
    expect(row.live_sources).toBe(0);
    const columns = Object.keys(row);
    for (const internal of [
      "priority_tier",
      "internal_rank",
      "employer_value_score",
      "crawler_priority_score",
      "identity_confidence",
      "research_status",
      "evidence_urls",
      "notes",
    ]) {
      expect(columns).not.toContain(internal);
    }
  });

  it("keeps research tables administrator-only while the public view is readable", async () => {
    const memberCount = await asUser(
      userOne,
      (database) =>
        database<{ count: number }[]>`
        select count(*)::int as count from app.employer_research_snapshot
      `,
    );
    expect(memberCount[0]!.count).toBe(0);
    const viewCount = await asUser(
      userOne,
      (database) =>
        database<{ count: number }[]>`
        select count(*)::int as count from app.employer_public_profile
      `,
    );
    expect(viewCount[0]!.count).toBeGreaterThan(0);
  });

  it("lists hiring employers and credible zero-role profiles but excludes thin employers", async () => {
    await setupEmployer({
      name: "Hiring Co",
      careersUrl: `https://hiring-${uniqueSlug("u")}.example.com/careers`,
      industry: "technology_software",
      jobPublished: true,
    });
    await setupEmployer({
      name: "Credible Zero-Role Co",
      careersUrl: `https://credible-${uniqueSlug("u")}.example.com/careers`,
      industry: "financial_services",
      employeeBand: "1,000–4,999",
    });
    await setupEmployer({
      name: "Thin Employer Co",
      careersUrl: `https://employer.invalid/thin-${uniqueSlug("t")}`,
    });
    const rows = await migrationDatabase.begin((t) =>
      listEmployerPublicDirectory(t, {
        query: null,
        industry: null,
        sponsor: false,
        hiring: false,
        sizeBand: null,
        ownership: null,
        sort: "az",
        page: 1,
      }),
    );
    const hiring = rows.rows.find((entry) => entry.name === "Hiring Co")!;
    expect(hiring.current_jobs).toBe(1);
    const credible = rows.rows.find((entry) => entry.name === "Credible Zero-Role Co")!;
    expect(credible.current_jobs).toBe(0);
    expect(credible.employer_industry_key).toBe("financial_services");
    expect(rows.rows.some((entry) => entry.name === "Thin Employer Co")).toBe(false);
  });

  it("returns a single-employer profile by slug and includes sponsor evidence", async () => {
    const { companyId } = await setupEmployer({
      name: "Profile Slug Co",
      careersUrl: `https://profile-slug-${uniqueSlug("u")}.example.com/careers`,
      industry: "financial_services",
      hasSponsor: true,
    });
    const row = await migrationDatabase.begin(async (t) => {
      const company = await t<{ slug: string }[]>`
        select slug from app.company where id = ${companyId}::uuid
      `;
      return findEmployerPublicProfile(t, company[0]!.slug);
    });
    expect(row).not.toBeNull();
    expect(row!.has_sponsor).toBe(true);
    expect(row!.has_sponsor && row!.sponsor_snapshot_date).not.toBeNull();
  });

  it("includes credible researched profiles in the sitemap", async () => {
    await setupEmployer({
      name: "Sitemap Credible Co",
      careersUrl: `https://sitemap-credible-${uniqueSlug("u")}.example.com/careers`,
      industry: "financial_services",
      employeeBand: "10,000–49,999",
    });
    const rows = await migrationDatabase.begin((t) => listIndexableEmployersForSitemap(t, 10_000));
    const slugs = new Set(rows.map((row) => row.slug));
    const all = await migrationDatabase.begin((t) =>
      listEmployerPublicDirectory(t, {
        query: "sitemap credible",
        industry: null,
        sponsor: false,
        hiring: false,
        sizeBand: null,
        ownership: null,
        sort: "az",
        page: 1,
      }),
    );
    const credible = all.rows.find((entry) => entry.name === "Sitemap Credible Co")!;
    expect(slugs.has(credible.slug)).toBe(true);
  });

  it("allows administrators to read the public view through the app role", async () => {
    await migrationDatabase`update app."user" set role = 'administrator' where id = ${administrator}::uuid`;
    try {
      const count = await asUser(
        administrator,
        (database) =>
          database<{ count: number }[]>`
          select count(*)::int as count from app.employer_public_profile
        `,
      );
      expect(count[0]!.count).toBeGreaterThan(0);
    } finally {
      await migrationDatabase`update app."user" set role = 'member' where id = ${administrator}::uuid`;
    }
  });
});
