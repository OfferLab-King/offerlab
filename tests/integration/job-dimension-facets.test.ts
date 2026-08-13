import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import { searchJobsFaceted } from "../../src/modules/job-catalog/infrastructure/catalog-repository";
import { findJobDetail } from "../../src/modules/job-catalog/infrastructure/catalog-repository";
import { defaultJobCatalogFilters } from "../../src/modules/job-catalog/domain/catalog";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const migrationDatabase = postgres(databaseUrl, { max: 2, prepare: false });

const uniqueSlug = (base: string): string =>
  `${base}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

async function setupDimensionedEmployer(
  input: Readonly<{
    name: string;
    industry: string;
    careersUrl: string;
    hasSponsor?: boolean;
    jobs: readonly {
      title: string;
      functionKey: string;
      careerLevelKey: string;
      remoteType: string | null;
      visaStatus?: string;
    }[];
  }>,
): Promise<void> {
  const company = await migrationDatabase<{ id: string }[]>`
    insert into app.company (name, slug, careers_url, source_type, employer_industry_key)
    values (${input.name}, ${uniqueSlug("dim")}, ${input.careersUrl}, 'unknown', ${input.industry})
    returning id
  `;
  const companyId = company[0]!.id;
  if (input.hasSponsor) {
    await migrationDatabase`
      insert into app.employer_sponsor_entity (
        company_id, legal_name, source_snapshot_date, active_in_snapshot
      ) values (
        ${companyId}::uuid, ${`${input.name} Ltd ${uniqueSlug("s")}`}, '2026-08-12'::date, true
      )
    `;
  }
  for (const [index, jobInput] of input.jobs.entries()) {
    const job = await migrationDatabase<{ id: string }[]>`
      insert into app.job (
        company_id, slug, external_job_id, application_url, title, content_hash,
        eligibility_status, publication_status, opportunity_type, sector_key,
        job_function_key, career_level_key, remote_type, visa_sponsorship_status
      ) values (
        ${companyId}::uuid, ${uniqueSlug("job")}, ${`dim-${index}`},
        'https://apply.example.com/x', ${jobInput.title}, ${"c".repeat(64)},
        'eligible', 'published', 'graduate_job', 'technology_it',
        ${jobInput.functionKey}, ${jobInput.careerLevelKey}, ${jobInput.remoteType},
        ${jobInput.visaStatus ?? "unknown"}
      )
      returning id
    `;
    if (jobInput.remoteType) {
      await migrationDatabase`
        insert into app.job_location (job_id, city, region, country, source_text, remote, on_site)
        values (${job[0]!.id}::uuid, 'London', 'London', 'United Kingdom', 'London',
          ${jobInput.remoteType === "remote"}, ${jobInput.remoteType === "on_site"})
      `;
    }
  }
}

afterAll(async () => {
  await migrationDatabase.end();
});

describe("job dimension facets", () => {
  it("filters by employer industry, job function and career level", async () => {
    await setupDimensionedEmployer({
      name: "Dimension Bank",
      industry: "financial_services",
      careersUrl: `https://dimension-bank-${uniqueSlug("u")}.example.com/careers`,
      hasSponsor: true,
      jobs: [
        {
          title: "Graduate Software Engineer",
          functionKey: "software_engineering",
          careerLevelKey: "graduate",
          remoteType: "hybrid",
        },
        {
          title: "Internal Audit Associate",
          functionKey: "finance_accounting",
          careerLevelKey: "experienced",
          remoteType: "on_site",
        },
      ],
    });

    const byIndustry = await migrationDatabase.begin((t) =>
      searchJobsFaceted(t, {
        ...defaultJobCatalogFilters,
        industries: ["financial_services"],
      }),
    );
    expect(byIndustry.result.total).toBeGreaterThanOrEqual(2);
    const industryOption = byIndustry.facets.industries.find(
      (option) => option.value === "financial_services",
    );
    expect(industryOption).toBeDefined();

    const byFunction = await migrationDatabase.begin((t) =>
      searchJobsFaceted(t, {
        ...defaultJobCatalogFilters,
        functions: ["software_engineering"],
      }),
    );
    expect(byFunction.result.total).toBeGreaterThanOrEqual(1);
    expect(
      byFunction.result.items.every((job) => job.job_function_key === "software_engineering"),
    ).toBe(true);

    const byLevel = await migrationDatabase.begin((t) =>
      searchJobsFaceted(t, {
        ...defaultJobCatalogFilters,
        levels: ["graduate"],
      }),
    );
    expect(byLevel.result.total).toBeGreaterThanOrEqual(1);
    const levelOption = byLevel.facets.levels.find((option) => option.value === "graduate");
    expect(levelOption).toBeDefined();
  });

  it("filters by work arrangement separately from location", async () => {
    await setupDimensionedEmployer({
      name: "Dimension Tech",
      industry: "technology_software",
      careersUrl: `https://dimension-tech-${uniqueSlug("u")}.example.com/careers`,
      jobs: [
        {
          title: "Remote Platform Engineer",
          functionKey: "software_engineering",
          careerLevelKey: "experienced",
          remoteType: "remote",
        },
        {
          title: "On-Site Support Analyst",
          functionKey: "cybersecurity_it",
          careerLevelKey: "experienced",
          remoteType: "on_site",
        },
      ],
    });
    const byMode = await migrationDatabase.begin((t) =>
      searchJobsFaceted(t, {
        ...defaultJobCatalogFilters,
        workModes: ["remote"],
      }),
    );
    expect(byMode.result.total).toBeGreaterThanOrEqual(1);
    expect(byMode.result.items.every((job) => job.remote_type === "remote")).toBe(true);
    const workModeOption = byMode.facets.workModes.find((option) => option.value === "remote");
    expect(workModeOption).toBeDefined();
    const locationFacet = byMode.facets.locations;
    expect(
      locationFacet.some((option) => option.value === "remote" || option.value === "hybrid"),
    ).toBe(false);
  });

  it("filters by employer sponsor licence through the public profile view", async () => {
    const byLicence = await migrationDatabase.begin((t) =>
      searchJobsFaceted(t, {
        ...defaultJobCatalogFilters,
        sponsorLicence: true,
      }),
    );
    expect(byLicence.result.total).toBeGreaterThanOrEqual(1);
    expect(byLicence.result.items.every((job) => job.company_has_sponsor === true)).toBe(true);
    expect(byLicence.facets.sponsorLicence.length).toBeGreaterThan(0);
  });

  it("returns the new job facts and employer context on the detail row", async () => {
    const company = await migrationDatabase<{ id: string }[]>`
      insert into app.company (name, slug, careers_url, source_type, employer_industry_key)
      values ('Detail Dimension Co', ${uniqueSlug("detail")},
        ${`https://detail-dim-${uniqueSlug("u")}.example.com/careers`}, 'unknown',
        'financial_services')
      returning id
    `;
    const job = await migrationDatabase<{ slug: string }[]>`
      insert into app.job (
        company_id, slug, external_job_id, application_url, title, content_hash,
        eligibility_status, publication_status, opportunity_type, sector_key,
        job_function_key, job_subfunction_key, career_level_key, remote_type
      ) values (
        ${company[0]!.id}::uuid, ${uniqueSlug("detail-job")}, 'dim-detail',
        'https://apply.example.com/d', 'Quant Analyst', ${"e".repeat(64)},
        'eligible', 'published', 'graduate_job', 'technology_it',
        'markets_trading_research', 'quant', 'graduate', 'on_site'
      )
      returning slug
    `;
    const detail = await migrationDatabase.begin((t) => findJobDetail(t, job[0]!.slug));
    expect(detail).not.toBeNull();
    expect(detail!.job_function_key).toBe("markets_trading_research");
    expect(detail!.job_subfunction_key).toBe("quant");
    expect(detail!.career_level_key).toBe("graduate");
    expect(detail!.employer_industry_key).toBe("financial_services");
  });
});
