import postgres, { type TransactionSql } from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import {
  importReviewCandidates,
  runEmployerTargetsImport,
} from "../../src/modules/employer-research/application/import-targets";
import type { EmployerResearchRow } from "../../src/modules/employer-research/domain/research-row";
import { upsertCompany } from "../../src/modules/job-catalog/infrastructure/company-repository";
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

const DATASET_VERSION = `test-dataset-${uniqueSlug("suite")}`;
const RESEARCH_DATE = "2026-08-12";

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

function researchRow(overrides: Partial<EmployerResearchRow> = {}): EmployerResearchRow {
  return {
    rank: 1,
    priorityTier: "P0",
    crawlerWave: null,
    canonicalEmployer: "Acme Research Ltd",
    primarySponsorLegalEntity: "Acme Research Ltd",
    townCity: "London",
    identityConfidence: "High",
    identityMappingNote: null,
    employerValueScore: 90,
    crawlerReadinessScore: 50,
    crawlerPriorityScore: 70,
    sponsorshipScore: 80,
    earlyCareerScore: 60,
    scaleScore: 50,
    brandMarketScore: 70,
    ukRelevanceScore: 90,
    sectorScore: null,
    listingOwnershipScore: null,
    sourceLeverageScore: null,
    sector: "Technology",
    subsector: "Software",
    financeAssetClass: null,
    employeeCount: 5000,
    employeeBand: "5,000–9,999",
    employeeScope: "Global",
    employeeSource: "Public reports",
    employeeConfidence: "High",
    ownership: "Private company / subsidiary legal entity",
    ownershipConfidence: null,
    ticker: null,
    exchange: null,
    skilledWorkerSponsor: true,
    graduateTraineeRoute: false,
    seniorSpecialistRoute: false,
    sponsorRoutes: null,
    careerSearchUrl: null,
    atsPlatform: null,
    atsVerificationStatus: null,
    atsEvidenceNotes: null,
    sourceVerificationDate: null,
    currentJobsObserved: null,
    currentJobsScopeNote: null,
    recommendedDiscoveryStrategy: null,
    researchStatus: "verified_platform",
    evidenceUrls: [],
    notes: null,
    ...overrides,
  };
}

async function count(table: string): Promise<number> {
  const rows = await migrationDatabase<{ count: number }[]>`
    select count(*)::int as count from app.${migrationDatabase(table)}
  `;
  return rows[0]!.count;
}
afterAll(async () => {
  await migrationDatabase.end();
  await runtimeDatabase.end();
});

describe("employer research import pipeline", () => {
  it("dry run reports a plan and writes nothing", async () => {
    const rows = [
      researchRow({
        rank: 1,
        canonicalEmployer: `Dry Run Employer ${uniqueSlug("dry")}`,
        primarySponsorLegalEntity: null,
      }),
    ];
    const before = {
      companies: await count("company"),
      sponsors: await count("employer_sponsor_entity"),
      snapshots: await count("employer_research_snapshot"),
      candidates: await count("job_source_candidate"),
    };
    const report = await migrationDatabase.begin((transaction) =>
      runEmployerTargetsImport(transaction, rows, {
        datasetVersion: DATASET_VERSION,
        researchDate: RESEARCH_DATE,
        apply: false,
      }),
    );
    expect(report.plan.newEmployers).toHaveLength(1);
    expect(report.plan.matchedEmployers).toHaveLength(0);
    expect(report.applied).toEqual({});
    expect({
      companies: await count("company"),
      sponsors: await count("employer_sponsor_entity"),
      snapshots: await count("employer_research_snapshot"),
      candidates: await count("job_source_candidate"),
    }).toEqual(before);
  });

  it("confirm import creates employers, aliases, sponsors, snapshots and candidates", async () => {
    const runKey = uniqueSlug("run");
    const matchedName = `Matched Research Co ${runKey}`;
    const existingId = await migrationDatabase.begin((transaction) =>
      upsertCompany(transaction, {
        name: matchedName,
        slug: uniqueSlug("matched-research"),
        careersUrl: `https://matched-${runKey}.example.com/careers`,
        sourceType: "unknown",
        crawlAllowed: "unknown",
      }),
    );
    const rows = [
      researchRow({
        rank: 101,
        canonicalEmployer: `New Research Co ${uniqueSlug("newco")}`,
        primarySponsorLegalEntity: `New Research Legal Entity Ltd ${runKey}`,
        identityConfidence: "High",
        careerSearchUrl: `https://newco-${runKey}.example.com/careers`,
        evidenceUrls: [`https://newco-${runKey}.example.com`],
        atsPlatform: "Workday",
      }),
      researchRow({
        rank: 102,
        canonicalEmployer: matchedName,
        primarySponsorLegalEntity: `Matched Research Legal Entity Ltd ${runKey}`,
        identityConfidence: "High",
        careerSearchUrl: `https://matched-${runKey}.example.com/careers/search`,
        evidenceUrls: [`https://matched-${runKey}.example.com`],
      }),
    ];
    const report = await migrationDatabase.begin((transaction) =>
      runEmployerTargetsImport(transaction, rows, {
        datasetVersion: DATASET_VERSION,
        researchDate: RESEARCH_DATE,
        apply: true,
      }),
    );
    expect(report.plan.newEmployers).toHaveLength(1);
    expect(report.plan.matchedEmployers).toHaveLength(1);
    expect(report.plan.updatedEmployers).toHaveLength(1);
    expect(report.applied.newEmployers).toBe(1);
    expect(report.applied.updatedEmployers).toBe(1);
    expect(report.applied.sponsorsAdded).toBe(2);
    expect(report.applied.snapshotsAdded).toBe(2);
    expect(report.applied.candidatesAdded).toBe(2);

    const newCompany = await migrationDatabase<{ id: string; slug: string }[]>`
      select id, slug from app.company where name = ${rows[0]!.canonicalEmployer}
    `;
    expect(newCompany).toHaveLength(1);
    expect(newCompany[0]!.slug).toBe(report.plan.newEmployers[0]!.proposedSlug);

    const snapshots = await migrationDatabase<{ internal_rank: number }[]>`
      select internal_rank from app.employer_research_snapshot
      where dataset_version = ${DATASET_VERSION} and research_date = ${RESEARCH_DATE}::date
    `;
    expect(snapshots.map((entry) => entry.internal_rank).sort()).toEqual([101, 102]);

    const sponsors = await migrationDatabase<{ legal_name: string; company_id: string | null }[]>`
      select legal_name, company_id from app.employer_sponsor_entity
      where legal_name like ${`% ${runKey}`}
    `;
    expect(sponsors).toHaveLength(2);
    const linked = sponsors.filter((entry) => entry.company_id !== null);
    expect(linked.map((entry) => entry.company_id)).toContain(existingId);

    const candidates = await migrationDatabase<{ candidate_url: string }[]>`
      select candidate_url from app.job_source_candidate
      where candidate_url like ${`https://%-${runKey}.example.com%`}
    `;
    expect(candidates.map((entry) => entry.candidate_url)).toContain(
      `https://newco-${runKey}.example.com/careers`,
    );

    const alias = await migrationDatabase<{ alias: string }[]>`
      select alias from app.employer_alias
      where alias = ${`Matched Research Legal Entity Ltd ${runKey}`}
    `;
    expect(alias).toHaveLength(1);
  });

  it("is idempotent: a second confirm import adds nothing", async () => {
    const runKey = uniqueSlug("idem");
    const rows = [
      researchRow({
        rank: 201,
        canonicalEmployer: `Idempotent Co ${runKey}`,
        primarySponsorLegalEntity: `Idempotent Legal Ltd ${runKey}`,
        identityConfidence: "High",
        careerSearchUrl: `https://idem-${runKey}.example.com/careers`,
      }),
    ];
    const first = await migrationDatabase.begin((transaction) =>
      runEmployerTargetsImport(transaction, rows, {
        datasetVersion: DATASET_VERSION,
        researchDate: RESEARCH_DATE,
        apply: true,
      }),
    );
    expect(first.applied.newEmployers).toBe(1);
    const second = await migrationDatabase.begin((transaction) =>
      runEmployerTargetsImport(transaction, rows, {
        datasetVersion: DATASET_VERSION,
        researchDate: RESEARCH_DATE,
        apply: true,
      }),
    );
    expect(second.applied.newEmployers).toBe(0);
    expect(second.plan.unchangedEmployers).toHaveLength(1);
    expect(second.applied.sponsorsAdded).toBe(0);
    expect(second.applied.snapshotsAdded).toBe(0);
    expect(second.applied.candidatesAdded).toBe(0);

    const companies = await migrationDatabase<{ name: string }[]>`
      select name from app.company where name = ${rows[0]!.canonicalEmployer}
    `;
    expect(companies).toHaveLength(1);
  });

  it("preserves ambiguous identities research-only without creating companies", async () => {
    const runKey = uniqueSlug("amb");
    const rows = [
      researchRow({
        rank: 301,
        canonicalEmployer: `Ambiguous Co ${runKey}`,
        primarySponsorLegalEntity: `Ambiguous Legal Ltd ${runKey}`,
        identityConfidence: "Medium",
        careerSearchUrl: `https://amb-${runKey}.example.com/careers`,
      }),
    ];
    const report = await migrationDatabase.begin((transaction) =>
      runEmployerTargetsImport(transaction, rows, {
        datasetVersion: DATASET_VERSION,
        researchDate: RESEARCH_DATE,
        apply: true,
      }),
    );
    expect(report.plan.ambiguousIdentities).toHaveLength(1);
    expect(report.applied.newEmployers).toBe(0);

    const companies = await migrationDatabase<{ name: string }[]>`
      select name from app.company where name = ${rows[0]!.canonicalEmployer}
    `;
    expect(companies).toHaveLength(0);

    const snapshot = await migrationDatabase<{ company_id: string | null }[]>`
      select company_id from app.employer_research_snapshot
      where dataset_version = ${DATASET_VERSION} and internal_rank = 301
    `;
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0]!.company_id).toBeNull();

    const sponsor = await migrationDatabase<{ company_id: string | null }[]>`
      select company_id from app.employer_sponsor_entity
      where legal_name = ${`Ambiguous Legal Ltd ${runKey}`}
    `;
    expect(sponsor).toHaveLength(1);
    expect(sponsor[0]!.company_id).toBeNull();
  });

  it("never alters existing live job_source rows", async () => {
    const runKey = uniqueSlug("preserved");
    const companyName = `Preserved Source Co ${runKey}`;
    const company = await migrationDatabase<{ id: string }[]>`
      insert into app.company (name, slug, careers_url, source_type)
      values (${companyName}, ${uniqueSlug("preserved-company")},
        ${`https://preserved-${runKey}.example.com/careers`}, 'greenhouse')
      returning id
    `;
    const companyId = company[0]!.id;
    const source = await migrationDatabase<{ id: string }[]>`
      insert into app.job_source (company_id, slug, name, channel, careers_url, source_type, status)
      values (${companyId}::uuid, 'early-careers', 'Early careers', 'early_careers',
        ${`https://preserved-${runKey}.example.com/early`}, 'greenhouse', 'active')
      returning id
    `;
    const sourceId = source[0]!.id;
    const before = await migrationDatabase<{ name: string; status: string; source_type: string }[]>`
      select name, status, source_type from app.job_source where id = ${sourceId}::uuid
    `;
    const rows = [
      researchRow({
        rank: 401,
        canonicalEmployer: companyName,
        primarySponsorLegalEntity: null,
        identityConfidence: "High",
        careerSearchUrl: `https://preserved-${runKey}.example.com/careers`,
      }),
    ];
    await migrationDatabase.begin((transaction) =>
      runEmployerTargetsImport(transaction, rows, {
        datasetVersion: DATASET_VERSION,
        researchDate: RESEARCH_DATE,
        apply: true,
      }),
    );
    const after = await migrationDatabase<{ name: string; status: string; source_type: string }[]>`
      select name, status, source_type from app.job_source where id = ${sourceId}::uuid
    `;
    expect(after).toEqual(before);
  });

  it("keeps research tables administrator-only under RLS", async () => {
    await migrationDatabase`update app."user" set role = 'administrator' where id = ${administrator}::uuid`;
    try {
      const adminSnapshotVersion = `rls-${uniqueSlug("rls")}`;
      await asUser(
        administrator,
        (database) =>
          database`
          insert into app.employer_research_snapshot (
            company_id, canonical_name, dataset_version, research_date, priority_tier,
            internal_rank, research_status
          ) values (
            null, 'RLS Probe', ${adminSnapshotVersion}, '2026-08-12'::date, 'P3', 4999,
            'not_researched'
          )
        `,
      );
      const asMember = await asUser(
        userOne,
        (database) =>
          database<{ count: number }[]>`
          select count(*)::int as count from app.employer_research_snapshot
          where dataset_version = ${adminSnapshotVersion}
        `,
      );
      const asAdmin = await asUser(
        administrator,
        (database) =>
          database<{ count: number }[]>`
          select count(*)::int as count from app.employer_research_snapshot
          where dataset_version = ${adminSnapshotVersion}
        `,
      );
      let asMemberInsert = "inserted";
      try {
        await asUser(
          userOne,
          (database) =>
            database`
            insert into app.employer_alias (company_id, alias)
            values (${"00000000-0000-4000-8000-000000000000"}::uuid, 'blocked alias')
          `,
        );
      } catch {
        asMemberInsert = "blocked";
      }
      expect(asAdmin[0]!.count).toBe(1);
      expect(asMember[0]!.count).toBe(0);
      expect(asMemberInsert).toBe("blocked");
    } finally {
      await migrationDatabase`update app."user" set role = 'member' where id = ${administrator}::uuid`;
    }
  });
});

describe("importReviewCandidates", () => {
  it("inserts unverified candidates idempotently with general and early-career channels", async () => {
    const companyId = await migrationDatabase.begin((transaction) =>
      upsertCompany(transaction, {
        name: `Review Candidate Co ${uniqueSlug("review")}`,
        slug: uniqueSlug("review-candidate"),
        careersUrl: "https://review-candidate.example.com/careers",
        sourceType: "greenhouse",
        crawlAllowed: "unknown",
      }),
    );
    const inputs = [
      {
        companyId,
        channel: "general" as const,
        url: "https://review-candidate.example.com/careers",
        confidence: "high",
        notes: "Suggested by external review",
      },
      {
        companyId,
        channel: "early_careers" as const,
        url: "https://review-candidate.example.com/careers/students",
        confidence: "medium",
        notes: "Separate early-career page",
      },
    ];
    const first = await migrationDatabase.begin((transaction) =>
      importReviewCandidates(transaction, inputs),
    );
    expect(first).toEqual({ inserted: 2, skippedExisting: 0 });

    const second = await migrationDatabase.begin((transaction) =>
      importReviewCandidates(transaction, inputs),
    );
    expect(second).toEqual({ inserted: 0, skippedExisting: 2 });

    const rows = await migrationDatabase<{ channel: string; status: string }[]>`
      select channel, status from app.job_source_candidate
      where company_id = ${companyId}::uuid order by candidate_url
    `;
    expect(rows.map((row) => row.channel).sort()).toEqual(["early_careers", "general"]);
    expect(rows.every((row) => row.status === "candidate_found")).toBe(true);

    await migrationDatabase`delete from app.job_source_candidate where company_id = ${companyId}::uuid`;
    await migrationDatabase`delete from app.company where id = ${companyId}::uuid`;
  });
});
