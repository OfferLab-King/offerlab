import postgres, { type TransactionSql } from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import { planCrawlChanges } from "../../src/modules/job-catalog/domain/change-detection";
import type { JobClassificationWrite } from "../../src/modules/job-catalog/infrastructure/job-repository";
import { searchJobsFaceted } from "../../src/modules/job-catalog/infrastructure/catalog-repository";
import {
  findEmployerProfile,
  listIndexableEmployersForSitemap,
} from "../../src/modules/job-catalog/infrastructure/catalog-repository";
import { defaultJobCatalogFilters } from "../../src/modules/job-catalog/domain/catalog";
import type { DiscoveredJob } from "../../src/modules/job-catalog/domain/deduplication";
import { slugifyTitle } from "../../src/modules/job-catalog/domain/urls";
import { upsertCompany } from "../../src/modules/job-catalog/infrastructure/company-repository";
import {
  applyCrawlPlan,
  listJobsForCompany,
} from "../../src/modules/job-catalog/infrastructure/job-repository";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const migrationDatabase = postgres(databaseUrl, { max: 2, prepare: false });
const runtimeUrl = new URL(databaseUrl);
runtimeUrl.username = "offerlab_runtime_login";
runtimeUrl.password = "postgres";
const runtimeDatabase = postgres(runtimeUrl.toString(), { max: 2, prepare: false });

const userOne = "20000000-0000-4000-8000-000000000001";
const userTwo = "20000000-0000-4000-8000-000000000002";
const administrator = "20000000-0000-4000-8000-000000000003";

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

async function asCrawler<T>(operation: (database: TransactionSql) => PromiseLike<T>): Promise<T> {
  return (await migrationDatabase.begin(async (transaction) => {
    await transaction`set local role offerlab_crawler`;
    return operation(transaction);
  })) as T;
}

function discoveredJob(externalJobId: string, title: string): DiscoveredJob {
  return {
    applicationDeadline: null,
    applicationUrl: `https://boards.example.com/${externalJobId}/apply`,
    descriptionText: `Description for ${title}.`,
    employmentType: "full_time",
    externalJobId,
    locationText: "London",
    postedAt: null,
    remoteType: null,
    salaryCurrency: null,
    salaryMax: null,
    salaryMin: null,
    salaryPeriod: null,
    sourcePayload: { externalJobId },
    sourceUrl: `https://boards.example.com/${externalJobId}`,
    title,
  };
}

afterAll(async () => {
  await migrationDatabase.end();
  await runtimeDatabase.end();
});

describe("job catalog", () => {
  it("applies the schema", async () => {
    const rows = await migrationDatabase<{ company: string | null; job: string | null }[]>`
      select
        to_regclass('app.company')::text as company,
        to_regclass('app.job')::text as job
    `;
    expect(rows[0]).toEqual({ company: "app.company", job: "app.job" });
  });

  it("forces RLS on member saves and isolates saved jobs between users", async () => {
    const rows = await migrationDatabase<{ relforcerowsecurity: boolean }[]>`
      select relforcerowsecurity from pg_class where oid = 'app.user_saved_job'::regclass
    `;
    expect(rows[0]?.relforcerowsecurity).toBe(true);

    const companyId = await migrationDatabase<{ id: string }[]>`
      insert into app.company (name, slug, careers_url, source_type)
      values ('RLS Test Co', ${uniqueSlug("rls-test-co")}, ${`https://rls-${uniqueSlug("careers")}.example.com`}, 'greenhouse')
      returning id
    `;
    const jobId = await migrationDatabase<{ id: string }[]>`
      insert into app.job (company_id, slug, application_url, title, content_hash)
      values (${companyId[0]!.id}::uuid, ${uniqueSlug("rls-test-co-role")}, 'https://example.com/apply',
              'RLS Role', ${"a".repeat(64)})
      returning id
    `;

    await expect(
      asUser(
        userTwo,
        (database) =>
          database`select configuration from app.company where id = ${companyId[0]!.id}::uuid`,
      ),
    ).rejects.toThrow();

    await asCrawler(
      (database) => database`insert into app.job_ingestion_run (company_id, status)
        values (${companyId[0]!.id}::uuid, 'succeeded')`,
    );
    const memberVisibleRuns = await asUser(
      userTwo,
      (database) => database<{ count: number }[]>`select count(*)::int from app.job_ingestion_run`,
    );
    expect(memberVisibleRuns[0]!.count).toBe(0);

    await asUser(
      userOne,
      (database) =>
        database`insert into app.user_saved_job (owner_user_id, job_id)
               values (${userOne}::uuid, ${jobId[0]!.id}::uuid)`,
    );

    const userTwoSaves = await asUser(
      userTwo,
      (database) => database<{ count: number }[]>`select count(*)::int from app.user_saved_job`,
    );
    expect(userTwoSaves[0]!.count).toBe(0);

    await asUser(
      userTwo,
      (database) => database`delete from app.user_saved_job where job_id = ${jobId[0]!.id}::uuid`,
    );

    const userOneSavesAfter = await asUser(
      userOne,
      (database) =>
        database<{ count: number }[]>`select count(*)::int from app.user_saved_job
        where job_id = ${jobId[0]!.id}::uuid`,
    );
    expect(userOneSavesAfter[0]!.count).toBe(1);
  });

  it("lets the crawler role maintain catalog tables but not member saves", async () => {
    await expect(
      runtimeDatabase.begin(async (database) => database`set local role offerlab_crawler`),
    ).rejects.toThrow();

    const companyId = await asCrawler(
      (database) =>
        database<{ id: string }[]>`
        insert into app.company (name, slug, careers_url, source_type)
        values ('Crawler Co', ${uniqueSlug("crawler-co")}, ${`https://crawler-${uniqueSlug("careers")}.example.com`}, 'lever')
        returning id
      `,
    );

    await asCrawler(
      (database) =>
        database`
        insert into app.job (company_id, slug, application_url, title, content_hash)
        values (${companyId[0]!.id}::uuid, ${uniqueSlug("crawler-co-role")}, 'https://example.com/apply',
                'Crawler Role', ${"b".repeat(64)})
      `,
    );

    await expect(
      asCrawler(
        (database) =>
          database`
          insert into app.user_saved_job (owner_user_id, job_id)
          values (${userOne}::uuid, ${companyId[0]!.id}::uuid)
        `,
      ),
    ).rejects.toThrow();
  });

  it("limits source operations to administrators", async () => {
    const rows = await migrationDatabase<{ id: string }[]>`
      insert into app.company (name, slug, careers_url, source_type)
      values ('Admin Source Co', ${uniqueSlug("admin-source-co")}, ${`https://admin-${uniqueSlug("careers")}.example.com`}, 'lever')
      returning id
    `;
    await asUser(
      userTwo,
      (database) =>
        database`update app.company set crawl_allowed = 'allowed' where id = ${rows[0]!.id}::uuid`,
    );
    const unchanged = await migrationDatabase<{ crawl_allowed: string }[]>`
      select crawl_allowed from app.company where id = ${rows[0]!.id}::uuid
    `;
    expect(unchanged[0]!.crawl_allowed).toBe("unknown");

    await migrationDatabase`update app."user" set role = 'administrator' where id = ${administrator}::uuid`;
    try {
      await asUser(
        administrator,
        (database) =>
          database`update app.company set crawl_allowed = 'allowed' where id = ${rows[0]!.id}::uuid`,
      );
      const changed = await migrationDatabase<{ crawl_allowed: string }[]>`
        select crawl_allowed from app.company where id = ${rows[0]!.id}::uuid
      `;
      expect(changed[0]!.crawl_allowed).toBe("allowed");
    } finally {
      await migrationDatabase`update app."user" set role = 'member' where id = ${administrator}::uuid`;
    }
  });

  it("runs a full crawl change cycle end to end", async () => {
    const companyId = await asCrawler((database) =>
      upsertCompany(database, {
        careersUrl: `https://boards-${uniqueSlug("cycle")}.example.com`,
        configuration: { greenhouseBoardToken: "example" },
        crawlAllowed: "allowed",
        name: "Cycle Test Co",
        slug: uniqueSlug("cycle-test-co"),
        sourceType: "greenhouse",
      }),
    );

    const first = discoveredJob("100", "Graduate Role");
    const second = discoveredJob("101", "Another Role");
    const now = new Date("2026-08-05T00:00:00.000Z");

    const planOne = planCrawlChanges([], [first, second]);
    const appliedOne = await asCrawler((database) =>
      applyCrawlPlan(database, companyId, planOne, {
        missingCrawlThreshold: 2,
        now,
        slugFor: (job, companySlug) => slugifyTitle(job.title, companySlug),
        classifyFor: () => testClassificationWrite(),
      }),
    );
    expect(appliedOne.newIds).toHaveLength(2);

    const rowsAfterInsert = await asCrawler((database) => listJobsForCompany(database, companyId));
    expect(rowsAfterInsert).toHaveLength(2);
    expect(rowsAfterInsert.every((row) => row.active)).toBe(true);
    expect(rowsAfterInsert.every((row) => row.content_hash.length === 64)).toBe(true);

    const planTwo = planCrawlChanges(
      rowsAfterInsert.map((row) => ({
        active: row.active,
        applicationUrl: row.application_url,
        contentHash: row.content_hash,
        externalJobId: row.external_job_id,
        id: row.id,
        lastSeenAt: row.last_seen_at,
        locationText: row.location_text,
        missedCrawls: row.missed_crawls,
        sourceUrl: row.source_url,
        title: row.title,
      })),
      [first, second],
    );
    expect(planTwo.insert).toHaveLength(0);
    expect(planTwo.update).toHaveLength(0);
    expect(planTwo.touch).toHaveLength(2);

    const changed = discoveredJob("100", "Graduate Role Renamed");
    const planThree = planCrawlChanges(
      rowsAfterInsert.map((row) => ({
        active: row.active,
        applicationUrl: row.application_url,
        contentHash: row.content_hash,
        externalJobId: row.external_job_id,
        id: row.id,
        lastSeenAt: row.last_seen_at,
        locationText: row.location_text,
        missedCrawls: row.missed_crawls,
        sourceUrl: row.source_url,
        title: row.title,
      })),
      [changed, second],
    );
    expect(planThree.update).toHaveLength(1);
    await asCrawler((database) =>
      applyCrawlPlan(database, companyId, planThree, {
        missingCrawlThreshold: 2,
        now,
        slugFor: (job, companySlug) => slugifyTitle(job.title, companySlug),
        classifyFor: () => testClassificationWrite(),
      }),
    );
    const afterUpdate = await asCrawler((database) => listJobsForCompany(database, companyId));
    const updated = afterUpdate.find((row) => row.external_job_id === "100")!;
    expect(updated.title).toBe("Graduate Role Renamed");
    expect(updated.missed_crawls).toBe(0);
    expect(updated.content_hash).not.toBe(rowsAfterInsert[0]!.content_hash);

    const missingPlan = planCrawlChanges(
      afterUpdate.map((row) => ({
        active: row.active,
        applicationUrl: row.application_url,
        contentHash: row.content_hash,
        externalJobId: row.external_job_id,
        id: row.id,
        lastSeenAt: row.last_seen_at,
        locationText: row.location_text,
        missedCrawls: row.missed_crawls,
        sourceUrl: row.source_url,
        title: row.title,
      })),
      [second],
    );
    expect(missingPlan.incrementMissed).toHaveLength(1);
    await asCrawler((database) =>
      applyCrawlPlan(database, companyId, missingPlan, {
        missingCrawlThreshold: 2,
        now,
        slugFor: (job, companySlug) => slugifyTitle(job.title, companySlug),
        classifyFor: () => testClassificationWrite(),
      }),
    );

    const afterMiss = await asCrawler((database) => listJobsForCompany(database, companyId));
    expect(afterMiss.find((row) => row.external_job_id === "100")!.missed_crawls).toBe(1);

    const deactivatePlan = planCrawlChanges(
      afterMiss.map((row) => ({
        active: row.active,
        applicationUrl: row.application_url,
        contentHash: row.content_hash,
        externalJobId: row.external_job_id,
        id: row.id,
        lastSeenAt: row.last_seen_at,
        locationText: row.location_text,
        missedCrawls: row.missed_crawls,
        sourceUrl: row.source_url,
        title: row.title,
      })),
      [second],
    );
    expect(deactivatePlan.deactivate).toHaveLength(1);
    await asCrawler((database) =>
      applyCrawlPlan(database, companyId, deactivatePlan, {
        missingCrawlThreshold: 2,
        now,
        slugFor: (job, companySlug) => slugifyTitle(job.title, companySlug),
        classifyFor: () => testClassificationWrite(),
      }),
    );
    const afterDeactivate = await asCrawler((database) => listJobsForCompany(database, companyId));
    expect(afterDeactivate.find((row) => row.external_job_id === "100")!.active).toBe(false);
  });
});

function testClassificationWrite(): JobClassificationWrite {
  return {
    classificationSource: "deterministic",
    eligibilityEvidence: null,
    eligibilityReasons: [],
    eligibilityStatus: "eligible",
    opportunityType: "unknown",
    publicationStatus: "published",
    sectorKey: null,
    subsectorKey: null,
  };
}

describe("job catalogue IA, eligibility and publication", () => {
  it("keeps the web runtime login out of the crawler role", async () => {
    await expect(
      asUser(userOne, (database) => database`set local role offerlab_crawler`),
    ).rejects.toThrow();
  });

  it("lets the crawler role write taxonomy-derived job fields and locations", async () => {
    const companyId = await asCrawler((database) =>
      upsertCompany(database, {
        careersUrl: `https://ia-${uniqueSlug("c")}.example.com`,
        crawlAllowed: "allowed",
        name: "IA Test Co",
        slug: uniqueSlug("ia-test-co"),
        sourceType: "greenhouse",
      }),
    );
    const jobId = await asCrawler(
      (database) =>
        database<{ id: string }[]>`
        insert into app.job (
          company_id, slug, application_url, title, content_hash,
          opportunity_type, eligibility_status, publication_status,
          classification_source, classification_version, sector_key, subsector_key
        )
        values (
          ${companyId}::uuid, ${uniqueSlug("ia-role")}, 'https://ia.example.com/apply',
          'Graduate Software Engineer', ${"c".repeat(64)},
          'graduate_job', 'eligible', 'published', 'deterministic', 1,
          'technology_it', 'software_development'
        )
        returning id
      `,
    );
    await asCrawler(
      (database) =>
        database`
        insert into app.job_location (job_id, city, region, country, source_text, on_site, position)
        values (${jobId[0]!.id}::uuid, 'London', 'London', 'United Kingdom', 'London', true, 0)
      `,
    );
    const rows = await migrationDatabase<{ opportunity_type: string; city: string }[]>`
      select j.opportunity_type, jl.city
      from app.job j
      join app.job_location jl on jl.job_id = j.id
      where j.id = ${jobId[0]!.id}::uuid
    `;
    expect(rows[0]).toEqual({ opportunity_type: "graduate_job", city: "London" });
  });

  it("exposes only eligible published active jobs through the public query", async () => {
    const companyId = await asCrawler((database) =>
      upsertCompany(database, {
        careersUrl: `https://pub-${uniqueSlug("c")}.example.com`,
        crawlAllowed: "allowed",
        name: "Pub Test Co",
        slug: uniqueSlug("pub-test-co"),
        sourceType: "greenhouse",
      }),
    );
    const states = [
      {
        slug: uniqueSlug("pub-ok"),
        title: "Published Role",
        eligibility: "eligible",
        publication: "published",
        active: true,
      },
      {
        slug: uniqueSlug("pub-draft"),
        title: "Draft Role",
        eligibility: "eligible",
        publication: "draft",
        active: true,
      },
      {
        slug: uniqueSlug("pub-inel"),
        title: "Ineligible Role",
        eligibility: "ineligible",
        publication: "suppressed",
        active: true,
      },
      {
        slug: uniqueSlug("pub-rev"),
        title: "Review Role",
        eligibility: "needs_review",
        publication: "draft",
        active: true,
      },
      {
        slug: uniqueSlug("pub-old"),
        title: "Old Role",
        eligibility: "eligible",
        publication: "published",
        active: false,
      },
    ];
    for (const state of states) {
      await asCrawler(
        (database) =>
          database`
          insert into app.job (
            company_id, slug, application_url, title, content_hash,
            eligibility_status, publication_status, active,
            classification_source, classification_version
          )
          values (
            ${companyId}::uuid, ${state.slug}, ${`https://pub-${state.slug}.example.com/apply`}, ${state.title},
            ${"d".repeat(64)}, ${state.eligibility}, ${state.publication},
            ${state.active}, 'deterministic', 1
          )
        `,
      );
    }
    const publicRows = await migrationDatabase<{ title: string }[]>`
      select j.title
      from app.job j
      where j.publication_status = 'published'
        and j.eligibility_status = 'eligible'
        and j.active
        and j.company_id = ${companyId}::uuid
    `;
    expect(publicRows.map((row) => row.title)).toEqual(["Published Role"]);
  });

  it("records source reviews with provenance", async () => {
    const companyId = await asCrawler((database) =>
      upsertCompany(database, {
        careersUrl: `https://review-${uniqueSlug("c")}.example.com`,
        name: "Review Test Co",
        slug: uniqueSlug("review-test-co"),
        sourceType: "lever",
      }),
    );
    await migrationDatabase`update app."user" set role = 'administrator' where id = ${administrator}::uuid`;
    try {
      await asUser(
        administrator,
        (database) =>
          database`
            update app.company
            set crawl_allowed = 'allowed',
                review_date = '2026-08-10'::date,
                reviewed_by_user_id = ${administrator}::uuid,
                robots_result = 'allowed',
                terms_result = 'allowed',
                evidence_url = 'https://employer.example.com/legal',
                review_notes = 'Official public job board API',
                updated_at = now()
            where id = ${companyId}::uuid
          `,
      );
    } finally {
      await migrationDatabase`update app."user" set role = 'member' where id = ${administrator}::uuid`;
    }
    const rows = await migrationDatabase<
      { review_date: string | null; robots_result: string; evidence_url: string | null }[]
    >`
      select review_date, robots_result, evidence_url
      from app.company
      where id = ${companyId}::uuid
    `;
    expect(rows[0]).toEqual({
      review_date: new Date("2026-08-10T00:00:00.000Z"),
      robots_result: "allowed",
      evidence_url: "https://employer.example.com/legal",
    });
  });

  it("audits administrator classification overrides", async () => {
    const companyId = await asCrawler((database) =>
      upsertCompany(database, {
        careersUrl: `https://audit-${uniqueSlug("c")}.example.com`,
        name: "Audit Test Co",
        slug: uniqueSlug("audit-test-co"),
        sourceType: "greenhouse",
      }),
    );
    const jobId = await asCrawler(
      (database) =>
        database<{ id: string }[]>`
        insert into app.job (
          company_id, slug, application_url, title, content_hash,
          eligibility_status, publication_status, classification_source, classification_version
        )
        values (
          ${companyId}::uuid, ${uniqueSlug("audit-role")}, 'https://audit.example.com/apply',
          'Graduate Analyst', ${"e".repeat(64)},
          'needs_review', 'draft', 'deterministic', 1
        )
        returning id
      `,
    );
    await migrationDatabase`update app."user" set role = 'administrator' where id = ${administrator}::uuid`;
    try {
      await asUser(
        administrator,
        (database) =>
          database`
            update app.job
            set eligibility_status = 'eligible',
                publication_status = 'published',
                classification_source = 'administrator',
                classification_version = classification_version + 1,
                updated_at = now()
            where id = ${jobId[0]!.id}::uuid
          `,
      );
      await asUser(
        administrator,
        (database) =>
          database`
            insert into app.audit_event (actor_user_id, action, entity_type, entity_id)
            values (${administrator}::uuid, 'job.classification_changed', 'job', ${jobId[0]!.id}::uuid)
          `,
      );
    } finally {
      await migrationDatabase`update app."user" set role = 'member' where id = ${administrator}::uuid`;
    }
    const rows = await migrationDatabase<{ action: string; actor_user_id: string }[]>`
      select action, actor_user_id
      from app.audit_event
      where entity_type = 'job' and entity_id = ${jobId[0]!.id}::uuid
    `;
    expect(rows[0]).toEqual({ action: "job.classification_changed", actor_user_id: administrator });
  });

  it("enforces source permission at the crawl-selection level", async () => {
    const blocked = await asCrawler((database) =>
      upsertCompany(database, {
        careersUrl: `https://blocked-${uniqueSlug("c")}.example.com`,
        crawlAllowed: "blocked",
        name: "Blocked Co",
        slug: uniqueSlug("blocked-co"),
        sourceType: "greenhouse",
      }),
    );
    const allowed = await asCrawler((database) =>
      upsertCompany(database, {
        careersUrl: `https://allowed-${uniqueSlug("c")}.example.com`,
        crawlAllowed: "allowed",
        name: "Allowed Co",
        slug: uniqueSlug("allowed-co"),
        sourceType: "greenhouse",
      }),
    );
    const due = await asCrawler(
      (database) =>
        database<{ id: string }[]>`
        select id from app.company
        where active
          and crawl_allowed = 'allowed'
          and crawl_status <> 'paused'
          and (next_check_at is null or next_check_at <= now())
      `,
    );
    const dueIds = new Set(due.map((row) => row.id));
    expect(dueIds.has(blocked)).toBe(false);
    expect(dueIds.has(allowed)).toBe(true);
  });
});

describe("employer SEO and sitemap coverage", () => {
  it("includes only indexable employer profiles in the sitemap query", async () => {
    const blankSlug = uniqueSlug("seo-blank");
    await asCrawler((database) =>
      upsertCompany(database, {
        careersUrl: `https://seo-blank-${uniqueSlug("c")}.example.com`,
        directorySectorKey: "technology_it",
        directoryVisible: true,
        name: "Blank SEO Co",
        slug: blankSlug,
        sourceType: "greenhouse",
      }),
    );

    const describedSlug = uniqueSlug("seo-described");
    const describedId = await asCrawler((database) =>
      upsertCompany(database, {
        careersUrl: `https://seo-described-${uniqueSlug("c")}.example.com`,
        directorySectorKey: "technology_it",
        directoryVisible: true,
        name: "Described SEO Co",
        slug: describedSlug,
        sourceType: "greenhouse",
      }),
    );
    await asCrawler(
      (database) =>
        database`
        update app.company
        set description = 'Original curated description used only for SEO tests.'
        where id = ${describedId}::uuid
      `,
    );

    const inactiveSlug = uniqueSlug("seo-inactive");
    const inactiveId = await asCrawler((database) =>
      upsertCompany(database, {
        careersUrl: `https://seo-inactive-${uniqueSlug("c")}.example.com`,
        directorySectorKey: "technology_it",
        directoryVisible: true,
        name: "Inactive SEO Co",
        slug: inactiveSlug,
        sourceType: "greenhouse",
      }),
    );
    await asCrawler(
      (database) =>
        database`
        update app.company
        set active = false,
          description = 'Original description retained after catalogue deactivation.'
        where id = ${inactiveId}::uuid
      `,
    );

    const historicalSlug = uniqueSlug("seo-historical");
    const historicalId = await asCrawler((database) =>
      upsertCompany(database, {
        careersUrl: `https://seo-historical-${uniqueSlug("c")}.example.com`,
        directorySectorKey: "technology_it",
        directoryVisible: true,
        name: "Historical SEO Co",
        slug: historicalSlug,
        sourceType: "greenhouse",
      }),
    );
    const historicalJobLastChanged = new Date(Date.now() - 2 * 86_400_000);
    await asCrawler(
      (database) =>
        database`
        insert into app.job (
          company_id, slug, application_url, title, content_hash,
          eligibility_status, publication_status, active,
          classification_source, classification_version, last_changed_at
        )
        values (
          ${historicalId}::uuid, ${uniqueSlug("seo-historical-role")},
          'https://seo.example.com/apply', 'Historical Role', ${"0".repeat(64)},
          'eligible', 'published', false, 'deterministic', 1,
          ${historicalJobLastChanged}
        )
      `,
    );

    const sitemapRows = await migrationDatabase.begin((database) =>
      listIndexableEmployersForSitemap(database, 10_000),
    );
    const sitemapSlugs = new Set(sitemapRows.map((row) => row.slug));
    expect(sitemapSlugs.has(blankSlug)).toBe(false);
    expect(sitemapSlugs.has(describedSlug)).toBe(true);
    expect(sitemapSlugs.has(historicalSlug)).toBe(true);
    expect(sitemapSlugs.has(inactiveSlug)).toBe(false);

    const historicalEntry = sitemapRows.find((row) => row.slug === historicalSlug)!;
    expect(new Date(historicalEntry.last_modified).getTime()).toBeGreaterThanOrEqual(
      historicalJobLastChanged.getTime(),
    );

    const blank = await migrationDatabase.begin((database) =>
      findEmployerProfile(database, blankSlug),
    );
    expect(blank).not.toBeNull();
    expect(blank!.has_imported_jobs).toBe(false);
    expect(blank!.imported_jobs).toBe(0);

    const described = await migrationDatabase.begin((database) =>
      findEmployerProfile(database, describedSlug),
    );
    expect(described!.description).toBe("Original curated description used only for SEO tests.");
    expect(described!.has_imported_jobs).toBe(false);
    expect(described!.active_jobs).toBe(0);

    const historical = await migrationDatabase.begin((database) =>
      findEmployerProfile(database, historicalSlug),
    );
    expect(historical!.has_imported_jobs).toBe(true);
    expect(historical!.imported_jobs).toBe(1);
    expect(historical!.active_jobs).toBe(0);

    const inactive = await migrationDatabase.begin((database) =>
      findEmployerProfile(database, inactiveSlug),
    );
    expect(inactive!.active).toBe(false);
  });
});

describe("faceted catalogue search", () => {
  async function seedFacetedFixture(): Promise<string> {
    return asCrawler(async (database) => {
      const companyId = await upsertCompany(database, {
        careersUrl: `https://facet-${uniqueSlug("c")}.example.com`,
        crawlAllowed: "allowed",
        name: "Facet Test Co",
        slug: uniqueSlug("facet-test-co"),
        sourceType: "greenhouse",
      });
      const rows: ReadonlyArray<{
        deadline: string | null;
        eligibility: string;
        jobType: string;
        publication: string;
        sector: string | null;
        slug: string;
        subsector: string | null;
        title: string;
      }> = [
        {
          slug: uniqueSlug("fac-grad-law"),
          title: "Graduate Solicitor",
          jobType: "graduate_job",
          sector: "law",
          subsector: "commercial_law",
          eligibility: "eligible",
          publication: "published",
          deadline: "2027-01-01T00:00:00Z",
        },
        {
          slug: uniqueSlug("fac-grad-tech"),
          title: "Graduate Engineer",
          jobType: "graduate_job",
          sector: "technology_it",
          subsector: "software_development",
          eligibility: "eligible",
          publication: "published",
          deadline: "2027-01-01T00:00:00Z",
        },
        {
          slug: uniqueSlug("fac-intern-tech"),
          title: "Intern",
          jobType: "internship",
          sector: "technology_it",
          subsector: "software_development",
          eligibility: "eligible",
          publication: "published",
          deadline: "2027-01-01T00:00:00Z",
        },
        {
          slug: uniqueSlug("fac-expired"),
          title: "Old Graduate Role",
          jobType: "graduate_job",
          sector: "law",
          subsector: "commercial_law",
          eligibility: "eligible",
          publication: "published",
          deadline: "2020-01-01T00:00:00Z",
        },
        {
          slug: uniqueSlug("fac-draft"),
          title: "Draft Role",
          jobType: "internship",
          sector: "law",
          subsector: "commercial_law",
          eligibility: "needs_review",
          publication: "draft",
          deadline: "2027-01-01T00:00:00Z",
        },
      ];
      for (const row of rows) {
        await database`
          insert into app.job (
            company_id, slug, application_url, title, content_hash,
            opportunity_type, sector_key, subsector_key,
            eligibility_status, publication_status, active,
            classification_source, classification_version,
            posted_at, first_seen_at, application_deadline,
            remote_type, description_text
          )
          values (
            ${companyId}::uuid, ${row.slug}, ${`https://facet.example.com/${row.slug}`},
            ${row.title}, ${"f".repeat(64)}, ${row.jobType}, ${row.sector}, ${row.subsector},
            ${row.eligibility}, ${row.publication}, true,
            'deterministic', 1,
            now() - interval '1 day', now() - interval '1 day', ${row.deadline}::timestamptz,
            'on_site', 'A synthetic role for faceted search tests.'
          )
        `;
      }
      return companyId;
    });
  }

  it("applies OR within one facet and AND across facets with dynamic counts", async () => {
    const companyId = await seedFacetedFixture();
    const companySlug = (
      await migrationDatabase<
        { slug: string }[]
      >`select slug from app.company where id = ${companyId}::uuid`
    )[0]!.slug;

    const all = await asCrawler((database) =>
      searchJobsFaceted(database, {
        ...defaultJobCatalogFilters,
        employers: [companySlug],
      }),
    );
    expect(all.result.total).toBe(3);

    const jobTypes = all.facets.jobTypes;
    expect(jobTypes.map((option) => option.value)).toContain("graduate_job");
    expect(jobTypes.map((option) => option.value)).toContain("internship");
    const graduateCount = jobTypes.find((option) => option.value === "graduate_job")!.count;
    expect(graduateCount).toBe(2);

    const lawAndGraduate = await asCrawler((database) =>
      searchJobsFaceted(database, {
        ...defaultJobCatalogFilters,
        employers: [companySlug],
        jobTypes: ["graduate_job"],
        sectors: ["law"],
      }),
    );
    expect(lawAndGraduate.result.total).toBe(1);
    expect(lawAndGraduate.result.items[0]!.title).toBe("Graduate Solicitor");

    const lawAnyType = await asCrawler((database) =>
      searchJobsFaceted(database, {
        ...defaultJobCatalogFilters,
        employers: [companySlug],
        sectors: ["law"],
      }),
    );
    expect(lawAnyType.result.total).toBe(1);

    const lawOrConsulting = await asCrawler((database) =>
      searchJobsFaceted(database, {
        ...defaultJobCatalogFilters,
        employers: [companySlug],
        sectors: ["law", "consulting"],
      }),
    );
    expect(lawOrConsulting.result.total).toBe(1);

    const technologyAny = await asCrawler((database) =>
      searchJobsFaceted(database, {
        ...defaultJobCatalogFilters,
        employers: [companySlug],
        sectors: ["technology_it"],
      }),
    );
    expect(technologyAny.result.total).toBe(2);
  });

  it("includes descendant subsectors when a sector is selected without subsectors", async () => {
    const companyId = await seedFacetedFixture();
    const companySlug = (
      await migrationDatabase<
        { slug: string }[]
      >`select slug from app.company where id = ${companyId}::uuid`
    )[0]!.slug;

    const technology = await asCrawler((database) =>
      searchJobsFaceted(database, {
        ...defaultJobCatalogFilters,
        employers: [companySlug],
        sectors: ["technology_it"],
      }),
    );
    expect(technology.result.total).toBe(2);

    const technologyWithSubsector = await asCrawler((database) =>
      searchJobsFaceted(database, {
        ...defaultJobCatalogFilters,
        employers: [companySlug],
        sectors: ["technology_it"],
        subsectors: ["software_development"],
      }),
    );
    expect(technologyWithSubsector.result.total).toBe(2);
  });

  it("excludes expired, draft and needs-review jobs from results and counts", async () => {
    const companyId = await seedFacetedFixture();
    const companySlug = (
      await migrationDatabase<
        { slug: string }[]
      >`select slug from app.company where id = ${companyId}::uuid`
    )[0]!.slug;

    const payload = await asCrawler((database) =>
      searchJobsFaceted(database, {
        ...defaultJobCatalogFilters,
        employers: [companySlug],
      }),
    );
    expect(payload.result.total).toBe(3);
    const titles = payload.result.items.map((job) => job.title);
    expect(titles).not.toContain("Old Graduate Role");
    expect(titles).not.toContain("Draft Role");
  });

  it("returns disjunctive location counts that respect other facets", async () => {
    const companyId = await seedFacetedFixture();
    const companySlug = (
      await migrationDatabase<
        { slug: string }[]
      >`select slug from app.company where id = ${companyId}::uuid`
    )[0]!.slug;
    const jobId = await asCrawler(
      (database) =>
        database<{ id: string }[]>`
        insert into app.job (
          company_id, slug, application_url, title, content_hash,
          opportunity_type, sector_key, eligibility_status, publication_status,
          classification_source, classification_version, remote_type
        )
        values (
          ${companyId}::uuid, ${uniqueSlug("fac-remote")}, 'https://facet.example.com/remote',
          'Remote Graduate Role', ${"e".repeat(64)}, 'graduate_job', 'law',
          'eligible', 'published', 'deterministic', 1, 'remote'
        )
        returning id
      `,
    );
    await asCrawler(
      (database) =>
        database`
        insert into app.job_location (job_id, source_text, position)
        values (${jobId[0]!.id}::uuid, 'London', 0)
      `,
    );

    const payload = await asCrawler((database) =>
      searchJobsFaceted(database, {
        ...defaultJobCatalogFilters,
        employers: [companySlug],
      }),
    );
    const locations = payload.facets.locations;
    expect(locations.map((option) => option.value)).toContain("remote");
    const remoteCount = locations.find((option) => option.value === "remote")!.count;
    expect(remoteCount).toBeGreaterThanOrEqual(1);
  });
});
