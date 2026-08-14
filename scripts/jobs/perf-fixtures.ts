/**
 * Deterministic synthetic performance fixtures for the job catalogue.
 *
 * This script populates a local (disposable) database with a realistic
 * employer universe and job catalogue so web request latency can be measured
 * at representative scale. It never touches production data and never crawls
 * anything: every URL uses the reserved .example.com domain and every row is
 * prefixed `perf-` so it can be removed idempotently by re-running the script
 * (cleanup runs first) or with `pnpm jobs:clean-synthetic-catalog`-style SQL.
 *
 * Usage:
 *   DATABASE_MIGRATION_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres \
 *     PERF_COMPANIES=1000 PERF_JOBS=5000 \
 *     tsx scripts/jobs/perf-fixtures.ts
 *
 * Defaults: 1,000 companies and 5,000 jobs.
 */

import postgres from "postgres";

import { loadLocalEnvironment } from "../shared/load-local-environment";

loadLocalEnvironment();

const databaseUrl = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL ?? "";
if (!databaseUrl) {
  throw new Error("DATABASE_MIGRATION_URL (superuser) is required.");
}

const companyCount = Number(process.env.PERF_COMPANIES ?? "1000");
const jobCount = Number(process.env.PERF_JOBS ?? "5000");
const perfPrefix = "perf-";

const database = postgres(databaseUrl, { max: 6, prepare: false });

/** Small deterministic PRNG so fixture runs are reproducible. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(0xc0ffee);
const pick = <T>(values: readonly T[]): T => values[Math.floor(random() * values.length)]!;

const INDUSTRIES = [
  "financial_services",
  "professional_services_consulting",
  "technology_software",
  "engineering_manufacturing",
  "energy_utilities_infrastructure",
  "consumer_retail_fmcg",
  "healthcare_pharma_life_sciences",
  "media_telecom_entertainment",
  "transport_logistics_travel",
  "real_estate_construction",
  "legal_services",
  "public_sector_government",
  "education_research",
  "charity_nonprofit",
  "hospitality_leisure",
  "other",
] as const;

const FUNCTIONS = [
  "finance_accounting",
  "investment_banking_corporate_finance",
  "markets_trading_research",
  "asset_wealth_investment_management",
  "consulting_strategy",
  "software_engineering",
  "data_analytics_ai",
  "product_management",
  "cybersecurity_it",
  "engineering",
  "science_research",
  "operations_supply_chain",
  "project_programme_management",
  "sales_business_development",
  "marketing_communications",
  "human_resources_recruitment",
  "legal",
  "risk_compliance_controls",
  "customer_service",
  "design_ux",
  "healthcare_clinical",
  "public_policy_government",
  "administration",
  "other",
] as const;

const LEVELS = [
  "school_leaver",
  "student",
  "intern",
  "graduate",
  "entry_level",
  "junior",
  "experienced",
  "manager",
  "senior_leadership",
  "unknown",
] as const;

const OPPORTUNITY_TYPES = [
  "graduate_scheme",
  "graduate_job",
  "internship",
  "industrial_placement",
  "work_experience",
  "apprenticeship",
  "degree_apprenticeship",
  "immediate_start",
  "knowledge_transfer_partnership",
  "training_contract",
  "vacation_scheme",
  "entry_level",
  "junior",
  "postgraduate_opportunity",
  "other_early_career",
  "unknown",
] as const;

const REMOTE_TYPES = ["remote", "hybrid", "on_site", "unknown"] as const;
const VISA_STATUSES = ["confirmed", "likely", "not_offered", "unknown"] as const;

const SECTORS = [
  "consulting",
  "consumer_fmcg_retail",
  "engineering_energy_infrastructure",
  "financial_services",
  "investment_banking_asset_management",
  "law",
  "management_operations",
  "marketing_media_pr",
  "pharmaceuticals_science",
  "public_sector_charity",
  "sales_recruitment_commercial",
  "technology_it",
] as const;

const SUBSECTORS: Readonly<Record<string, readonly string[]>> = {
  consulting: [
    "consulting_project_management",
    "financial_consulting",
    "management_consulting",
    "strategy_consulting",
  ],
  consumer_fmcg_retail: ["consumer_goods_fmcg", "retail_fashion", "supply_chain_logistics"],
  engineering_energy_infrastructure: [
    "architecture",
    "engineering",
    "energy",
    "property_construction",
  ],
  financial_services: ["accounting_audit_tax", "insurance_pensions", "retail_corporate_banking"],
  investment_banking_asset_management: [
    "asset_investment_management",
    "investment_banking",
    "private_equity",
    "trading",
  ],
  law: ["commercial_law", "criminal_law"],
  management_operations: [
    "business_management",
    "entrepreneurship",
    "human_resources",
    "operations_communications",
  ],
  marketing_media_pr: ["journalism_publishing", "marketing", "media_film_tv", "public_relations"],
  pharmaceuticals_science: ["pharmaceuticals", "science_research"],
  public_sector_charity: [
    "charity_social_enterprise",
    "education_teaching",
    "public_sector_government",
  ],
  sales_recruitment_commercial: ["recruitment", "sales_commercial"],
  technology_it: [
    "cyber_security",
    "data_science_analytics",
    "it_infrastructure",
    "software_development",
  ],
  other: ["other"],
};

const CITIES = [
  "London",
  "Manchester",
  "Birmingham",
  "Leeds",
  "Edinburgh",
  "Glasgow",
  "Bristol",
  "Cardiff",
  "Liverpool",
  "Newcastle",
  "Sheffield",
  "Nottingham",
  "Reading",
  "Cambridge",
  "Oxford",
  "Belfast",
  "Aberdeen",
  "Brighton",
];

const EMPLOYEE_BANDS = [
  "1-49",
  "50-249",
  "250-999",
  "1,000-4,999",
  "5,000-9,999",
  "10,000-49,999",
  "50,000-99,999",
  "100,000+",
];

const OWNERSHIP_TYPES = ["Public", "Private", "Government", "Charity", "Partnership"];

const TITLE_POOL = [
  "Graduate Software Engineer",
  "Audit Associate",
  "Management Consultant",
  "Investment Banking Analyst",
  "Data Analyst",
  "Marketing Executive",
  "Actuarial Analyst",
  "Civil Engineering Graduate",
  "Product Manager",
  "Financial Analyst",
  "Quantitative Analyst",
  "HR Business Partner",
  "Cybersecurity Analyst",
  "Operations Graduate",
  "Chartered Accountant Trainee",
  "Solicitor Trainee",
  "Supply Chain Graduate",
  "Sales Executive",
  "Tax Associate",
  "Research Scientist",
  "UX Designer",
  "Project Manager",
  "Risk Analyst",
  "Business Development Manager",
  "Mechanical Engineer",
  "Intern - Technology",
  "Placement Year - Finance",
  "Apprentice - Software Development",
  "Graduate Scheme - Consulting",
  "Summer Internship - Banking",
  "Insight Week - Technology",
  "Experienced Hire - Data Engineering",
  "General Application - Early Careers",
];

function jobTitleFor(index: number): string {
  const base = pick(TITLE_POOL);
  return `${base} ${index % 97}`;
}

async function cleanup(): Promise<void> {
  await database`
    delete from app.job_location
    where job_id in (select id from app.job where external_job_id like ${`${perfPrefix}%`})
  `;
  await database`
    delete from app.job where external_job_id like ${`${perfPrefix}%`}
  `;
  await database`delete from app.employer_alias where company_id in (select id from app.company where slug like ${`${perfPrefix}%`})`;
  await database`delete from app.employer_sponsor_entity where company_id in (select id from app.company where slug like ${`${perfPrefix}%`})`;
  await database`delete from app.employer_research_snapshot where company_id in (select id from app.company where slug like ${`${perfPrefix}%`})`;
  await database`delete from app.job_source_candidate where company_id in (select id from app.company where slug like ${`${perfPrefix}%`})`;
  await database`delete from app.job_source where company_id in (select id from app.company where slug like ${`${perfPrefix}%`})`;
  await database`delete from app.company where slug like ${`${perfPrefix}%`}`;
  process.stdout.write(`Cleaned previous perf fixtures.\n`);
}

async function seedCompanies(): Promise<string[]> {
  const companyIds: string[] = [];
  for (let i = 0; i < companyCount; i++) {
    const industry = INDUSTRIES[i % INDUSTRIES.length]!;
    const name = `Perf Employer ${String(i + 1).padStart(4, "0")}`;
    const slug = `${perfPrefix}employer-${String(i + 1).padStart(4, "0")}`;
    const [row] = await database<{ id: string }[]>`
      insert into app.company (
        name, slug, website_url, careers_url, logo_url, industry,
        country, source_type, active, directory_visible,
        employer_industry_key, directory_sector_key, directory_priority_rank,
        last_successful_check_at
      ) values (
        ${name}, ${slug}, ${`https://www.example.com/${slug}`},
        ${`https://careers.example.com/${slug}`}, ${`https://logo.example.com/${slug}.png`},
        ${industry}, 'UK', 'unknown', true, true,
        ${industry}, ${SECTORS[i % SECTORS.length]!}, ${i < 500 ? i + 1 : null},
        now() - interval '2 days'
      )
      on conflict (slug) do update set
        name = excluded.name,
        employer_industry_key = excluded.employer_industry_key,
        directory_visible = true
      returning id
    `;
    companyIds.push(row!.id);
    if ((i + 1) % 250 === 0) process.stdout.write(`companies: ${i + 1}/${companyCount}\n`);
  }
  return companyIds;
}

async function seedResearch(companyIds: readonly string[]): Promise<void> {
  const snapshotRows: Record<string, unknown>[] = [];
  const sponsorRows: Record<string, unknown>[] = [];
  const aliasRows: Record<string, unknown>[] = [];
  const sourceRows: Record<string, unknown>[] = [];
  const now = new Date();
  for (let i = 0; i < companyIds.length; i++) {
    const id = companyIds[i]!;
    const band = pick(EMPLOYEE_BANDS);
    const ownership = pick(OWNERSHIP_TYPES);
    snapshotRows.push({
      company_id: id,
      canonical_name: `Perf Employer ${String(i + 1).padStart(4, "0")}`,
      dataset_version: "perf-v1",
      research_date: now.toISOString().slice(0, 10),
      priority_tier: pick(["P0", "P1", "P2", "P3"]),
      internal_rank: i + 1,
      sponsorship_score: 30 + Math.round(random() * 70),
      scale_score: 30 + Math.round(random() * 70),
      employee_band: band,
      employee_scope: pick(["Global", "UK", "EMEA"]),
      ownership_type: ownership,
      ticker: i % 3 === 0 ? "TICK" : null,
      exchange: i % 3 === 0 ? "LSE" : null,
      identity_confidence: "High",
      research_status: "verified_careers_url",
      evidence_urls: [],
    });
    if (random() < 0.62) {
      sponsorRows.push({
        company_id: id,
        legal_name: `Perf Employer ${String(i + 1).padStart(4, "0")} Ltd`,
        town_city: pick(["London", "Manchester", "Birmingham"]),
        sponsor_rating: pick(["A", "B", "C", null]),
        routes: ["skilled_worker", "graduate"],
        source_snapshot_date: now.toISOString().slice(0, 10),
        active_in_snapshot: true,
        identity_confidence: "High",
      });
    }
    if (random() < 0.3) {
      aliasRows.push({
        company_id: id,
        alias: `Perf Employer ${String(i + 1).padStart(4, "0")} (trading)`,
        alias_type: "trading_name",
        source: "research",
      });
    }
    if (random() < 0.9) {
      sourceRows.push({
        company_id: id,
        slug: `${perfPrefix}source-${String(i + 1).padStart(4, "0")}`,
        name: "All careers",
        channel: "general",
        careers_url: `https://careers.example.com/${perfPrefix}employer-${String(i + 1).padStart(4, "0")}`,
        crawl_endpoint_url: null,
        ats_provider: null,
        source_type: pick([
          "workday",
          "greenhouse",
          "lever",
          "ashby",
          "smartrecruiters",
          "direct_html",
          "custom",
        ]),
        status: "active",
        landing_health_status: "healthy",
        endpoint_health_status: "healthy",
        verification_date: "2026-08-01",
        verification_evidence_url: `https://example.com/${perfPrefix}employer-${String(i + 1).padStart(4, "0")}/careers`,
      });
    }
  }

  const batchSize = 500;
  for (let i = 0; i < snapshotRows.length; i += batchSize) {
    await database`insert into app.employer_research_snapshot ${database(snapshotRows.slice(i, i + batchSize))}`;
  }
  for (let i = 0; i < sponsorRows.length; i += batchSize) {
    await database`insert into app.employer_sponsor_entity ${database(sponsorRows.slice(i, i + batchSize))}`;
  }
  for (let i = 0; i < aliasRows.length; i += batchSize) {
    await database`insert into app.employer_alias ${database(aliasRows.slice(i, i + batchSize))}`;
  }
  for (let i = 0; i < sourceRows.length; i += batchSize) {
    await database`insert into app.job_source ${database(sourceRows.slice(i, i + batchSize))}`;
  }
  process.stdout.write(
    `research records: snapshots=${snapshotRows.length} sponsors=${sponsorRows.length} aliases=${aliasRows.length} sources=${sourceRows.length}\n`,
  );
}

async function seedJobs(companyIds: readonly string[]): Promise<void> {
  const now = Date.now();
  const day = 86_400_000;
  const jobRows: Record<string, unknown>[] = [];
  for (let i = 0; i < jobCount; i++) {
    const companyId = companyIds[i % companyIds.length]!;
    const sector = SECTORS[i % SECTORS.length]!;
    const subsector = pick(SUBSECTORS[sector]!);
    const opportunityType = pick(OPPORTUNITY_TYPES);
    const remoteType = pick(REMOTE_TYPES);
    const visaStatus = pick(VISA_STATUSES);
    const level = pick(LEVELS);
    const functionKey = pick(FUNCTIONS);
    const salary = random() < 0.35;
    const salaryMin = salary ? 25_000 + Math.round(random() * 45_000) : null;
    const salaryMax = salaryMin !== null ? salaryMin + 5_000 + Math.round(random() * 40_000) : null;
    const deadline =
      random() < 0.75
        ? new Date(now + (2 + Math.round(random() * 60)) * day)
        : random() < 0.5
          ? null
          : new Date(now - day);
    const published = random() < 0.88;
    const eligibility = random() < 0.93 ? "eligible" : "ineligible";
    const title = jobTitleFor(i);
    const city = pick(CITIES);
    const slug = `${perfPrefix}job-${String(i + 1).padStart(6, "0")}`;
    const sourceUrl = `https://careers.example.com/jobs/${String(i + 1).padStart(6, "0")}`;
    jobRows.push({
      company_id: companyId,
      slug,
      external_job_id: `${perfPrefix}${String(i + 1).padStart(6, "0")}`,
      source_url: sourceUrl,
      application_url: `${sourceUrl}/apply`,
      title,
      normalized_title: title.toLowerCase(),
      location_text: city,
      city,
      country: "United Kingdom",
      remote_type: remoteType,
      employment_type: pick([
        "full_time",
        "part_time",
        "internship",
        "graduate_programme",
        "contract",
        "other",
      ]),
      seniority_level: pick(["intern", "graduate", "entry", "junior", "mid", "senior", null]),
      salary_min: salaryMin,
      salary_max: salaryMax,
      salary_currency: salary ? "GBP" : null,
      salary_period: salary ? pick(["yearly", "pro_rata"]) : null,
      description_text: `Synthetic benchmark description for ${title}.`,
      description_summary: "Responsibilities include delivery of high quality work.",
      visa_sponsorship_status: visaStatus,
      visa_sponsorship_evidence:
        visaStatus === "unknown" ? null : "Stored synthetic sponsorship evidence",
      application_deadline: deadline,
      posted_at: new Date(now - Math.round(random() * 30) * day),
      first_seen_at: new Date(now - Math.round(random() * 30) * day),
      last_seen_at: new Date(now - Math.round(random() * 30) * day),
      last_changed_at: new Date(now - Math.round(random() * 30) * day),
      content_hash: "a".repeat(64),
      sector_key: sector,
      subsector_key: subsector,
      opportunity_type: opportunityType,
      job_function_key: functionKey,
      career_level_key: level,
      publication_status: published ? "published" : pick(["draft", "suppressed", "expired"]),
      eligibility_status: eligibility,
      active: true,
    });
  }

  const batchSize = 1000;
  for (let i = 0; i < jobRows.length; i += batchSize) {
    await database`insert into app.job ${database(jobRows.slice(i, i + batchSize))}`;
  }
  await database`
    insert into app.job_location (job_id, city, region, country, source_text, remote, hybrid, on_site)
    select j.id, j.city, j.city, 'United Kingdom', j.city,
      j.remote_type = 'remote', j.remote_type = 'hybrid', j.remote_type = 'on_site'
    from app.job j
    where j.external_job_id like ${`${perfPrefix}%`}
  `;
  process.stdout.write(`jobs: ${jobRows.length}\n`);
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  await cleanup();
  const companyIds = await seedCompanies();
  await seedResearch(companyIds);
  await seedJobs(companyIds);
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  process.stdout.write(
    `perf fixtures ready: ${companyIds.length} companies, ${jobCount} jobs in ${elapsed}s\n`,
  );
  await database.end();
}

main().catch(async (error) => {
  process.stderr.write(`${String(error)}\n`);
  await database.end();
  process.exit(1);
});
