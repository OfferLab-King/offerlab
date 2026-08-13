import postgres, { type TransactionSql } from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import {
  applyCandidateFingerprintPlans,
  applyCandidatePromotions,
  computePlatformCoverage,
  planCandidatePromotions,
  planDiscoveryFingerprints,
} from "../../src/modules/employer-research/application/source-discovery";
import {
  listDiscoveryCandidates,
  promoteCandidateToSource,
  readPlatformCoverageData,
} from "../../src/modules/employer-research/infrastructure/discovery-repository";

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

async function setupCompanyAndCandidate(
  input: Readonly<{
    candidateUrl: string;
    companyName?: string;
    status?: string;
    platformHint?: string | null;
    tier?: string;
    atsPlatform?: string | null;
    researchStatus?: string;
  }>,
): Promise<{ companyId: string; candidateId: string }> {
  const company = await migrationDatabase<{ id: string }[]>`
    insert into app.company (name, slug, careers_url, source_type)
    values (${input.companyName ?? uniqueSlug("discovery-co")}, ${uniqueSlug("disc")},
      ${input.candidateUrl}, 'unknown')
    returning id
  `;
  const companyId = company[0]!.id;
  const candidate = await migrationDatabase<{ id: string }[]>`
    insert into app.job_source_candidate (company_id, candidate_url, status, platform_hint)
    values (${companyId}::uuid, ${input.candidateUrl}, ${input.status ?? "not_researched"},
      ${input.platformHint ?? null})
    returning id
  `;
  await migrationDatabase`
    insert into app.employer_research_snapshot (
      company_id, canonical_name, dataset_version, research_date, priority_tier,
      internal_rank, research_status, ats_platform
    ) values (
      ${companyId}::uuid, ${input.companyName ?? "Discovery Co"}, ${`discovery-test-${uniqueSlug("d")}`},
      '2026-08-12'::date, ${input.tier ?? "P0"}, ${Math.floor(Math.random() * 1000) + 4000},
      ${input.researchStatus ?? "not_researched"}, ${input.atsPlatform ?? null}
    )
  `;
  return { companyId, candidateId: candidate[0]!.id };
}

afterAll(async () => {
  await migrationDatabase.end();
});

describe("source discovery pipeline", () => {
  it("fingerprints candidates and updates their rows deterministically", async () => {
    const { candidateId } = await setupCompanyAndCandidate({
      candidateUrl: `https://boards.greenhouse.io/acme-discovered-${uniqueSlug("g")}`,
    });
    const candidates = await migrationDatabase.begin((t) =>
      listDiscoveryCandidates(t, {
        companySlug: null,
        tier: null,
        platform: null,
        status: null,
        search: null,
        limit: 500,
      }),
    );
    const target = candidates.find((candidate) => candidate.candidateId === candidateId)!;
    const plans = planDiscoveryFingerprints([target]);
    expect(plans[0]!.fingerprint).toMatchObject({ platform: "greenhouse", confidence: "high" });
    expect(plans[0]!.nextStatus).toBe("platform_identified");

    const outcome = await migrationDatabase.begin((t) =>
      applyCandidateFingerprintPlans(t, plans, true),
    );
    expect(outcome.applied).toBe(1);

    const updated = await migrationDatabase<{ platform_hint: string; status: string }[]>`
      select platform_hint, status from app.job_source_candidate where id = ${candidateId}::uuid
    `;
    expect(updated[0]!.platform_hint).toBe("Greenhouse");
    expect(updated[0]!.status).toBe("platform_identified");

    const secondPlans = planDiscoveryFingerprints([
      { ...target, platformHint: "Greenhouse", status: "platform_identified" },
    ]);
    expect(secondPlans[0]!.changed).toBe(false);
  });

  it("promotes a verified candidate to a paused source and is idempotent", async () => {
    const { companyId, candidateId } = await setupCompanyAndCandidate({
      candidateUrl: `https://jobs.smartrecruiters.com/AcmeDiscovery-${uniqueSlug("sr")}`,
      status: "verified",
    });
    const candidates = await migrationDatabase.begin((t) =>
      listDiscoveryCandidates(t, {
        companySlug: null,
        tier: null,
        platform: null,
        status: null,
        search: null,
        limit: 500,
      }),
    );
    const target = candidates.find((candidate) => candidate.candidateId === candidateId)!;
    const plans = planCandidatePromotions([target]);
    expect(plans[0]!.promotable).toBe(true);

    const outcome = await migrationDatabase.begin((t) => applyCandidatePromotions(t, plans, true));
    expect(outcome.created).toBe(1);

    const sources = await migrationDatabase<
      { status: string; source_type: string; ats_provider: string; careers_url: string }[]
    >`
      select status, source_type, ats_provider, careers_url
      from app.job_source where company_id = ${companyId}::uuid
    `;
    expect(sources).toHaveLength(1);
    expect(sources[0]!.status).toBe("paused");
    expect(sources[0]!.source_type).toBe("smartrecruiters");
    expect(sources[0]!.ats_provider).toBe("SmartRecruiters");

    const candidateRow = await migrationDatabase<{ status: string }[]>`
      select status from app.job_source_candidate where id = ${candidateId}::uuid
    `;
    expect(candidateRow[0]!.status).toBe("promoted");

    const second = await migrationDatabase.begin((t) => applyCandidatePromotions(t, plans, true));
    expect(second.created).toBe(0);
    expect(second.alreadyPresent).toBe(1);
  });

  it("never overwrites an existing live source for the same URL", async () => {
    const url = `https://acme-guard-${uniqueSlug("guard")}.wd1.myworkdayjobs.com/careers`;
    const { companyId } = await setupCompanyAndCandidate({
      candidateUrl: url,
      status: "verified",
    });
    const liveSource = await migrationDatabase<{ id: string }[]>`
      insert into app.job_source (company_id, slug, name, channel, careers_url, source_type, status)
      values (${companyId}::uuid, 'live-general', 'Live general', 'general', ${url}, 'custom', 'active')
      returning id
    `;
    const candidates = await migrationDatabase.begin((t) =>
      listDiscoveryCandidates(t, {
        companySlug: null,
        tier: null,
        platform: null,
        status: null,
        search: null,
        limit: 500,
      }),
    );
    const target = candidates.find((candidate) => candidate.companyId === companyId)!;
    const outcome = await migrationDatabase.begin((t) =>
      applyCandidatePromotions(t, planCandidatePromotions([target]), true),
    );
    expect(outcome.created).toBe(0);
    expect(outcome.alreadyPresent).toBe(1);
    const unchanged = await migrationDatabase<{ status: string; id: string }[]>`
      select status, id from app.job_source where id = ${liveSource[0]!.id}::uuid
    `;
    expect(unchanged[0]!.status).toBe("active");
    expect(unchanged[0]!.id).toBe(liveSource[0]!.id);
  });

  it("computes platform coverage from research, candidate and live evidence", async () => {
    await setupCompanyAndCandidate({
      candidateUrl: `https://jobs.lever.co/acme-coverage-${uniqueSlug("l")}`,
      platformHint: "Lever",
      tier: "P1",
      atsPlatform: "Workday",
      researchStatus: "verified_platform",
    });
    const data = await migrationDatabase.begin((t) => readPlatformCoverageData(t));
    const coverage = computePlatformCoverage(data);
    expect(coverage.totals.employers).toBeGreaterThan(0);
    expect(coverage.totals.p0 + coverage.totals.p1).toBeGreaterThan(0);
    const lever = coverage.rows.find((row) => row.platform === "lever");
    expect(lever).toBeDefined();
  });

  it("restricts discovery reads to administrators under RLS", async () => {
    const administrator = "20000000-0000-4000-8000-000000000003";
    const member = "20000000-0000-4000-8000-000000000001";
    await migrationDatabase`update app."user" set role = 'administrator' where id = ${administrator}::uuid`;
    try {
      const adminCount = await asUser(
        administrator,
        (database) =>
          database<{ count: number }[]>`
          select count(*)::int as count from app.job_source_candidate
        `,
      );
      const memberCount = await asUser(
        member,
        (database) =>
          database<{ count: number }[]>`
          select count(*)::int as count from app.job_source_candidate
        `,
      );
      expect(adminCount[0]!.count).toBeGreaterThan(0);
      expect(memberCount[0]!.count).toBe(0);
    } finally {
      await migrationDatabase`update app."user" set role = 'member' where id = ${administrator}::uuid`;
    }
  });
});

describe("promoteCandidateToSource guards", () => {
  it("skips promotion for companies without a resolvable candidate row", async () => {
    const company = await migrationDatabase<{ id: string }[]>`
      insert into app.company (name, slug, careers_url, source_type)
      values ('No Candidate Co', ${uniqueSlug("nocand")},
        ${`https://nocand-${uniqueSlug("n")}.example.com/careers`}, 'unknown')
      returning id
    `;
    const outcome = await migrationDatabase.begin((transaction) =>
      promoteCandidateToSource(transaction, {
        candidateId: "00000000-0000-4000-8000-000000000000",
        companyId: company[0]!.id,
        companyName: "No Candidate Co",
        candidateUrl: `https://nocand-${uniqueSlug("n2")}.example.com/careers`,
        platform: "workday",
        channel: "general",
        notes: "test",
      }),
    );
    expect(outcome).toBe("skipped");
  });
});
