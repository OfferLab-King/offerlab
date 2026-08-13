import postgres, { type TransactionSql } from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import { runTaxonomyBackfill } from "../../src/modules/taxonomy/application/taxonomy-backfill";
import { employerIndustries } from "../../src/modules/taxonomy/employer-industry";
import { jobFunctions } from "../../src/modules/taxonomy/job-function";
import { careerLevels } from "../../src/modules/taxonomy/career-level";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const migrationDatabase = postgres(databaseUrl, { max: 2, prepare: false });

const uniqueSlug = (base: string): string =>
  `${base}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

async function asUser<T>(
  userId: string,
  operation: (database: TransactionSql) => PromiseLike<T>,
): Promise<T> {
  return (await migrationDatabase.begin(async (transaction) => {
    await transaction`set local role offerlab_app`;
    await transaction`select set_config('app.current_user_id', ${userId}, true)`;
    return operation(transaction);
  })) as T;
}

afterAll(async () => {
  await migrationDatabase.end();
});

describe("taxonomy dimensions", () => {
  it("seeds reference tables with the typed contract keys", async () => {
    const industries = await migrationDatabase<{ industry_key: string }[]>`
      select industry_key from app.employer_industry order by position
    `;
    const functions = await migrationDatabase<{ function_key: string }[]>`
      select function_key from app.job_function order by position
    `;
    const levels = await migrationDatabase<{ level_key: string }[]>`
      select level_key from app.job_career_level order by position
    `;
    const subindustries = await migrationDatabase<{ subindustry_key: string }[]>`
      select subindustry_key from app.employer_subindustry
    `;
    const subfunctions = await migrationDatabase<{ subfunction_key: string }[]>`
      select subfunction_key from app.job_subfunction
    `;
    expect(industries.map((row) => row.industry_key)).toEqual([...employerIndustries]);
    expect(functions.map((row) => row.function_key)).toEqual([...jobFunctions]);
    expect(levels.map((row) => row.level_key)).toEqual([...careerLevels]);
    expect(subindustries.length).toBeGreaterThan(50);
    expect(subfunctions.length).toBeGreaterThan(50);
  });

  it("keeps reference tables readable by the app and crawler roles", async () => {
    const member = "20000000-0000-4000-8000-000000000001";
    const asMember = await asUser(
      member,
      (database) =>
        database<{ count: number }[]>`
        select count(*)::int as count from app.job_function
      `,
    );
    expect(asMember[0]!.count).toBe(jobFunctions.length);
    const asCrawler = await migrationDatabase.begin(async (transaction) => {
      await transaction`set local role offerlab_crawler`;
      const rows = await transaction<{ count: number }[]>`
        select count(*)::int as count from app.employer_industry
      `;
      return rows;
    });
    expect(asCrawler[0]!.count).toBe(employerIndustries.length);
  });

  it("backfills employer industry from research evidence without touching jobs", async () => {
    const company = await migrationDatabase<{ id: string }[]>`
      insert into app.company (name, slug, careers_url, source_type, directory_sector_key)
      values ('Taxonomy Co', ${uniqueSlug("taxco")}, 'https://taxco.example.com/careers', 'unknown', 'technology_it')
      returning id
    `;
    await migrationDatabase`
      insert into app.employer_research_snapshot (
        company_id, canonical_name, dataset_version, research_date, priority_tier,
        internal_rank, research_status, sector
      ) values (
        ${company[0]!.id}::uuid, 'Taxonomy Co', ${`tax-test-${uniqueSlug("t")}`},
        '2026-08-12'::date, 'P0', ${Math.floor(Math.random() * 800) + 2000},
        'not_researched', 'Technology'
      )
    `;
    const dry = await migrationDatabase.begin((t) => runTaxonomyBackfill(t, false));
    expect(dry.mode).toBe("dry_run");
    const unset = await migrationDatabase<{ employer_industry_key: string | null }[]>`
      select employer_industry_key from app.company where id = ${company[0]!.id}::uuid
    `;
    expect(unset[0]!.employer_industry_key).toBeNull();

    const applied = await migrationDatabase.begin((t) => runTaxonomyBackfill(t, true));
    expect(applied.companiesApplied).toBeGreaterThan(0);
    const set = await migrationDatabase<{ employer_industry_key: string | null }[]>`
      select employer_industry_key from app.company where id = ${company[0]!.id}::uuid
    `;
    expect(set[0]!.employer_industry_key).toBe("technology_software");

    const second = await migrationDatabase.begin((t) => runTaxonomyBackfill(t, true));
    expect(second.companiesApplied).toBe(0);
  });

  it("backfills job function and career level from legacy classification, preserving publication state", async () => {
    const company = await migrationDatabase<{ id: string }[]>`
      insert into app.company (name, slug, careers_url, source_type)
      values ('Backfill Co', ${uniqueSlug("backfill")}, 'https://backfill.example.com/careers', 'unknown')
      returning id
    `;
    const job = await migrationDatabase<{ id: string }[]>`
      insert into app.job (
        company_id, slug, external_job_id, application_url, title, content_hash,
        sector_key, subsector_key, opportunity_type,
        eligibility_status, publication_status, classification_source
      ) values (
        ${company[0]!.id}::uuid, ${uniqueSlug("job")}, 'tax-1',
        'https://backfill.example.com/apply', 'Graduate Software Engineer',
        ${"a".repeat(64)}, 'technology_it', 'software_development', 'graduate_job',
        'eligible', 'published', 'deterministic'
      )
      returning id
    `;
    const report = await migrationDatabase.begin((t) => runTaxonomyBackfill(t, true));
    expect(report.jobFunctionsApplied).toBeGreaterThan(0);
    expect(report.careerLevelsApplied).toBeGreaterThan(0);

    const row = await migrationDatabase<
      {
        job_function_key: string | null;
        career_level_key: string | null;
        publication_status: string;
        eligibility_status: string;
      }[]
    >`
      select job_function_key, career_level_key, publication_status, eligibility_status
      from app.job where id = ${job[0]!.id}::uuid
    `;
    expect(row[0]!.job_function_key).toBe("software_engineering");
    expect(row[0]!.career_level_key).toBe("graduate");
    expect(row[0]!.publication_status).toBe("published");
    expect(row[0]!.eligibility_status).toBe("eligible");

    const second = await migrationDatabase.begin((t) => runTaxonomyBackfill(t, true));
    expect(second.jobFunctionsApplied).toBe(0);
    expect(second.careerLevelsApplied).toBe(0);
  });
});
