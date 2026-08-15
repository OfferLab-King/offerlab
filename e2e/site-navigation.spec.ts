import { expect, test } from "@playwright/test";
import postgres from "postgres";

/**
 * Shared navigation and homepage discovery. Runs only when
 * JOB_CATALOG_ENABLED=true is set for the e2e server, because the
 * signed-in-vs-signed-out and Jobs/Employers active-state journeys need the
 * live catalogue routes.
 */
test.skip(
  process.env.JOB_CATALOG_ENABLED !== "true",
  "requires JOB_CATALOG_ENABLED=true for the e2e server",
);

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const password = "StrongPassword123!";

async function createMember(email: string): Promise<{ authId: string; ownerId: string }> {
  const database = postgres(databaseUrl, { prepare: false });
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Supabase configuration missing");
    const signup = await fetch(`${url}/auth/v1/signup`, {
      body: JSON.stringify({ email, password }),
      headers: { apikey: key, "content-type": "application/json" },
      method: "POST",
    });
    const signupBody = (await signup.json()) as { id?: string; message?: string };
    if (!signup.ok || !signupBody.id) {
      throw new Error(
        `Could not create the local test member: ${signupBody.message ?? signup.status}`,
      );
    }
    const authId = signupBody.id;
    await database`update auth.users set email_confirmed_at=now(),updated_at=now() where id=${authId}::uuid`;
    const ownerId = (
      await database<
        { id: string }[]
      >`insert into app."user"(auth_user_id,email) values(${authId}::uuid,${email}) returning id`
    )[0]!.id;
    await database`insert into app.beta_entitlement(user_id,status,activated_at,updated_at) values(${ownerId}::uuid,'active',now(),now())`;
    await database`insert into app.onboarding_profile(user_id,education_stage,opportunity_types,industries,preparation_priorities,completed_at) values(${ownerId}::uuid,'recent_graduate',array['graduate_scheme'],array['technology'],array['application_cv'],now())`;
    return { authId, ownerId };
  } finally {
    await database.end();
  }
}

test("the signed-out public navigation lists Jobs, Employers and account actions", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Prepare with evidence/i })).toBeVisible();

  const navigation = page.getByRole("navigation", { name: "Public navigation" });
  await expect(navigation.getByRole("link", { name: "Jobs" })).toHaveAttribute("href", "/jobs");
  await expect(navigation.getByRole("link", { name: "Employers" })).toHaveAttribute(
    "href",
    "/employers",
  );
  await expect(navigation.getByRole("link", { name: "Recruitment Intelligence" })).toHaveAttribute(
    "href",
    "/intelligence",
  );

  const brand = page.getByRole("link", { name: "OfferLab" }).first();
  await expect(brand).toHaveAttribute("href", "/");
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toHaveAttribute(
    "href",
    "/sign-in",
  );
  await expect(page.getByRole("link", { name: "Create free account" })).toHaveAttribute(
    "href",
    "/register",
  );
  await expect(page.getByRole("button", { name: /sign out/i })).toHaveCount(0);
});

test("the homepage communicates the job-discovery journey", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Discover a real role, then prepare/i }),
  ).toBeVisible();
  await expect(page.getByText(/official public career sources/i)).toBeVisible();
  await expect(page.getByText(/employer's official website/i)).toBeVisible();

  const searchForm = page.locator('form[action="/jobs"][method="get"]');
  await expect(searchForm).toBeVisible();
  await searchForm.getByLabel("Search current roles").fill("graduate analyst");
  await searchForm.getByRole("button", { name: "Search jobs" }).click();
  await expect(page).toHaveURL(/\/jobs\?q=graduate\+analyst/);
  await expect(
    page.getByRole("heading", { name: /Find your next opportunity/i }).first(),
  ).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("link", { name: /Explore employers by sector/ })).toHaveAttribute(
    "href",
    "/employers",
  );
  await expect(page.getByText(/save the role, tailor a truthful CV/i)).toBeVisible();
});

test("the signed-in member navigation is available on the member home", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  test.setTimeout(120_000);
  const database = postgres(databaseUrl, { prepare: false });
  const suffix = `${testInfo.project.name}-${Date.now()}`.replaceAll(/[^a-z0-9-]/g, "-");
  const email = `site-navigation-${suffix}@example.com`;
  let authId = "";
  let ownerId = "";

  try {
    ({ authId, ownerId } = await createMember(email));

    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/member$/);

    const navigation = page.getByRole("navigation", { name: "Member navigation" });
    await expect(navigation.getByRole("link")).toHaveCount(9);
    await expect(navigation.getByRole("link", { name: "Home" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    for (const label of [
      "Jobs",
      "Employers",
      "Applications",
      "CVs",
      "Cover letters",
      "Prepare",
      "Membership",
      "Profile",
    ]) {
      await expect(navigation.getByRole("link", { name: label })).not.toHaveAttribute(
        "aria-current",
        "page",
      );
    }

    const brand = page.getByRole("link", { name: "OfferLab" }).first();
    await expect(brand).toHaveAttribute("href", "/member");
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in", exact: true })).toHaveCount(0);
  } finally {
    await cleanupMember(database, ownerId, authId);
  }
});

test("signed-in members keep the workspace navigation while visiting /jobs", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  test.setTimeout(120_000);
  const database = postgres(databaseUrl, { prepare: false });
  const suffix = `${testInfo.project.name}-${Date.now()}`.replaceAll(/[^a-z0-9-]/g, "-");
  const email = `site-navigation-jobs-${suffix}@example.com`;
  let authId = "";
  let ownerId = "";

  try {
    ({ authId, ownerId } = await createMember(email));

    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/member$/);

    await page.goto("/jobs");
    await expect(
      page.getByRole("heading", { name: /Find your next opportunity/i }).first(),
    ).toBeVisible();

    const navigation = page.getByRole("navigation", { name: "Member navigation" });
    await expect(navigation.getByRole("link", { name: "Jobs" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(navigation.getByRole("link", { name: "Employers" })).toBeVisible();
    const brand = page.getByRole("link", { name: "OfferLab" }).first();
    await expect(brand).toHaveAttribute("href", "/member");
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in", exact: true })).toHaveCount(0);
  } finally {
    await cleanupMember(database, ownerId, authId);
  }
});

test("signed-in members keep the workspace navigation while visiting /employers", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  test.setTimeout(120_000);
  const database = postgres(databaseUrl, { prepare: false });
  const suffix = `${testInfo.project.name}-${Date.now()}`.replaceAll(/[^a-z0-9-]/g, "-");
  const email = `site-navigation-employers-${suffix}@example.com`;
  let authId = "";
  let ownerId = "";

  try {
    ({ authId, ownerId } = await createMember(email));

    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/member$/);

    await page.goto("/employers");
    await expect(page.getByRole("heading", { name: /Explore UK employers/i })).toBeVisible();

    const navigation = page.getByRole("navigation", { name: "Member navigation" });
    await expect(navigation.getByRole("link", { name: "Employers" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(navigation.getByRole("link", { name: "Jobs" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in", exact: true })).toHaveCount(0);
  } finally {
    await cleanupMember(database, ownerId, authId);
  }
});

test("the public navigation becomes current on /jobs and /employers", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/jobs");
  await expect(
    page.getByRole("heading", { name: /Find your next opportunity/i }).first(),
  ).toBeVisible();
  const jobsNav = page.getByRole("navigation", { name: "Public navigation" });
  await expect(jobsNav.getByRole("link", { name: "Jobs" })).toHaveAttribute("aria-current", "page");
  await expect(jobsNav.getByRole("link", { name: "Employers" })).not.toHaveAttribute(
    "aria-current",
    "page",
  );

  await page.goto("/employers");
  await expect(page.getByRole("heading", { name: /Explore UK employers/i })).toBeVisible();
  const employersNav = page.getByRole("navigation", { name: "Public navigation" });
  await expect(employersNav.getByRole("link", { name: "Employers" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(employersNav.getByRole("link", { name: "Jobs" })).not.toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("the responsive menu is keyboard accessible, navigates and avoids overflow", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "responsive menu runs once");
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/jobs");
  await expect(
    page.getByRole("heading", { name: /Find your next opportunity/i }).first(),
  ).toBeVisible();
  await page.waitForLoadState("networkidle");

  const navigation = page.getByRole("navigation", { name: "Public navigation" });
  const toggle = navigation.getByRole("button", { name: /Menu|Close/ });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toHaveAttribute("aria-controls", /.+/);
  await expect(navigation.getByRole("link", { name: "Jobs" })).toBeHidden();

  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const jobsLink = navigation.getByRole("link", { name: "Jobs" });
  await expect(jobsLink).toBeVisible();
  await expect(jobsLink).toBeFocused();
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    ),
  ).toBe(false);

  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toBeFocused();
  await expect(jobsLink).toBeHidden();

  await toggle.click();
  await navigation.getByRole("link", { name: "Employers" }).click();
  await expect(page).toHaveURL(/\/employers$/);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    ),
  ).toBe(false);
});

async function cleanupMember(
  database: postgres.Sql,
  ownerId: string,
  authId: string,
): Promise<void> {
  try {
    if (ownerId) {
      await database`delete from app.audit_event where actor_user_id=${ownerId}::uuid`;
      await database`delete from app.onboarding_profile where user_id=${ownerId}::uuid`;
      await database`delete from app.beta_entitlement where user_id=${ownerId}::uuid`;
      await database`delete from app."user" where id=${ownerId}::uuid`;
    }
    if (authId) await database`delete from auth.users where id=${authId}::uuid`;
  } finally {
    await database.end();
  }
}
