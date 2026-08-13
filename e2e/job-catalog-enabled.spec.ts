import { expect, test } from "@playwright/test";
import postgres from "postgres";

/**
 * Enabled-catalogue E2E. Runs only when JOB_CATALOG_ENABLED=true is set for
 * the e2e server (e.g. `JOB_CATALOG_ENABLED=true pnpm test:e2e`). Seeds a
 * deterministic synthetic company and jobs through the crawler role so the
 * public experience can be exercised without any live employer source.
 */
test.skip(
  process.env.JOB_CATALOG_ENABLED !== "true",
  "requires JOB_CATALOG_ENABLED=true for the e2e server",
);

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";

async function seedCatalogue() {
  const database = postgres(databaseUrl, { max: 2, prepare: false });
  try {
    const companyId = await database.begin(async (transaction) => {
      await transaction`set local role offerlab_crawler`;
      const rows = await transaction<{ id: string }[]>`
        insert into app.company (name, slug, careers_url, source_type, crawl_allowed)
        values ('Synthetic Bank', 'synthetic-bank', 'https://synthetic-bank.example.com/careers', 'greenhouse', 'unknown')
        on conflict (slug) do update set crawl_allowed = excluded.crawl_allowed
        returning id
      `;
      return rows[0]!.id;
    });
    const consultancyId = await database.begin(async (transaction) => {
      await transaction`set local role offerlab_crawler`;
      const rows = await transaction<{ id: string }[]>`
        insert into app.company (name, slug, careers_url, source_type, crawl_allowed)
        values ('Synthetic Consultancy', 'synthetic-consultancy', 'https://synthetic-consultancy.example.com/careers', 'greenhouse', 'unknown')
        on conflict (slug) do update set crawl_allowed = excluded.crawl_allowed
        returning id
      `;
      return rows[0]!.id;
    });
    await database.begin(async (transaction) => {
      await transaction`set local role offerlab_crawler`;
      await transaction`
        insert into app.company (
          name, slug, careers_url, source_type, crawl_allowed,
          directory_sector_key, directory_priority_rank, directory_visible
        )
        values (
          'Synthetic Engineering', 'synthetic-engineering',
          'https://synthetic-engineering.example.com/careers', 'greenhouse', 'unknown',
          'engineering_energy_infrastructure', 499, true
        )
        on conflict (slug) do update set
          directory_sector_key = excluded.directory_sector_key,
          directory_priority_rank = excluded.directory_priority_rank,
          directory_visible = excluded.directory_visible
      `;
    });
    await database.begin(async (transaction) => {
      await transaction`set local role offerlab_crawler`;
      await transaction`
        insert into app.company (
          name, slug, careers_url, website_url, description, source_type, crawl_allowed,
          directory_sector_key, directory_priority_rank, directory_visible
        )
        values (
          'Synthetic Retailer', 'synthetic-retailer',
          'https://synthetic-retailer.example.com/careers', 'https://synthetic-retailer.example.com',
          'A synthetic retailer used only for automated SEO tests.', 'greenhouse', 'unknown',
          'consumer_fmcg_retail', 498, true
        )
        on conflict (slug) do update set
          description = excluded.description,
          website_url = excluded.website_url,
          directory_sector_key = excluded.directory_sector_key,
          directory_priority_rank = excluded.directory_priority_rank,
          directory_visible = excluded.directory_visible
      `;
    });
    const jobs = [
      {
        slug: "synthetic-bank-graduate-analyst",
        title: "Graduate Analyst",
        descriptionSummary: "A synthetic analyst role used only for automated SEO tests.",
        opportunityType: "graduate_scheme",
        sectorKey: "financial_services",
        subsectorKey: "retail_corporate_banking",
        eligibility: "eligible",
        publication: "published",
        active: true,
        deadline: null,
        firstSeenDaysAgo: 5,
      },
      {
        slug: "synthetic-bank-software-engineer",
        title: "Graduate Software Engineer",
        opportunityType: "graduate_job",
        sectorKey: "technology_it",
        subsectorKey: "software_development",
        eligibility: "eligible",
        publication: "published",
        active: true,
        deadline: null,
        descriptionSummary: null,
        firstSeenDaysAgo: 1,
      },
      {
        slug: "synthetic-bank-draft-intern",
        title: "Intern (draft - must never appear)",
        opportunityType: "internship",
        sectorKey: null,
        subsectorKey: null,
        eligibility: "needs_review",
        publication: "draft",
        active: true,
        deadline: null,
        descriptionSummary: null,
        firstSeenDaysAgo: 6,
      },
      {
        slug: "synthetic-consultancy-intern",
        title: "Consulting Intern",
        opportunityType: "internship",
        sectorKey: "consulting",
        subsectorKey: "management_consulting",
        eligibility: "eligible",
        publication: "published",
        active: true,
        deadline: null,
        descriptionSummary: null,
        firstSeenDaysAgo: 1,
      },
      {
        slug: "synthetic-bank-senior-director",
        title: "Senior Technology Director",
        opportunityType: "unknown",
        sectorKey: "technology_it",
        subsectorKey: "software_development",
        eligibility: "eligible",
        publication: "published",
        active: true,
        deadline: null,
        descriptionSummary: null,
        firstSeenDaysAgo: 2,
      },
      {
        slug: "synthetic-bank-thin-role",
        title: "Thin Role (title only)",
        opportunityType: "unknown",
        sectorKey: null,
        subsectorKey: null,
        eligibility: "eligible",
        publication: "published",
        active: true,
        deadline: null,
        descriptionSummary: null,
        firstSeenDaysAgo: 3,
      },
      {
        slug: "synthetic-bank-expired-role",
        title: "Expired Role (must never appear)",
        opportunityType: "graduate_job",
        sectorKey: "technology_it",
        subsectorKey: "software_development",
        eligibility: "eligible",
        publication: "published",
        active: true,
        deadline: "2000-01-01T00:00:00Z",
        descriptionSummary: null,
        firstSeenDaysAgo: 1,
      },
      {
        slug: "synthetic-bank-suppressed-role",
        title: "Suppressed Role (must never appear)",
        opportunityType: "graduate_job",
        sectorKey: "technology_it",
        subsectorKey: "software_development",
        eligibility: "eligible",
        publication: "suppressed",
        active: true,
        deadline: null,
        descriptionSummary: null,
        firstSeenDaysAgo: 1,
      },
      {
        slug: "synthetic-bank-ineligible-role",
        title: "Ineligible Role (must never appear)",
        opportunityType: "graduate_job",
        sectorKey: "technology_it",
        subsectorKey: "software_development",
        eligibility: "ineligible",
        publication: "published",
        active: true,
        deadline: null,
        descriptionSummary: null,
        firstSeenDaysAgo: 1,
      },
      {
        slug: "synthetic-bank-escaping-role",
        title: 'Graduate <script>alert("x")</script> Analyst',
        descriptionSummary: "A synthetic role used to verify safe structured-data escaping.",
        opportunityType: "graduate_job",
        sectorKey: "technology_it",
        subsectorKey: "software_development",
        eligibility: "eligible",
        publication: "published",
        active: true,
        deadline: null,
        firstSeenDaysAgo: 4,
      },
      {
        slug: "synthetic-consultancy-graduate-analyst",
        title: "Consultancy Graduate Scheme",
        opportunityType: "graduate_scheme",
        sectorKey: "financial_services",
        subsectorKey: "retail_corporate_banking",
        eligibility: "eligible",
        publication: "published",
        active: true,
        deadline: null,
        descriptionSummary: null,
        firstSeenDaysAgo: 2,
      },
    ];
    for (const job of jobs) {
      await database.begin(async (transaction) => {
        await transaction`set local role offerlab_crawler`;
        const owner = job.slug.startsWith("synthetic-consultancy") ? consultancyId : companyId;
        await transaction`
          insert into app.job (
            company_id, slug, application_url, title, content_hash,
            opportunity_type, sector_key, subsector_key,
            eligibility_status, publication_status, active,
            classification_source, classification_version,
            description_text, description_summary, posted_at, first_seen_at, last_seen_at,
            last_changed_at, application_deadline
          )
          values (
            ${owner}::uuid, ${job.slug}, ${`https://synthetic-bank.example.com/apply/${job.slug}`},
            ${job.title}, ${"f".repeat(64)}, ${job.opportunityType},
            ${job.sectorKey}, ${job.subsectorKey}, ${job.eligibility}, ${job.publication},
            ${job.active}, 'deterministic', 1,
            'A synthetic role used only for automated tests.',
            ${job.descriptionSummary ?? null},
            now() - make_interval(days => ${job.firstSeenDaysAgo}),
            now() - make_interval(days => ${job.firstSeenDaysAgo}),
            now() - make_interval(days => ${job.firstSeenDaysAgo}),
            now() - make_interval(days => ${job.firstSeenDaysAgo}),
            ${job.deadline}::timestamptz
          )
          on conflict (slug) do update set title = excluded.title
        `;
      });
    }
    const locatedJobs = [
      "synthetic-bank-graduate-analyst",
      "synthetic-consultancy-intern",
      "synthetic-consultancy-graduate-analyst",
    ];
    for (const slug of locatedJobs) {
      await database.begin(async (transaction) => {
        await transaction`set local role offerlab_crawler`;
        await transaction`
          insert into app.job_location (job_id, city, region, country, source_text, on_site, position)
          select id, 'London', 'London', 'United Kingdom', 'London', true, 0
          from app.job
          where slug = ${slug}
            and not exists (select 1 from app.job_location where job_id = app.job.id)
        `;
      });
    }
  } finally {
    await database.end();
  }
}

test.beforeAll(async () => {
  await seedCatalogue();
});

test("the enabled catalogue lists published roles across career levels", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "catalogue flows run once on chromium");
  const response = await page.goto("/jobs");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: /Find your next opportunity/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Graduate Analyst" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Graduate Software Engineer" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Senior Technology Director" })).toBeVisible();
  await expect(page.getByText("draft - must never appear")).toHaveCount(0);
});

test("retired sector routes lead into the combined employer directory", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "catalogue flows run once on chromium");
  await page.goto("/jobs/sectors/financial-services");
  await expect(page).toHaveURL(/\/employers\?sector=financial_services/);
  await expect(page.getByRole("heading", { name: /Explore UK employers/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Synthetic Bank" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Synthetic Engineering" })).toHaveCount(0);
  await page.getByRole("link", { name: "Synthetic Bank" }).click();
  await expect(page.getByRole("heading", { name: "Synthetic Bank" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Graduate Analyst" })).toBeVisible();
});

test("faceted filters update URL state, apply OR/AND rules and narrow results", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "catalogue flows run once on chromium");
  await page.goto("/jobs?sectors=technology-it");
  await expect(page).toHaveURL(/sectors=technology-it/);
  await expect(page.getByRole("link", { name: "Graduate Software Engineer" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Graduate Analyst" })).toHaveCount(0);

  // Add a second sector: OR within the facet widens results.
  await page
    .getByRole("button", { name: /Financial Services.*expand/i })
    .first()
    .click();
  await page
    .getByRole("button", { name: /^All Financial Services/ })
    .first()
    .click();
  await expect(page).toHaveURL(/financial-services/);
  await expect(page.getByRole("link", { name: "Graduate Analyst" })).toBeVisible();

  // Narrow with a job-type facet: AND across facets (Graduate job only).
  await page
    .locator(".catalogue-sidebar-column .catalogue-sidebar")
    .getByRole("button", { name: /Graduate job/i })
    .click();
  await expect(page).toHaveURL(/job_types=graduate-job/);
  await expect(page.getByRole("link", { name: "Graduate Software Engineer" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Graduate Analyst" })).toHaveCount(0);

  // Remove the job-type facet via the active-filter chip (not the quick chip).
  await page
    .locator(".catalogue-active-chips")
    .getByRole("button", { name: /graduate job/i })
    .first()
    .click();
  await expect(page).not.toHaveURL(/job_types/);
  await expect(page.getByRole("link", { name: "Graduate Analyst" })).toBeVisible();
});

test("keyword search combines with facets via the URL", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "catalogue flows run once on chromium");
  await page.goto("/jobs?sectors=technology-it&q=engineer");
  await expect(page.getByRole("link", { name: "Graduate Software Engineer" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Graduate Analyst" })).toHaveCount(0);
});

test("clear all resets the filter state", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "catalogue flows run once on chromium");
  await page.goto("/jobs?sectors=technology-it&q=engineer");
  await page.getByRole("button", { name: "Clear all" }).first().click();
  await expect(page).toHaveURL(/\/jobs$/);
  await expect(page.getByRole("link", { name: "Graduate Analyst" })).toBeVisible();
});

test("filter reset controls do not shift the sidebar when a sector is selected", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "desktop filter geometry runs once");
  await page.goto("/jobs");
  await expect(page.getByRole("link", { name: "Graduate Analyst" })).toBeVisible();
  const desktopSidebar = page.locator(".catalogue-sidebar-column .catalogue-sidebar");
  const sectorHeading = desktopSidebar.locator("#facet-sectors");
  const clearAll = desktopSidebar.locator(".catalogue-sidebar-header .catalogue-facet-clear");
  const rect = (locator: typeof desktopSidebar) =>
    locator.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return { height: box.height, width: box.width, x: box.x, y: box.y };
    });
  const beforeSector = await rect(sectorHeading);
  const beforeClear = await rect(clearAll);

  await desktopSidebar
    .getByRole("button", { name: /Technology & IT Infrastructure.*expand/i })
    .first()
    .click();
  await desktopSidebar.getByRole("button", { name: /^All Technology & IT Infrastructure/ }).click();
  await expect(page).toHaveURL(/technology-it/);

  const afterSector = await rect(sectorHeading);
  const afterClear = await rect(clearAll);
  expect(afterSector.y - afterClear.y - (beforeSector.y - beforeClear.y)).toBeCloseTo(0, 0);
});

test("the employer directory shows employers with active counts", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "catalogue flows run once on chromium");
  await page.goto("/employers");
  await expect(page.getByRole("heading", { name: /Explore UK employers/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Synthetic Engineering" })).toBeVisible();
  await expect(page.getByText("No current OfferLab roles")).toBeVisible();
  await expect(page.getByRole("link", { name: "Synthetic Bank" })).toBeVisible();
  await page.getByRole("link", { name: "Synthetic Bank" }).click();
  await expect(page.getByRole("heading", { name: "Synthetic Bank" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Graduate Analyst" })).toBeVisible();
});

test("the mobile filter drawer opens and applies filters", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "mobile drawer runs once");
  await page.goto("/jobs");
  await page.getByRole("button", { name: /Filters/ }).click();
  const drawer = page.getByRole("dialog");
  await drawer.getByRole("button", { name: /Financial Services.*expand/i }).click();
  await drawer.getByRole("button", { name: /^All Financial Services/ }).click();
  await expect(page).toHaveURL(/financial-services/);
  await page.getByRole("button", { name: /Show \d+ jobs/ }).click();
  await expect(page.getByRole("link", { name: "Graduate Analyst" })).toBeVisible();
});

test("the job detail page shows source facts and the official apply link", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "catalogue flows run once on chromium");
  await page.goto("/jobs/synthetic-bank-graduate-analyst");
  await expect(page.getByRole("heading", { name: "Graduate Analyst" })).toBeVisible();
  await expect(page.getByText(/Source: Synthetic Bank Careers/i).first()).toBeVisible();
  const applyLink = page.getByRole("link", { name: /Apply on employer website/i }).first();
  await expect(applyLink).toBeVisible();
  expect(await applyLink.getAttribute("href")).toContain("synthetic-bank.example.com");
  await expect(page.getByText(/not the employer/i)).toBeVisible();
});

test("draft and needs-review roles are never publicly reachable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "catalogue flows run once on chromium");
  const response = await page.goto("/jobs/synthetic-bank-draft-intern");
  expect(response?.status()).toBe(404);
});

test("anonymous members get a sign-in redirect when saving a role", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "catalogue flows run once on chromium");
  await page.goto("/jobs/synthetic-bank-graduate-analyst");
  await page.getByRole("button", { name: "Save role" }).click();
  await page.waitForURL(/\/sign-in/);
});

test("the catalogue has no horizontal overflow on mobile", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "responsive check runs once");
  await page.goto("/jobs");
  await expect(page.getByRole("main").last()).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    ),
  ).toBe(false);
});

test("the employer directory has no horizontal overflow on mobile", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "mobile overflow runs once");
  await page.goto("/employers");
  await expect(page.getByRole("heading", { name: "Explore employers" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    ),
  ).toBe(false);
});

test("the sitemap lists eligible employers and excludes blank profiles", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "catalogue flows run once on chromium");
  const response = await page.goto("/sitemap.xml");
  expect(response?.status()).toBe(200);
  const body = (await response?.text()) ?? "";
  expect(body).toContain("/employers/synthetic-bank");
  expect(body).toContain("/employers/synthetic-consultancy");
  expect(body).toContain("/employers/synthetic-retailer");
  expect(body).not.toContain("/employers/synthetic-engineering");
});

test("an eligible employer page has canonical metadata and safe Organization and Breadcrumb JSON-LD", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "catalogue flows run once on chromium");
  await page.goto("/employers/synthetic-bank");
  await expect(page.getByRole("heading", { name: "Synthetic Bank" })).toBeVisible();
  const canonical = page.locator('link[rel="canonical"]');
  await expect(canonical).toHaveAttribute("href", /\/employers\/synthetic-bank$/);
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  const script = page.locator('script[type="application/ld+json"]');
  await expect(script).toHaveCount(1);
  const content = (await script.first().textContent()) ?? "";
  expect(content).not.toContain("<");
  const structured = JSON.parse(content) as Array<Record<string, unknown>>;
  const organization = structured.find((node) => node["@type"] === "Organization")!;
  expect(organization.name).toBe("Synthetic Bank");
  const breadcrumb = structured.find((node) => node["@type"] === "BreadcrumbList")!;
  const items = breadcrumb.itemListElement as Array<{ name: string; position: number }>;
  expect(items.map((item) => item.name)).toEqual(["Employers", "Synthetic Bank"]);

  const roleListColumns = await page
    .locator(".employer-profile-jobs .public-jobs-results")
    .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
  expect(roleListColumns).toBe(1);

  const firstRoleColumns = await page
    .locator(".employer-profile-jobs .job-card")
    .first()
    .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
  expect(firstRoleColumns).toBe(3);
});

test("a permanent qualifying employer stays indexable with zero current roles", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "catalogue flows run once on chromium");
  await page.goto("/employers/synthetic-retailer");
  await expect(page.getByRole("heading", { name: "Synthetic Retailer" })).toBeVisible();
  await expect(page.getByText(/has no roles currently listed/i)).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/employers\/synthetic-retailer$/,
  );
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
});

test("a blank employer profile stays usable but is noindex", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "catalogue flows run once on chromium");
  await page.goto("/employers/synthetic-engineering");
  await expect(page.getByRole("heading", { name: "Synthetic Engineering" })).toBeVisible();
  await expect(page.getByText(/has no roles currently listed/i)).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/employers\/synthetic-engineering$/,
  );
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
});

test("a missing employer profile is not indexable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "catalogue flows run once on chromium");
  const response = await page.goto("/employers/not-a-real-employer");
  expect(response?.status()).toBe(404);
  const robotContents = await page
    .locator('meta[name="robots"]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("content") ?? ""));
  expect(robotContents.length).toBeGreaterThan(0);
  expect(robotContents.every((content) => content.includes("noindex"))).toBe(true);
});

test("filtered employer-directory URLs are noindex but follow", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "catalogue flows run once on chromium");
  await page.goto("/employers?sector=financial_services");
  await expect(page.getByRole("heading", { name: /Explore UK employers/i })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex,\s*follow/);
});

test("the job detail page visibly links to the OfferLab employer profile", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "catalogue flows run once on chromium");
  await page.goto("/jobs/synthetic-bank-graduate-analyst");
  const profileLink = page.getByRole("link", {
    name: /Synthetic Bank employer profile on OfferLab/i,
  });
  await expect(profileLink).toBeVisible();
  expect(await profileLink.getAttribute("href")).toContain("/employers/synthetic-bank");
  await profileLink.click();
  await expect(page).toHaveURL(/\/employers\/synthetic-bank$/);
});

test("the employer profile has no horizontal overflow on mobile", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "responsive check runs once");
  await page.goto("/employers/synthetic-bank");
  await expect(page.getByRole("heading", { name: "Synthetic Bank" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    ),
  ).toBe(false);
});

test("an indexable job page emits one canonical, no robots meta and valid JobPosting and Breadcrumb JSON-LD", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "catalogue flows run once on chromium");
  await page.goto("/jobs/synthetic-bank-graduate-analyst");
  await expect(page.getByRole("heading", { name: "Graduate Analyst" })).toBeVisible();

  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  const canonical = page.locator('link[rel="canonical"]');
  await expect(canonical).toHaveCount(1);
  await expect(canonical).toHaveAttribute("href", /\/jobs\/synthetic-bank-graduate-analyst$/);

  const description = page.locator('meta[name="description"]');
  await expect(description).toHaveCount(1);
  const descriptionLength = (await description.getAttribute("content"))?.length ?? 0;
  expect(descriptionLength).toBeGreaterThan(0);
  expect(descriptionLength).toBeLessThanOrEqual(160);

  const script = page.locator('script[type="application/ld+json"]');
  await expect(script).toHaveCount(1);
  const content = (await script.first().textContent()) ?? "";
  expect(content).not.toContain("<");
  const structured = JSON.parse(content) as Array<Record<string, unknown>>;
  const jobPosting = structured.find((node) => node["@type"] === "JobPosting")!;
  expect(jobPosting.title).toBe("Graduate Analyst");
  expect(jobPosting.datePosted).toBeTruthy();
  expect(jobPosting.description).toBeTruthy();
  expect(jobPosting.description).not.toBe(jobPosting.title);
  await expect(
    page.getByText("A synthetic analyst role used only for automated SEO tests."),
  ).toBeVisible();
  const organization = jobPosting.hiringOrganization as Record<string, unknown>;
  expect(organization.name).toBe("Synthetic Bank");
  const location = jobPosting.jobLocation as { address: Record<string, string> };
  expect(location.address.addressLocality).toBe("London");
  expect(jobPosting.url).toContain("/jobs/synthetic-bank-graduate-analyst");
  const identifier = jobPosting.identifier as { value: string };
  expect(identifier.value).toBe("synthetic-bank-graduate-analyst");
  const breadcrumb = structured.find((node) => node["@type"] === "BreadcrumbList")!;
  const items = breadcrumb.itemListElement as Array<{ name: string }>;
  expect(items.map((item) => item.name)).toEqual(["Jobs", "Graduate Analyst"]);
});

test("a thin public job page renders but is noindex, follow with no structured data", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "catalogue flows run once on chromium");
  const response = await page.goto("/jobs/synthetic-bank-thin-role");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Thin Role (title only)" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex,\s*follow/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/jobs\/synthetic-bank-thin-role$/,
  );
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
});

test("expired, suppressed and ineligible roles are never publicly reachable", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "catalogue flows run once on chromium");
  for (const slug of [
    "synthetic-bank-expired-role",
    "synthetic-bank-suppressed-role",
    "synthetic-bank-ineligible-role",
  ]) {
    const response = await page.goto(`/jobs/${slug}`);
    expect(response?.status()).toBe(404);
    const robotContents = await page
      .locator('meta[name="robots"]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("content") ?? ""));
    expect(robotContents.length).toBeGreaterThan(0);
    expect(robotContents.every((content) => content.includes("noindex"))).toBe(true);
  }
});

test("a missing job page is not indexable and leaks no role details", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "catalogue flows run once on chromium");
  const response = await page.goto("/jobs/not-a-real-role");
  expect(response?.status()).toBe(404);
  const robotContents = await page
    .locator('meta[name="robots"]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("content") ?? ""));
  expect(robotContents.length).toBeGreaterThan(0);
  expect(robotContents.every((content) => content.includes("noindex"))).toBe(true);
});

test("the job detail page shows related current roles without duplicates or non-public roles", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "catalogue flows run once on chromium");
  await page.goto("/jobs/synthetic-bank-graduate-analyst");

  const employerSection = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: /More roles at Synthetic Bank/ }) });
  await expect(employerSection).toHaveCount(1);
  await expect(
    employerSection.getByRole("link", { name: "Graduate Software Engineer" }),
  ).toBeVisible();
  expect(await employerSection.locator(".job-card").count()).toBeLessThanOrEqual(3);

  const similarSection = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Similar current roles" }) });
  await expect(similarSection).toHaveCount(1);
  await expect(
    similarSection.getByRole("link", { name: "Consultancy Graduate Scheme" }),
  ).toBeVisible();
  await expect(similarSection.getByRole("link", { name: "Consulting Intern" })).toBeVisible();
  expect(await similarSection.locator(".job-card").count()).toBeLessThanOrEqual(3);

  const employerLinks = new Set(
    await employerSection
      .locator('a[href^="/jobs/"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute("href"))),
  );
  const similarLinks = new Set(
    await similarSection
      .locator('a[href^="/jobs/"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute("href"))),
  );
  for (const href of similarLinks) expect(employerLinks.has(href)).toBe(false);
  for (const slug of [
    "synthetic-bank-draft-intern",
    "synthetic-bank-expired-role",
    "synthetic-bank-suppressed-role",
    "synthetic-bank-ineligible-role",
  ]) {
    expect([...employerLinks, ...similarLinks].some((href) => href?.includes(slug))).toBe(false);
  }
});

test("script-breaking role titles stay safely escaped in JSON-LD and visible text", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "catalogue flows run once on chromium");
  const title = 'Graduate <script>alert("x")</script> Analyst';
  await page.goto("/jobs/synthetic-bank-escaping-role");
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  const content =
    (await page.locator('script[type="application/ld+json"]').first().textContent()) ?? "";
  expect(content).not.toContain("<");
  expect(content).toContain("\\u003c");
});

test("the sitemap lists only indexable job pages", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "catalogue flows run once on chromium");
  const response = await page.goto("/sitemap.xml");
  expect(response?.status()).toBe(200);
  const body = (await response?.text()) ?? "";
  expect(body).toContain("/jobs/synthetic-bank-graduate-analyst");
  expect(body).toContain("/jobs/synthetic-bank-escaping-role");
  for (const slug of [
    "synthetic-bank-thin-role",
    "synthetic-bank-software-engineer",
    "synthetic-bank-senior-director",
    "synthetic-bank-draft-intern",
    "synthetic-bank-expired-role",
    "synthetic-bank-suppressed-role",
    "synthetic-bank-ineligible-role",
  ]) {
    expect(body).not.toContain(`/jobs/${slug}`);
  }
});

test("the official application link stays external with nofollow and opens in a new tab", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "catalogue flows run once on chromium");
  await page.goto("/jobs/synthetic-bank-graduate-analyst");
  const applyLink = page.getByRole("link", { name: /Apply on employer website/i }).first();
  expect(await applyLink.getAttribute("href")).toMatch(/^https:\/\//);
  expect(await applyLink.getAttribute("href")).not.toContain("offerlab");
  expect(await applyLink.getAttribute("rel")).toContain("nofollow");
  expect(await applyLink.getAttribute("rel")).toContain("noopener");
  expect(await applyLink.getAttribute("target")).toBe("_blank");
});

test("the job detail page has no horizontal overflow on mobile", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "responsive check runs once");
  await page.goto("/jobs/synthetic-bank-graduate-analyst");
  await expect(page.getByRole("heading", { name: "Graduate Analyst" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    ),
  ).toBe(false);
});

test("the job detail page has no horizontal overflow on desktop", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "desktop overflow check runs once");
  await page.goto("/jobs/synthetic-bank-graduate-analyst");
  await expect(page.getByRole("heading", { name: "Graduate Analyst" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    ),
  ).toBe(false);
});
