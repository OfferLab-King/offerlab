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
    const jobs = [
      {
        slug: "synthetic-bank-graduate-analyst",
        title: "Graduate Analyst",
        opportunityType: "graduate_scheme",
        sectorKey: "financial_services",
        subsectorKey: "retail_corporate_banking",
        eligibility: "eligible",
        publication: "published",
        active: true,
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
            description_text, first_seen_at, last_seen_at, last_changed_at
          )
          values (
            ${owner}::uuid, ${job.slug}, ${`https://synthetic-bank.example.com/apply/${job.slug}`},
            ${job.title}, ${"f".repeat(64)}, ${job.opportunityType},
            ${job.sectorKey}, ${job.subsectorKey}, ${job.eligibility}, ${job.publication},
            ${job.active}, 'deterministic', 1,
            'A synthetic role used only for automated tests.',
            now() - interval '1 day', now() - interval '1 day', now() - interval '1 day'
          )
          on conflict (slug) do update set title = excluded.title
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
  await expect(page.getByRole("heading", { name: /Explore employers by sector/i })).toBeVisible();
  const financialServices = page.locator("#sector-financial_services");
  await expect(financialServices.getByRole("link", { name: /Synthetic Bank/ })).toBeVisible();
  await financialServices.getByRole("link", { name: /All current roles/ }).click();
  await expect(page).toHaveURL(/\/jobs\?sectors=financial-services/);
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
  await expect(page.getByRole("heading", { name: /Explore employers/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Synthetic Engineering" })).toBeVisible();
  await expect(
    page.locator("#sector-engineering_energy_infrastructure").getByText("No current roles"),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Synthetic Bank/ }).first()).toBeVisible();
  await page
    .getByRole("link", { name: /Synthetic Bank/ })
    .first()
    .click();
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
