import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import {
  isJobIndexable,
  type JobIndexabilityEvidence,
} from "../../src/modules/job-catalog/domain/job-indexability";
import {
  findJobDetail,
  listCatalogJobsForSitemap,
  listRelatedEmployerJobs,
  listSimilarJobs,
  type RelatedJobEvidence,
} from "../../src/modules/job-catalog/infrastructure/catalog-repository";
import { upsertCompany } from "../../src/modules/job-catalog/infrastructure/company-repository";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const database = postgres(databaseUrl, { max: 2, prepare: false });

const uniqueSlug = (base: string): string =>
  `${base}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

type SeededJob = Readonly<{
  active: boolean;
  applicationUrl: string | null;
  deadline: string | null;
  descriptionSummary?: string;
  eligibility: string;
  employmentType: string | null;
  locationText: string | null;
  opportunityType: string;
  publication: string;
  sectorKey: string | null;
  slug: string;
  title: string;
}>;

async function seedJob(companyId: string, job: SeededJob): Promise<void> {
  await database.begin(async (transaction) => {
    await transaction`set local role offerlab_crawler`;
    await transaction`
      insert into app.job (
        company_id, slug, application_url, title, content_hash,
        opportunity_type, sector_key, eligibility_status, publication_status, active,
        classification_source, classification_version, location_text, employment_type,
        application_deadline, description_summary, posted_at
      )
      values (
        ${companyId}::uuid, ${job.slug},
        ${job.applicationUrl ?? "https://seo.example.com/apply"},
        ${job.title}, ${"9".repeat(64)}, ${job.opportunityType}, ${job.sectorKey},
        ${job.eligibility}, ${job.publication}, ${job.active},
        'deterministic', 1, ${job.locationText}, ${job.employmentType},
        ${job.deadline}::timestamptz, ${job.descriptionSummary ?? null}, now()
      )
    `;
  });
}

function indexabilityEvidence(row: Record<string, unknown>): JobIndexabilityEvidence {
  const textArray = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : []);
  return {
    active: row.active === true,
    application_deadline:
      row.application_deadline === null ? null : new Date(row.application_deadline as string),
    application_url: row.application_url === null ? null : String(row.application_url),
    degree_requirements: [],
    description_summary: row.description_summary === null ? null : String(row.description_summary),
    eligibility_status: String(row.eligibility_status),
    employment_type: row.employment_type === null ? null : String(row.employment_type),
    experience_requirements: null,
    first_seen_at: new Date(row.first_seen_at as string),
    location_text: row.location_text === null ? null : String(row.location_text),
    opportunity_type: String(row.opportunity_type),
    posted_at: row.posted_at === null ? null : new Date(row.posted_at as string),
    preferred_skills: textArray(row.preferred_skills),
    publication_status: String(row.publication_status),
    remote_type: null,
    requirements: textArray(row.requirements),
    responsibilities: textArray(row.responsibilities),
    salary_max: null,
    salary_min: null,
    sector_key: row.sector_key === null ? null : String(row.sector_key),
    skills: textArray(row.skills),
    subsector_key: null,
    visa_sponsorship_status: String(row.visa_sponsorship_status),
  };
}

afterAll(async () => {
  await database.end();
});

describe("job detail SEO", () => {
  it("sitemap inclusion exactly matches the job indexability policy", async () => {
    const companyId = await database.begin(async (transaction) => {
      await transaction`set local role offerlab_crawler`;
      return upsertCompany(transaction, {
        careersUrl: `https://seo-parity-${uniqueSlug("c")}.example.com`,
        crawlAllowed: "allowed",
        name: "Parity Test Co",
        slug: uniqueSlug("parity-test-co"),
        sourceType: "greenhouse",
      });
    });

    const farFuture = "2999-01-01T00:00:00Z";
    const farPast = "2000-01-01T00:00:00Z";
    const seeded: SeededJob[] = [
      {
        active: true,
        applicationUrl: "https://seo.example.com/apply/full",
        deadline: farFuture,
        descriptionSummary: "A complete factual summary of the test role.",
        eligibility: "eligible",
        employmentType: "full_time",
        locationText: "London",
        opportunityType: "graduate_scheme",
        publication: "published",
        sectorKey: "financial_services",
        slug: uniqueSlug("seo-indexable"),
        title: "Indexable Role",
      },
      {
        active: true,
        applicationUrl: "https://seo.example.com/apply/thin",
        deadline: null,
        eligibility: "eligible",
        employmentType: null,
        locationText: null,
        opportunityType: "unknown",
        publication: "published",
        sectorKey: null,
        slug: uniqueSlug("seo-thin"),
        title: "Thin Role",
      },
      {
        active: true,
        applicationUrl: "https://seo.example.com/apply/expired",
        deadline: farPast,
        eligibility: "eligible",
        employmentType: "full_time",
        locationText: "London",
        opportunityType: "graduate_scheme",
        publication: "published",
        sectorKey: "financial_services",
        slug: uniqueSlug("seo-expired"),
        title: "Expired Role",
      },
      {
        active: true,
        applicationUrl: "https://seo.example.com/apply/draft",
        deadline: farFuture,
        eligibility: "eligible",
        employmentType: "full_time",
        locationText: "London",
        opportunityType: "graduate_scheme",
        publication: "draft",
        sectorKey: "financial_services",
        slug: uniqueSlug("seo-draft"),
        title: "Draft Role",
      },
      {
        active: true,
        applicationUrl: "https://seo.example.com/apply/suppressed",
        deadline: farFuture,
        eligibility: "eligible",
        employmentType: "full_time",
        locationText: "London",
        opportunityType: "graduate_scheme",
        publication: "suppressed",
        sectorKey: "financial_services",
        slug: uniqueSlug("seo-suppressed"),
        title: "Suppressed Role",
      },
      {
        active: true,
        applicationUrl: "https://seo.example.com/apply/ineligible",
        deadline: farFuture,
        eligibility: "ineligible",
        employmentType: "full_time",
        locationText: "London",
        opportunityType: "graduate_scheme",
        publication: "published",
        sectorKey: "financial_services",
        slug: uniqueSlug("seo-ineligible"),
        title: "Ineligible Role",
      },
      {
        active: true,
        applicationUrl: "https://seo.example.com/apply/review",
        deadline: farFuture,
        eligibility: "needs_review",
        employmentType: "full_time",
        locationText: "London",
        opportunityType: "graduate_scheme",
        publication: "published",
        sectorKey: "financial_services",
        slug: uniqueSlug("seo-review"),
        title: "Review Role",
      },
      {
        active: false,
        applicationUrl: "https://seo.example.com/apply/inactive",
        deadline: farFuture,
        eligibility: "eligible",
        employmentType: "full_time",
        locationText: "London",
        opportunityType: "graduate_scheme",
        publication: "published",
        sectorKey: "financial_services",
        slug: uniqueSlug("seo-inactive"),
        title: "Inactive Role",
      },
    ];
    for (const job of seeded) await seedJob(companyId, job);

    const sitemapRows = await database.begin((transaction) =>
      listCatalogJobsForSitemap(transaction, 10_000),
    );
    const sitemapSlugs = new Set(sitemapRows.map((row) => row.slug));

    const fullRows = await database<Array<Record<string, unknown>>>`
      select active, application_deadline, application_url, description_summary,
        eligibility_status, employment_type, location_text, opportunity_type,
        posted_at, publication_status, remote_type, sector_key, subsector_key,
        visa_sponsorship_status, salary_min, salary_max, first_seen_at,
        responsibilities, requirements, skills, preferred_skills, degree_requirements,
        experience_requirements, slug
      from app.job
      where company_id = ${companyId}::uuid
    `;
    const policySlugs = new Set(
      fullRows
        .filter((row) => isJobIndexable(indexabilityEvidence(row), new Date()))
        .map((row) => String(row.slug)),
    );

    const seededSlugs = new Set(seeded.map((job) => job.slug));
    const sitemapMine = [...sitemapSlugs].filter((slug) => seededSlugs.has(slug)).sort();
    expect(sitemapMine).toEqual([...policySlugs].sort());
    expect(sitemapMine).toEqual([seeded[0]!.slug]);
  });

  it("returns structured locations and official employer URLs on the detail row", async () => {
    const companyId = await database.begin(async (transaction) => {
      await transaction`set local role offerlab_crawler`;
      const id = await upsertCompany(transaction, {
        careersUrl: `https://detail-${uniqueSlug("c")}.example.com/careers`,
        crawlAllowed: "allowed",
        name: "Detail Test Co",
        slug: uniqueSlug("detail-test-co"),
        sourceType: "greenhouse",
        websiteUrl: "https://detail.example.com",
      });
      await transaction`
        update app.company
        set logo_url = 'https://detail.example.com/logo.png'
        where id = ${id}::uuid
      `;
      return id;
    });
    const slug = uniqueSlug("detail-role");
    const jobId = await database.begin(async (transaction) => {
      await transaction`set local role offerlab_crawler`;
      const rows = await transaction<{ id: string }[]>`
        insert into app.job (
          company_id, slug, application_url, title, content_hash,
          opportunity_type, sector_key, eligibility_status, publication_status,
          classification_source, classification_version, active
        )
        values (
          ${companyId}::uuid, ${slug}, 'https://detail.example.com/apply',
          'Detail Role', ${"a".repeat(64)}, 'graduate_job', 'technology_it',
          'eligible', 'published', 'deterministic', 1, true
        )
        returning id
      `;
      await transaction`
        insert into app.job_location (job_id, city, region, country, source_text, on_site, position)
        values (${rows[0]!.id}::uuid, 'London', 'London', 'United Kingdom', 'London', true, 0)
      `;
      return rows[0]!.id;
    });

    const detail = await database.begin((transaction) => findJobDetail(transaction, slug));
    expect(detail).not.toBeNull();
    expect(detail!.company_website_url).toBe("https://detail.example.com");
    expect(detail!.company_logo_url).toBe("https://detail.example.com/logo.png");
    expect(detail!.locations).toEqual([
      {
        city: "London",
        country: "United Kingdom",
        hybrid: false,
        on_site: true,
        region: "London",
        remote: false,
        source_text: "London",
      },
    ]);
    expect(detail!.id).toBe(jobId);
  });
});

describe("related role queries", () => {
  async function seedRelatedFixture(): Promise<Readonly<{ companyA: string; companyB: string }>> {
    const companyA = await database.begin(async (transaction) => {
      await transaction`set local role offerlab_crawler`;
      return upsertCompany(transaction, {
        careersUrl: `https://rel-a-${uniqueSlug("c")}.example.com`,
        crawlAllowed: "allowed",
        name: "Related A Co",
        slug: uniqueSlug("related-a"),
        sourceType: "greenhouse",
      });
    });
    const companyB = await database.begin(async (transaction) => {
      await transaction`set local role offerlab_crawler`;
      return upsertCompany(transaction, {
        careersUrl: `https://rel-b-${uniqueSlug("c")}.example.com`,
        crawlAllowed: "allowed",
        name: "Related B Co",
        slug: uniqueSlug("related-b"),
        sourceType: "greenhouse",
      });
    });
    return { companyA, companyB };
  }

  it("same-employer related roles are public, current, bounded and deterministic", async () => {
    const { companyA } = await seedRelatedFixture();
    const currentSlug = uniqueSlug("rel-current");
    const currentId = await database.begin(async (transaction) => {
      await transaction`set local role offerlab_crawler`;
      const rows = await transaction<{ id: string }[]>`
        insert into app.job (
          company_id, slug, application_url, title, content_hash,
          opportunity_type, sector_key, eligibility_status, publication_status,
          classification_source, classification_version, posted_at, first_seen_at
        )
        values (
          ${companyA}::uuid, ${currentSlug}, 'https://rel.example.com/current',
          'Current Role', ${"b".repeat(64)}, 'graduate_scheme', 'technology_it',
          'eligible', 'published', 'deterministic', 1,
          now() - interval '10 days', now() - interval '10 days'
        )
        returning id
      `;
      return rows[0]!.id;
    });
    const siblings: ReadonlyArray<{
      deadline: string | null;
      postedDaysAgo: number;
      publication: string;
      slug: string;
      title: string;
    }> = [
      {
        deadline: null,
        postedDaysAgo: 1,
        publication: "published",
        slug: uniqueSlug("rel-s1"),
        title: "Sibling One",
      },
      {
        deadline: null,
        postedDaysAgo: 2,
        publication: "published",
        slug: uniqueSlug("rel-s2"),
        title: "Sibling Two",
      },
      {
        deadline: null,
        postedDaysAgo: 3,
        publication: "published",
        slug: uniqueSlug("rel-s3"),
        title: "Sibling Three",
      },
      {
        deadline: null,
        postedDaysAgo: 4,
        publication: "published",
        slug: uniqueSlug("rel-s4"),
        title: "Sibling Four",
      },
      {
        deadline: null,
        postedDaysAgo: 5,
        publication: "draft",
        slug: uniqueSlug("rel-draft"),
        title: "Draft Sibling",
      },
      {
        deadline: "2000-01-01T00:00:00Z",
        postedDaysAgo: 6,
        publication: "published",
        slug: uniqueSlug("rel-expired"),
        title: "Expired Sibling",
      },
    ];
    for (const sibling of siblings) {
      await database.begin(async (transaction) => {
        await transaction`set local role offerlab_crawler`;
        await transaction`
          insert into app.job (
            company_id, slug, application_url, title, content_hash,
            opportunity_type, sector_key, eligibility_status, publication_status,
            classification_source, classification_version, posted_at, first_seen_at,
            application_deadline
          )
          values (
            ${companyA}::uuid, ${sibling.slug}, ${`https://rel.example.com/${sibling.slug}`},
            ${sibling.title}, ${"c".repeat(64)}, 'graduate_scheme', 'technology_it',
            'eligible', ${sibling.publication}, 'deterministic', 1,
            now() - make_interval(days => ${sibling.postedDaysAgo}),
            now() - make_interval(days => ${sibling.postedDaysAgo}),
            ${sibling.deadline}::timestamptz
          )
        `;
      });
    }

    const rows = await database.begin((transaction) =>
      listRelatedEmployerJobs(transaction, companyA, currentId, 3),
    );
    expect(rows.map((row) => row.title)).toEqual(["Sibling One", "Sibling Two", "Sibling Three"]);
    expect(rows.every((row) => row.id !== currentId)).toBe(true);
  });

  it("similar roles match evidence, exclude the current and employer sections, and never return non-public roles", async () => {
    const { companyA, companyB } = await seedRelatedFixture();
    // A run-unique location label keeps the similarity matching isolated from
    // rows left behind by earlier integration runs against the same database.
    const uniqueCity = uniqueSlug("rel-city");
    const currentId = await database.begin(async (transaction) => {
      await transaction`set local role offerlab_crawler`;
      const rows = await transaction<{ id: string }[]>`
        insert into app.job (
          company_id, slug, application_url, title, content_hash,
          opportunity_type, sector_key, eligibility_status, publication_status,
          classification_source, classification_version, posted_at, first_seen_at
        )
        values (
          ${companyA}::uuid, ${uniqueSlug("relc-current")}, 'https://rel.example.com/current',
          'Current Role', ${"d".repeat(64)}, 'graduate_scheme', 'financial_services',
          'eligible', 'published', 'deterministic', 1,
          now() - interval '5 days', now() - interval '5 days'
        )
        returning id
      `;
      await transaction`
        insert into app.job_location (job_id, city, source_text, on_site, position)
        values (${rows[0]!.id}::uuid, ${uniqueCity}, ${uniqueCity}, true, 0)
      `;
      return rows[0]!.id;
    });
    const employerSectionIds: string[] = [];
    for (const title of ["Employer Match One", "Employer Match Two", "Employer Match Three"]) {
      employerSectionIds.push(
        await database.begin(async (transaction) => {
          await transaction`set local role offerlab_crawler`;
          const rows = await transaction<{ id: string }[]>`
            insert into app.job (
              company_id, slug, application_url, title, content_hash,
              opportunity_type, sector_key, eligibility_status, publication_status,
              classification_source, classification_version, posted_at, first_seen_at
            )
            values (
              ${companyA}::uuid, ${uniqueSlug("relc-employer")}, ${`https://rel.example.com/${uniqueSlug("apply")}`},
              ${title}, ${"e".repeat(64)}, 'graduate_scheme', 'financial_services',
              'eligible', 'published', 'deterministic', 1,
              now() - interval '4 days', now() - interval '4 days'
            )
            returning id
          `;
          await transaction`
            insert into app.job_location (job_id, city, source_text, on_site, position)
            values (${rows[0]!.id}::uuid, ${uniqueCity}, ${uniqueCity}, true, 0)
          `;
          return rows[0]!.id;
        }),
      );
    }
    const states: ReadonlyArray<{
      deadline: string | null;
      eligibility: string;
      postedDaysAgo: number;
      publication: string;
      slug: string;
      title: string;
      withLocation: boolean;
    }> = [
      {
        deadline: null,
        eligibility: "eligible",
        postedDaysAgo: 3,
        publication: "published",
        slug: uniqueSlug("relc-sim1"),
        title: "Similar One",
        withLocation: true,
      },
      {
        deadline: null,
        eligibility: "eligible",
        postedDaysAgo: 4,
        publication: "published",
        slug: uniqueSlug("relc-sim2"),
        title: "Similar Two",
        withLocation: true,
      },
      {
        deadline: null,
        eligibility: "eligible",
        postedDaysAgo: 5,
        publication: "published",
        slug: uniqueSlug("relc-sim3"),
        title: "Similar Three",
        withLocation: true,
      },
      {
        deadline: null,
        eligibility: "eligible",
        postedDaysAgo: 1,
        publication: "draft",
        slug: uniqueSlug("relc-draft"),
        title: "Similar Draft",
        withLocation: true,
      },
      {
        deadline: "2000-01-01T00:00:00Z",
        eligibility: "eligible",
        postedDaysAgo: 1,
        publication: "published",
        slug: uniqueSlug("relc-expired"),
        title: "Similar Expired",
        withLocation: true,
      },
      {
        deadline: null,
        eligibility: "ineligible",
        postedDaysAgo: 1,
        publication: "published",
        slug: uniqueSlug("relc-ineligible"),
        title: "Similar Ineligible",
        withLocation: true,
      },
      {
        deadline: null,
        eligibility: "eligible",
        postedDaysAgo: 1,
        publication: "published",
        slug: uniqueSlug("relc-other"),
        title: "Other Sector Role",
        withLocation: false,
      },
    ];
    for (const state of states) {
      await database.begin(async (transaction) => {
        await transaction`set local role offerlab_crawler`;
        const rows = await transaction<{ id: string }[]>`
          insert into app.job (
            company_id, slug, application_url, title, content_hash,
            opportunity_type, sector_key, subsector_key, eligibility_status, publication_status,
            classification_source, classification_version, posted_at, first_seen_at,
            application_deadline
          )
          values (
            ${companyB}::uuid, ${state.slug}, ${`https://rel.example.com/${state.slug}`},
            ${state.title}, ${"f".repeat(64)}, 'graduate_scheme',
            ${state.withLocation ? "financial_services" : "technology_it"},
            ${state.withLocation ? "retail_corporate_banking" : "software_development"},
            ${state.eligibility}, ${state.publication}, 'deterministic', 1,
            now() - make_interval(days => ${state.postedDaysAgo}),
            now() - make_interval(days => ${state.postedDaysAgo}),
            ${state.deadline}::timestamptz
          )
          returning id
        `;
        if (state.withLocation) {
          await transaction`
            insert into app.job_location (job_id, city, source_text, on_site, position)
            values (${rows[0]!.id}::uuid, ${uniqueCity}, ${uniqueCity}, true, 0)
          `;
        }
      });
    }

    const evidence: RelatedJobEvidence = {
      locationLabels: [uniqueCity.toLowerCase()],
      opportunityType: null,
      sectorKey: null,
      subsectorKey: null,
    };
    const rows = await database.begin((transaction) =>
      listSimilarJobs(transaction, evidence, [currentId, ...employerSectionIds], 3),
    );
    expect(rows.map((row) => row.title)).toEqual(["Similar One", "Similar Two", "Similar Three"]);
    expect(rows.every((row) => row.id !== currentId && !employerSectionIds.includes(row.id))).toBe(
      true,
    );
  });

  it("returns no similar roles when no stored evidence exists to match on", async () => {
    await seedRelatedFixture();
    const evidence: RelatedJobEvidence = {
      locationLabels: [],
      opportunityType: null,
      sectorKey: null,
      subsectorKey: null,
    };
    const rows = await database.begin((transaction) =>
      listSimilarJobs(transaction, evidence, [], 3),
    );
    expect(rows).toEqual([]);
  });
});
