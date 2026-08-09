import postgres, { type TransactionSql } from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { CareerReview } from "../../src/modules/career-documents/domain/review";
import {
  createCareerDocument,
  createCareerDocumentVersion,
  findCareerDocument,
  findCareerDocumentVersion,
  listCareerDocumentReviews,
  listCareerDocuments,
  listCareerDocumentVersions,
  listCareerJobTargets,
  saveCareerDocumentReview,
  saveCareerJobTarget,
} from "../../src/modules/career-documents/infrastructure/career-repository";
import { reserveCareerDocumentReviewUsage } from "../../src/modules/career-documents/infrastructure/review-usage-repository";
import { reserveJobSearchUsage } from "../../src/modules/job-discovery/infrastructure/search-usage-repository";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const migrationDatabase = postgres(databaseUrl, { max: 2, prepare: false });
const runtimeUrl = new URL(databaseUrl);
runtimeUrl.username = "offerlab_runtime_login";
runtimeUrl.password = "postgres";
const runtimeDatabase = postgres(runtimeUrl.toString(), { max: 2, prepare: false });

const userOne = "20000000-0000-4000-8000-000000000001";
const userTwo = "20000000-0000-4000-8000-000000000002";

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

const sourceContent = `
Professional profile
Graduate developer targeting the OfferLab Software Engineer role with practical TypeScript experience.

Experience
Built accessible web application features with React, TypeScript and PostgreSQL.
Worked with colleagues to test releases and document implementation decisions.
`;

const updatedContent = `${sourceContent}
Projects
Delivered a role-tracking interface and verified its behaviour with automated integration tests.
`;

const review: CareerReview = {
  documentChecks: {
    length: "The extracted CV has enough content for a focused review.",
    readability: "Conventional headings make the extracted text easy to scan.",
    specificity: "The evidence is concrete but could include more supported outcomes.",
    targeting: "The target role is named explicitly.",
  },
  matchedRequirements: ["typescript", "postgresql"],
  missingRequirements: ["testing"],
  priorityActions: [
    {
      category: "Evidence",
      observation: "Testing is mentioned without a concrete example.",
      suggestion: "Add a truthful testing example from an existing project.",
    },
  ],
  strengths: [
    {
      evidence: "The CV describes practical TypeScript delivery.",
      requirement: "TypeScript",
    },
  ],
  suggestedContent: null,
  summary: "The CV is targeted and should make its testing evidence more specific.",
};

type Fixture = Readonly<{
  documentId: string;
  jobId: string;
  reviewId: string;
  versionId: string;
}>;

let fixture: Fixture;

async function clearCareerFixtures() {
  await migrationDatabase`
    delete from app.audit_event
    where entity_type in (
      'career_document_review',
      'career_document_version',
      'career_document',
      'career_job_target'
    )
  `;
  await migrationDatabase`delete from app.career_document_review`;
  await migrationDatabase`delete from app.career_document_review_usage`;
  await migrationDatabase`delete from app.career_document_version`;
  await migrationDatabase`delete from app.career_document`;
  await migrationDatabase`delete from app.career_job_target`;
  await migrationDatabase`delete from app.job_search_usage`;
}

async function createFixture(): Promise<Fixture> {
  return asUser(userOne, async (database) => {
    const job = await saveCareerJobTarget(database, userOne, {
      applyUrl: null,
      companyName: "OfferLab Integration Ltd",
      description:
        "Build accessible product features using TypeScript and PostgreSQL, and verify them with automated tests.",
      employmentType: "Full-time",
      fetchedAt: null,
      location: "London",
      provider: "manual",
      providerJobId: null,
      publishedAt: null,
      roleTitle: "Software Engineer",
      sourcePublisher: null,
      sourceUrl: null,
    });
    const document = await createCareerDocument(
      database,
      userOne,
      "cv",
      "Software Engineer CV",
      {
        contentText: sourceContent,
        jobDescription: "",
        label: "Uploaded CV",
        targetCompany: null,
        targetJobId: job.id,
        targetRole: null,
      },
      {
        filename: "software-engineer-cv.pdf",
        mimeType: "application/pdf",
        sha256: "a".repeat(64),
        sizeBytes: 4_096,
      },
    );
    const version = await createCareerDocumentVersion(database, userOne, document.id, {
      contentText: updatedContent,
      jobDescription: "",
      label: "Testing evidence",
      targetCompany: null,
      targetJobId: job.id,
      targetRole: null,
    });
    if (!version) throw new Error("Expected a career document version fixture.");
    const savedReview = await saveCareerDocumentReview(
      database,
      userOne,
      version.id,
      {
        id: "offerlab-career-rubric-v1",
        inputTokens: null,
        latencyMs: null,
        mode: "local",
        modelRequested: false,
        noticeVersion: null,
        outputTokens: null,
        promptVersion: 1,
      },
      review,
    );
    return {
      documentId: document.id,
      jobId: job.id,
      reviewId: savedReview.id,
      versionId: version.id,
    };
  });
}

beforeEach(async () => {
  await clearCareerFixtures();
  fixture = await createFixture();
});

afterAll(async () => {
  await clearCareerFixtures();
  await Promise.all([migrationDatabase.end(), runtimeDatabase.end()]);
});

describe("career document repository ownership", () => {
  it("persists an owner-scoped job, document lineage and review", async () => {
    await expect(
      asUser(userOne, (database) => listCareerJobTargets(database, userOne)),
    ).resolves.toMatchObject([
      {
        companyName: "OfferLab Integration Ltd",
        id: fixture.jobId,
        provider: "manual",
        roleTitle: "Software Engineer",
      },
    ]);
    await expect(
      asUser(userOne, (database) => listCareerDocuments(database, userOne, "cv")),
    ).resolves.toMatchObject([
      {
        id: fixture.documentId,
        latestVersion: { id: fixture.versionId, revision: 2 },
        title: "Software Engineer CV",
        versionCount: 2,
      },
    ]);
    await expect(
      asUser(userOne, (database) =>
        findCareerDocumentVersion(database, userOne, fixture.documentId, fixture.versionId),
      ),
    ).resolves.toMatchObject({
      id: fixture.versionId,
      targetCompany: "OfferLab Integration Ltd",
      targetJobId: fixture.jobId,
      targetRole: "Software Engineer",
    });
    await expect(
      asUser(userOne, (database) =>
        listCareerDocumentReviews(database, userOne, fixture.versionId),
      ),
    ).resolves.toMatchObject([
      {
        id: fixture.reviewId,
        providerMode: "local",
        summary: review.summary,
      },
    ]);
  });

  it("does not reveal another member's rows through repository methods", async () => {
    await expect(
      asUser(userTwo, (database) => listCareerJobTargets(database, userTwo)),
    ).resolves.toEqual([]);
    await expect(
      asUser(userTwo, (database) => findCareerDocument(database, userTwo, fixture.documentId)),
    ).resolves.toBeNull();
    await expect(
      asUser(userTwo, (database) =>
        listCareerDocumentVersions(database, userTwo, fixture.documentId),
      ),
    ).resolves.toEqual([]);
    await expect(
      asUser(userTwo, (database) =>
        listCareerDocumentReviews(database, userTwo, fixture.versionId),
      ),
    ).resolves.toEqual([]);

    await expect(
      asUser(userTwo, (database) => findCareerDocument(database, userOne, fixture.documentId)),
    ).resolves.toBeNull();
    await expect(
      asUser(userTwo, (database) =>
        saveCareerDocumentReview(
          database,
          userTwo,
          fixture.versionId,
          {
            id: "offerlab-career-rubric-v1",
            inputTokens: null,
            latencyMs: null,
            mode: "local",
            modelRequested: false,
            noticeVersion: null,
            outputTokens: null,
            promptVersion: 1,
          },
          review,
        ),
      ),
    ).rejects.toThrow();
  });
});

describe("career workspace PostgreSQL RLS", () => {
  it("enables and forces RLS on every owner-owned career table", async () => {
    const rows = await migrationDatabase<
      { relforcerowsecurity: boolean; relname: string; relrowsecurity: boolean }[]
    >`
      select relname,relrowsecurity,relforcerowsecurity
      from pg_class
      where oid in (
        'app.career_job_target'::regclass,
        'app.career_document'::regclass,
        'app.career_document_version'::regclass,
        'app.career_document_review'::regclass,
        'app.career_document_review_usage'::regclass,
        'app.job_search_usage'::regclass
      )
      order by relname
    `;
    expect(rows.map(({ relname }) => relname)).toEqual([
      "career_document",
      "career_document_review",
      "career_document_review_usage",
      "career_document_version",
      "career_job_target",
      "job_search_usage",
    ]);
    expect(rows.every((row) => row.relrowsecurity && row.relforcerowsecurity)).toBe(true);
  });

  it("keeps career tables and reservation functions unavailable to untrusted roles", async () => {
    const tablePrivileges = await migrationDatabase<
      { permitted: boolean; role_name: string; table_name: string }[]
    >`
      select role_name,table_name,
        has_table_privilege(role_name,'app.'||table_name,'SELECT')
        or has_table_privilege(role_name,'app.'||table_name,'INSERT')
        or has_table_privilege(role_name,'app.'||table_name,'UPDATE')
        or has_table_privilege(role_name,'app.'||table_name,'DELETE') permitted
      from (values ('anon'),('authenticated'),('offerlab_identity_sync')) roles(role_name)
      cross join (values
        ('career_job_target'),('job_search_usage'),('career_document_review_usage'),
        ('career_document'),('career_document_version'),('career_document_review')
      ) tables(table_name)
    `;
    expect(tablePrivileges.every(({ permitted }) => !permitted)).toBe(true);

    const functionPrivileges = await migrationDatabase<
      { app_can_execute: boolean; untrusted_can_execute: boolean }[]
    >`
      select
        has_function_privilege(
          'offerlab_app',
          'app.reserve_job_search_usage(uuid,integer,integer,integer)',
          'EXECUTE'
        ) and has_function_privilege(
          'offerlab_app',
          'app.reserve_career_document_review_usage(uuid,boolean,integer,integer,integer)',
          'EXECUTE'
        ) app_can_execute,
        has_function_privilege(
          'authenticated',
          'app.reserve_job_search_usage(uuid,integer,integer,integer)',
          'EXECUTE'
        ) or has_function_privilege(
          'anon',
          'app.reserve_career_document_review_usage(uuid,boolean,integer,integer,integer)',
          'EXECUTE'
        ) untrusted_can_execute
    `;
    expect(functionPrivileges[0]).toEqual({
      app_can_execute: true,
      untrusted_can_execute: false,
    });
  });

  it("hides every object ID from a second member and from a session without owner context", async () => {
    const hidden = await asUser(
      userTwo,
      (database) => database<{ id: string; table_name: string }[]>`
        select id,'career_job_target' table_name
          from app.career_job_target where id=${fixture.jobId}::uuid
        union all
        select id,'career_document' table_name
          from app.career_document where id=${fixture.documentId}::uuid
        union all
        select id,'career_document_version' table_name
          from app.career_document_version where id=${fixture.versionId}::uuid
        union all
        select id,'career_document_review' table_name
          from app.career_document_review where id=${fixture.reviewId}::uuid
      `,
    );
    expect(hidden).toEqual([]);

    const withoutOwner = await runtimeDatabase.begin(async (transaction) => {
      await transaction`set local role offerlab_app`;
      return transaction<{ count: number }[]>`
        select (
          (select count(*) from app.career_job_target) +
          (select count(*) from app.career_document) +
          (select count(*) from app.career_document_version) +
          (select count(*) from app.career_document_review) +
          (select count(*) from app.career_document_review_usage) +
          (select count(*) from app.job_search_usage)
        )::int count
      `;
    });
    expect(withoutOwner[0]?.count).toBe(0);
  });

  it("rejects cross-owner inserts for every owner-owned career table", async () => {
    const operations = [
      (database: TransactionSql) => database`
        insert into app.career_job_target(
          owner_user_id,provider,role_title,company_name,description
        ) values(
          ${userOne}::uuid,'manual','Stolen role','Stolen company','Stolen description'
        )
      `,
      (database: TransactionSql) => database`
        insert into app.career_document(owner_user_id,kind,title)
        values(${userOne}::uuid,'cv','Stolen CV')
      `,
      (database: TransactionSql) => database`
        insert into app.career_document_version(
          owner_user_id,document_id,revision,label,content_text,origin
        ) values(
          ${userOne}::uuid,${fixture.documentId}::uuid,99,'Stolen version',${sourceContent},'copy'
        )
      `,
      (database: TransactionSql) => database`
        insert into app.career_document_review(
          owner_user_id,document_version_id,provider_id,provider_mode,prompt_version,
          summary,strengths,priority_actions,document_checks
        ) values(
          ${userOne}::uuid,${fixture.versionId}::uuid,'local-test','local',1,
          'Stolen review','[]'::jsonb,
          '[{"category":"Evidence","observation":"Attempted","suggestion":"Rejected"}]'::jsonb,
          '{"length":"Reviewed","readability":"Reviewed","specificity":"Reviewed","targeting":"Reviewed"}'::jsonb
        )
      `,
      (database: TransactionSql) => database`
        insert into app.job_search_usage(owner_user_id,provider)
        values(${userOne}::uuid,'jsearch')
      `,
      (database: TransactionSql) => database`
        insert into app.career_document_review_usage(owner_user_id,model_requested)
        values(${userOne}::uuid,false)
      `,
    ];

    for (const operation of operations) {
      await expect(asUser(userTwo, operation)).rejects.toThrow(
        /permission denied|row-level security/u,
      );
    }
  });

  it("reserves content-free searches atomically across member and account limits", async () => {
    const limits = { accountMonthly: 3, memberDaily: 2, memberMonthly: 2 } as const;
    await expect(
      asUser(userOne, (database) => reserveJobSearchUsage(database, userOne, limits)),
    ).resolves.toBe(true);
    await expect(
      asUser(userOne, (database) => reserveJobSearchUsage(database, userOne, limits)),
    ).resolves.toBe(true);
    await expect(
      asUser(userOne, (database) => reserveJobSearchUsage(database, userOne, limits)),
    ).resolves.toBe(false);
    await expect(
      asUser(userTwo, (database) => reserveJobSearchUsage(database, userTwo, limits)),
    ).resolves.toBe(true);
    await expect(
      asUser(userTwo, (database) => reserveJobSearchUsage(database, userTwo, limits)),
    ).resolves.toBe(false);

    await expect(
      asUser(userTwo, (database) => reserveJobSearchUsage(database, userOne, limits)),
    ).rejects.toThrow(/owner context mismatch/u);
    const visibleToUserTwo = await asUser(
      userTwo,
      (database) => database<{ count: number }[]>`
        select count(*)::int count from app.job_search_usage
      `,
    );
    expect(visibleToUserTwo[0]?.count).toBe(1);
  });

  it("allows exactly one concurrent search reservation at the final account allowance", async () => {
    const limits = { accountMonthly: 1, memberDaily: 2, memberMonthly: 2 } as const;
    const outcomes = await Promise.all([
      asUser(userOne, (database) => reserveJobSearchUsage(database, userOne, limits)),
      asUser(userTwo, (database) => reserveJobSearchUsage(database, userTwo, limits)),
    ]);

    expect([...outcomes].sort()).toEqual([false, true]);
    const rows = await migrationDatabase<{ count: number }[]>`
      select count(*)::int count from app.job_search_usage
    `;
    expect(rows[0]?.count).toBe(1);
  });

  it("reserves local and hosted review attempts under separate account-cost semantics", async () => {
    const limits = { hostedAccountMonthly: 1, memberDaily: 5, memberMonthly: 5 } as const;
    await expect(
      asUser(userOne, (database) =>
        reserveCareerDocumentReviewUsage(database, userOne, false, limits),
      ),
    ).resolves.toBe(true);
    await expect(
      asUser(userTwo, (database) =>
        reserveCareerDocumentReviewUsage(database, userTwo, false, limits),
      ),
    ).resolves.toBe(true);
    await expect(
      asUser(userOne, (database) =>
        reserveCareerDocumentReviewUsage(database, userOne, true, limits),
      ),
    ).resolves.toBe(true);
    await expect(
      asUser(userTwo, (database) =>
        reserveCareerDocumentReviewUsage(database, userTwo, true, limits),
      ),
    ).resolves.toBe(false);

    await expect(
      asUser(userTwo, (database) =>
        reserveCareerDocumentReviewUsage(database, userOne, false, limits),
      ),
    ).rejects.toThrow(/owner context mismatch/u);
    const visibleToUserTwo = await asUser(
      userTwo,
      (database) => database<{ model_requested: boolean }[]>`
        select model_requested from app.career_document_review_usage order by id
      `,
    );
    expect(visibleToUserTwo).toEqual([{ model_requested: false }]);
  });

  it("allows exactly one concurrent hosted review at the final account allowance", async () => {
    const limits = { hostedAccountMonthly: 1, memberDaily: 2, memberMonthly: 2 } as const;
    const outcomes = await Promise.all([
      asUser(userOne, (database) =>
        reserveCareerDocumentReviewUsage(database, userOne, true, limits),
      ),
      asUser(userTwo, (database) =>
        reserveCareerDocumentReviewUsage(database, userTwo, true, limits),
      ),
    ]);

    expect([...outcomes].sort()).toEqual([false, true]);
    const rows = await migrationDatabase<{ count: number }[]>`
      select count(*)::int count
      from app.career_document_review_usage where model_requested
    `;
    expect(rows[0]?.count).toBe(1);
  });

  it("rejects null ceilings at both security-definer reservation boundaries", async () => {
    await expect(
      asUser(
        userOne,
        (database) => database`
        select app.reserve_job_search_usage(${userOne}::uuid,null,2,2)
      `,
      ),
    ).rejects.toThrow(/invalid job search usage limit/u);
    await expect(
      asUser(
        userOne,
        (database) => database`
        select app.reserve_career_document_review_usage(${userOne}::uuid,false,2,null,2)
      `,
      ),
    ).rejects.toThrow(/invalid career document review usage limit/u);
  });
});

describe("career workspace database invariants", () => {
  it("converges concurrent saves of the same provider job on one target", async () => {
    const input = {
      applyUrl: "https://jobs.example.test/apply/provider-race",
      companyName: "Concurrent Jobs Ltd",
      description: "Build accessible software and verify it with automated tests.",
      employmentType: "FULLTIME",
      fetchedAt: new Date("2026-08-07T12:00:00Z"),
      location: "London",
      provider: "jsearch" as const,
      providerJobId: "provider-race-job",
      publishedAt: new Date("2026-08-06T12:00:00Z"),
      roleTitle: "Graduate Developer",
      sourcePublisher: "Example Jobs",
      sourceUrl: "https://jobs.example.test/apply/provider-race",
    };
    const saved = await Promise.all([
      asUser(userOne, (database) => saveCareerJobTarget(database, userOne, input)),
      asUser(userOne, (database) => saveCareerJobTarget(database, userOne, input)),
    ]);

    expect(saved[0]?.id).toBe(saved[1]?.id);
    const rows = await asUser(
      userOne,
      (database) => database<{ count: number }[]>`
        select count(*)::int count from app.career_job_target
        where owner_user_id=${userOne}::uuid
          and provider='jsearch' and provider_job_id='provider-race-job'
      `,
    );
    expect(rows[0]?.count).toBe(1);
  });

  it("preserves mutable creation time and database-controls immutable creation time", async () => {
    const original = await asUser(
      userOne,
      (database) => database<{ created_at: Date }[]>`
        select created_at from app.career_document
        where owner_user_id=${userOne}::uuid and id=${fixture.documentId}::uuid
      `,
    );
    const mutated = await asUser(
      userOne,
      (database) => database<{ created_at: Date }[]>`
        update app.career_document
        set title='Renamed CV',created_at='2000-01-01T00:00:00Z'::timestamptz
        where owner_user_id=${userOne}::uuid and id=${fixture.documentId}::uuid
        returning created_at
      `,
    );
    expect(mutated[0]?.created_at.toISOString()).toBe(original[0]?.created_at.toISOString());

    const insertedVersion = await asUser(
      userOne,
      (database) => database<{ created_at: Date }[]>`
        insert into app.career_document_version(
          owner_user_id,document_id,revision,label,content_text,origin,created_at
        ) values(
          ${userOne}::uuid,${fixture.documentId}::uuid,50,'Controlled timestamp',
          ${sourceContent},'editor','2000-01-01T00:00:00Z'::timestamptz
        ) returning created_at
      `,
    );
    const insertedReview = await asUser(
      userOne,
      (database) => database<{ created_at: Date }[]>`
        insert into app.career_document_review(
          owner_user_id,document_version_id,provider_id,provider_mode,model_requested,
          prompt_version,summary,strengths,priority_actions,document_checks,created_at
        ) values(
          ${userOne}::uuid,${fixture.versionId}::uuid,'local-test','local',false,1,
          'Database-controlled timestamp','[]'::jsonb,
          '[{"category":"Evidence","observation":"Observed","suggestion":"Improve"}]'::jsonb,
          '{"length":"Reviewed","readability":"Reviewed","specificity":"Reviewed","targeting":"Reviewed"}'::jsonb,
          '2000-01-01T00:00:00Z'::timestamptz
        ) returning created_at
      `,
    );
    const recentBoundary = Date.now() - 60_000;
    expect(insertedVersion[0]!.created_at.getTime()).toBeGreaterThan(recentBoundary);
    expect(insertedReview[0]!.created_at.getTime()).toBeGreaterThan(recentBoundary);
  });

  it("rejects partial or origin-inconsistent upload metadata and empty saved targets", async () => {
    const operations = [
      (database: TransactionSql) => database`
        insert into app.career_document_version(
          owner_user_id,document_id,revision,label,content_text,origin,source_filename
        ) values(
          ${userOne}::uuid,${fixture.documentId}::uuid,60,'Partial source',${sourceContent},
          'upload','partial.pdf'
        )
      `,
      (database: TransactionSql) => database`
        insert into app.career_document_version(
          owner_user_id,document_id,revision,label,content_text,origin,source_filename,
          source_mime_type,source_size_bytes,source_sha256
        ) values(
          ${userOne}::uuid,${fixture.documentId}::uuid,61,'Editor with source',${sourceContent},
          'editor','source.pdf','application/pdf',100,${"b".repeat(64)}
        )
      `,
      (database: TransactionSql) => database`
        insert into app.career_document_version(
          owner_user_id,document_id,revision,label,content_text,origin,target_job_id,
          target_role,target_company,job_description
        ) values(
          ${userOne}::uuid,${fixture.documentId}::uuid,62,'Empty saved target',${sourceContent},
          'editor',${fixture.jobId}::uuid,'Software Engineer','OfferLab Integration Ltd',''
        )
      `,
    ];

    for (const operation of operations) {
      await expect(asUser(userOne, operation)).rejects.toThrow(/check constraint/u);
    }
  });

  it("rejects invalid review provenance and bounded-array violations", async () => {
    const strengths = Array.from({ length: 6 }, (_, index) => ({
      evidence: `Evidence ${index}`,
      requirement: `Requirement ${index}`,
    }));
    const actions = Array.from({ length: 9 }, (_, index) => ({
      category: "Evidence",
      observation: `Observation ${index}`,
      suggestion: `Suggestion ${index}`,
    }));
    const insertReview = (
      database: TransactionSql,
      provenance: Readonly<{
        mode: string;
        modelRequested: boolean;
        notice: string | null;
      }>,
      reviewStrengths: readonly Readonly<Record<string, string>>[] = [],
      reviewActions: readonly Readonly<Record<string, string>>[] = [
        { category: "Evidence", observation: "Observed", suggestion: "Improve" },
      ],
    ) => database`
      insert into app.career_document_review(
        owner_user_id,document_version_id,provider_id,provider_mode,model_requested,
        provider_notice_version,prompt_version,summary,strengths,priority_actions,document_checks
      ) values(
        ${userOne}::uuid,${fixture.versionId}::uuid,'test-provider',${provenance.mode},
        ${provenance.modelRequested},${provenance.notice},1,'Invalid review',
        ${database.json(reviewStrengths)},${database.json(reviewActions)},
        '{"length":"Reviewed","readability":"Reviewed","specificity":"Reviewed","targeting":"Reviewed"}'::jsonb
      )
    `;
    const operations = [
      (database: TransactionSql) =>
        insertReview(database, { mode: "local", modelRequested: true, notice: "notice-v1" }),
      (database: TransactionSql) =>
        insertReview(database, { mode: "model", modelRequested: false, notice: null }),
      (database: TransactionSql) =>
        insertReview(database, { mode: "fallback", modelRequested: true, notice: " " }),
      (database: TransactionSql) =>
        insertReview(database, { mode: "local", modelRequested: false, notice: null }, strengths),
      (database: TransactionSql) =>
        insertReview(database, { mode: "local", modelRequested: false, notice: null }, [], actions),
      (database: TransactionSql) =>
        insertReview(database, { mode: "local", modelRequested: false, notice: null }, [], []),
    ];

    for (const operation of operations) {
      await expect(asUser(userOne, operation)).rejects.toThrow(/check constraint/u);
    }
  });

  it("denies immutable updates and deletes and filters cross-owner mutable updates", async () => {
    const immutableOperations = [
      (database: TransactionSql) => database`
        update app.career_document_version set label='Changed'
        where owner_user_id=${userOne}::uuid and id=${fixture.versionId}::uuid
      `,
      (database: TransactionSql) => database`
        delete from app.career_document_version
        where owner_user_id=${userOne}::uuid and id=${fixture.versionId}::uuid
      `,
      (database: TransactionSql) => database`
        update app.career_document_review set summary='Changed'
        where owner_user_id=${userOne}::uuid and id=${fixture.reviewId}::uuid
      `,
      (database: TransactionSql) => database`
        delete from app.career_document_review
        where owner_user_id=${userOne}::uuid and id=${fixture.reviewId}::uuid
      `,
    ];
    for (const operation of immutableOperations) {
      await expect(asUser(userOne, operation)).rejects.toThrow(/permission denied/u);
    }

    const crossOwnerUpdate = await asUser(
      userTwo,
      (database) => database<{ id: string }[]>`
        update app.career_document set title='Cross-owner change'
        where owner_user_id=${userOne}::uuid and id=${fixture.documentId}::uuid
        returning id
      `,
    );
    expect(crossOwnerUpdate).toEqual([]);
  });
});
