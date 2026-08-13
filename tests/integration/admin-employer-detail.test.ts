import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import {
  findEmployerDetail,
  readSourceCapabilityStats,
} from "../../src/modules/employer-research/infrastructure/research-repository";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const migrationDatabase = postgres(databaseUrl, { max: 2, prepare: false });

const uniqueSlug = (base: string): string =>
  `${base}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await migrationDatabase.end();
});

describe("admin employer detail reads", () => {
  it("returns identity, snapshot, sponsors, candidates and live sources for an employer", async () => {
    const company = await migrationDatabase<{ id: string }[]>`
      insert into app.company (name, slug, careers_url, source_type, employer_industry_key)
      values ('Admin Detail Co', ${uniqueSlug("admindetail")},
        ${`https://admin-detail-${uniqueSlug("u")}.example.com/careers`}, 'workday',
        'financial_services')
      returning id
    `;
    const companyId = company[0]!.id;
    await migrationDatabase`
      insert into app.employer_research_snapshot (
        company_id, canonical_name, dataset_version, research_date, priority_tier,
        internal_rank, research_status, employer_value_score, sector, employee_band
      ) values (
        ${companyId}::uuid, 'Admin Detail Co', ${`admin-test-${uniqueSlug("s")}`},
        '2026-08-12'::date, 'P0', 150, 'verified_platform', 88.5, 'Financial Services',
        '10,000–49,999'
      )
    `;
    await migrationDatabase`
      insert into app.employer_sponsor_entity (
        company_id, legal_name, source_snapshot_date, routes
      ) values (
        ${companyId}::uuid, ${`Admin Detail Legal Ltd ${uniqueSlug("l")}`}, '2026-08-12'::date,
        array['Skilled Worker']
      )
    `;
    await migrationDatabase`
      insert into app.job_source_candidate (company_id, candidate_url, platform_hint, status)
      values (${companyId}::uuid, ${`https://admin-cand-${uniqueSlug("c")}.example.com`}, 'Workday', 'verified')
    `;
    await migrationDatabase`
      insert into app.job_source (
        company_id, slug, name, channel, careers_url, source_type, status, needs_browser
      ) values (
        ${companyId}::uuid, 'admin-live', 'Admin live', 'general',
        ${`https://admin-live-${uniqueSlug("l2")}.example.com`}, 'workday', 'active', false
      )
    `;
    await migrationDatabase`
      insert into app.employer_alias (company_id, alias, alias_type, source)
      values (${companyId}::uuid, 'Admin Detail Alias', 'trading_name', 'test')
    `;

    const detail = await migrationDatabase.begin((t) => findEmployerDetail(t, companyId));
    expect(detail).not.toBeNull();
    expect(detail!.name).toBe("Admin Detail Co");
    expect(detail!.employerIndustryKey).toBe("financial_services");
    expect(detail!.snapshot?.priorityTier).toBe("P0");
    expect(detail!.snapshot?.employerValueScore).toBe(88.5);
    expect(detail!.aliases.map((alias) => alias.alias)).toContain("Admin Detail Alias");
    expect(detail!.sponsors).toHaveLength(1);
    expect(detail!.sponsors[0]!.routes).toContain("Skilled Worker");
    expect(detail!.candidates).toHaveLength(1);
    expect(detail!.candidates[0]!.platformHint).toBe("Workday");
    expect(detail!.liveSources).toHaveLength(1);
    expect(detail!.liveSources[0]!.needsBrowser).toBe(false);
    expect(detail!.liveSources[0]!.sourceType).toBe("workday");

    expect(
      await migrationDatabase.begin((t) =>
        findEmployerDetail(t, "00000000-0000-0000-0000-000000000000"),
      ),
    ).toBeNull();
  });

  it("returns capability statistics without leaking research fields", async () => {
    const stats = await migrationDatabase.begin((t) => readSourceCapabilityStats(t));
    expect(stats.liveSources).toBeGreaterThanOrEqual(0);
    expect(stats.browserSources + stats.httpSources).toBe(stats.liveSources);
    expect(stats.employersWithLiveSource).toBeGreaterThanOrEqual(0);
    expect(stats.verifiedCandidates).toBeGreaterThanOrEqual(0);
    const columns = Object.keys(stats);
    for (const internal of ["priorityTier", "internalRank", "employerValueScore"]) {
      expect(columns).not.toContain(internal);
    }
  });
});
