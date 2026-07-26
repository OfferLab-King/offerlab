import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import postgres from "postgres";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const password = "StrongPassword123!";

test("administrator manages taxonomy and a resource lifecycle", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const database = postgres(databaseUrl, { max: 2, prepare: false });
  const suffix = `${testInfo.project.name.replaceAll(/\W/g, "-")}-${Date.now()}`;
  const email = `content-admin-${suffix}@example.com`,
    categoryName = `E2E category ${suffix}`,
    tagName = `E2E tag ${suffix}`,
    resourceTitle = `E2E resource ${suffix}`;
  const categorySlug = `e2e-category-${Date.now()}`,
    tagSlug = `e2e-tag-${Date.now()}`,
    resourceSlug = `e2e-resource-${Date.now()}`;
  let authId: string | undefined,
    categoryId: string | undefined,
    ownerId: string | undefined,
    resourceId: string | undefined,
    tagId: string | undefined;
  const adminRoutes = [
    "/admin",
    "/admin/content",
    "/admin/content?type=coaching_case",
    "/admin/content/paths",
    "/admin/content/categories",
    "/admin/content/tags",
    "/admin/operations",
  ] as const;
  const submitAndInspectConflict = async (
    button: ReturnType<typeof page.getByRole>,
    prohibited: readonly string[],
  ) => {
    const responsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" && response.url().includes("/admin/content"),
    );
    await button.click();
    const response = await responsePromise;
    let body = "";
    try {
      body = await response.text();
    } catch (error) {
      expect(String(error)).toContain("Response body is unavailable for redirect responses");
    }
    const inspected = `${JSON.stringify(response.headers())}\n${body}`;
    expect(inspected).toContain("conflict");
    for (const value of prohibited) expect(inspected).not.toContain(value);
    expect(inspected).not.toMatch(
      /currentVersion|markdownBody|shortDescription|relatedResourceIds|"version"/iu,
    );
    return inspected;
  };
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
      key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Supabase E2E configuration missing.");
    const client = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const signup = await client.auth.signUp({ email, password });
    expect(signup.error).toBeNull();
    authId = signup.data.user?.id;
    if (!authId) throw new Error("Auth user missing.");
    await database`update auth.users set email_confirmed_at=now(),updated_at=now() where id=${authId}::uuid`;
    const owners = await database<
      { id: string }[]
    >`insert into app."user"(auth_user_id,email,role) values(${authId}::uuid,${email},'administrator') returning id`;
    ownerId = owners[0]?.id;
    if (!ownerId) throw new Error("Owner missing.");
    await database`insert into app.beta_entitlement(user_id,status,activated_at,updated_at) values(${ownerId}::uuid,'active',now(),now())`;
    await database`insert into app.onboarding_profile(user_id,education_stage,opportunity_types,industries,preparation_priorities,completed_at) values(${ownerId}::uuid,'recent_graduate',array['graduate_scheme'],array['consulting'],array['application_cv'],now())`;
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/(?:admin|member)$/);

    await page.setViewportSize({ width: 950, height: 800 });
    for (const route of adminRoutes) {
      await page.goto(route);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        ),
        `${route} must not create page-level horizontal overflow`,
      ).toBe(false);
      await expect(page.locator("main")).toHaveCount(1);
    }

    await expect(
      page
        .getByRole("navigation", { name: "Content management" })
        .getByRole("link", { name: "Operations" }),
    ).toHaveAttribute("aria-current", "page");
    const offeringForm = page.locator(".cms-operation-form").first();
    const availabilityBox = await offeringForm.getByLabel("Availability").boundingBox();
    const updateAvailabilityBox = await offeringForm
      .getByRole("button", { name: "Update availability" })
      .boundingBox();
    if (!availabilityBox || !updateAvailabilityBox) {
      throw new Error("Operations availability controls missing.");
    }
    const availabilityControlsOverlap =
      availabilityBox.x < updateAvailabilityBox.x + updateAvailabilityBox.width &&
      availabilityBox.x + availabilityBox.width > updateAvailabilityBox.x &&
      availabilityBox.y < updateAvailabilityBox.y + updateAvailabilityBox.height &&
      availabilityBox.y + availabilityBox.height > updateAvailabilityBox.y;
    expect(availabilityControlsOverlap).toBe(false);

    await page.goto("/admin/content?type=coaching_case");
    await expect(
      page
        .getByRole("navigation", { name: "Content management" })
        .getByRole("link", { name: "Coaching cases" }),
    ).toHaveAttribute("aria-current", "page");
    const typeBox = await page.getByLabel("Type").boundingBox();
    const filterButtonBox = await page
      .getByRole("button", { name: "Apply filters", exact: true })
      .boundingBox();
    if (!typeBox || !filterButtonBox) throw new Error("CMS filter controls missing.");
    const filtersOverlap =
      typeBox.x < filterButtonBox.x + filterButtonBox.width &&
      typeBox.x + typeBox.width > filterButtonBox.x &&
      typeBox.y < filterButtonBox.y + filterButtonBox.height &&
      typeBox.y + typeBox.height > filterButtonBox.y;
    expect(filtersOverlap).toBe(false);
    const coachingFooterTop = await page
      .locator(".cms-sidebar-footer")
      .evaluate((element) => Math.round(element.getBoundingClientRect().top));
    await page.goto("/admin/content/paths");
    await expect(
      page
        .getByRole("navigation", { name: "Content management" })
        .getByRole("link", { name: "Preparation paths" }),
    ).toHaveAttribute("aria-current", "page");
    const pathsFooterTop = await page
      .locator(".cms-sidebar-footer")
      .evaluate((element) => Math.round(element.getBoundingClientRect().top));
    expect(pathsFooterTop).toBe(coachingFooterTop);

    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of adminRoutes) {
      await page.goto(route);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        ),
        `${route} must fit a 390px viewport`,
      ).toBe(false);
    }
    await page.setViewportSize({ width: 950, height: 800 });

    await page.goto("/admin/content/categories");
    const categoryCreate = page
      .locator("form")
      .filter({ has: page.getByRole("heading", { name: "Create category" }) });
    await categoryCreate.getByLabel("Name").fill(categoryName);
    await categoryCreate.getByLabel("Slug").fill(categorySlug);
    await categoryCreate.getByLabel("Description").fill("Synthetic browser fixture.");
    await categoryCreate.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("status")).toContainText("created");
    categoryId = (
      await database<
        { id: string }[]
      >`select id from app.content_category where slug=${categorySlug}`
    )[0]?.id;
    await page.goto("/admin/content/tags");
    const tagCreate = page
      .locator("form")
      .filter({ has: page.getByRole("heading", { name: "Create tag" }) });
    await tagCreate.getByLabel("Name").fill(tagName);
    await tagCreate.getByLabel("Slug").fill(tagSlug);
    await tagCreate.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("status")).toContainText("created");
    tagId = (
      await database<{ id: string }[]>`select id from app.content_tag where slug=${tagSlug}`
    )[0]?.id;

    await page.goto("/admin/content/new");
    const editor = page.locator("form.application-form");
    await editor.getByLabel("Title (required to publish)").fill(resourceTitle);
    await editor.getByLabel("Slug (required)").fill(resourceSlug);
    await editor
      .getByLabel("Short description (required to publish)")
      .fill("Browser-tested summary.");
    const summaryField = await editor
      .getByLabel("Short description (required to publish)")
      .boundingBox();
    expect(summaryField?.height).toBeLessThanOrEqual(100);
    await editor.getByLabel("Primary category").selectOption({ label: categoryName });
    await editor.getByLabel("Markdown body").fill("## Browser-tested body\n\n- safe item");
    await editor.getByLabel("Slug (required)").press("Enter");
    await page.waitForURL(/\/admin\/content\/[0-9a-f-]+$/);
    resourceId = page.url().split("/").at(-1);
    if (!categoryId || !resourceId || !tagId) throw new Error("Created CMS identifier missing.");
    const tagChoice = await page.getByLabel(tagName).locator("..").boundingBox();
    expect(tagChoice?.height).toBeLessThanOrEqual(60);
    await page.getByLabel(tagName).check();
    await page.getByRole("checkbox", { name: "video interview", exact: true }).check();
    await page.getByRole("checkbox", { name: "graduate scheme", exact: true }).check();
    await page.getByText("Related content and links", { exact: true }).click();
    await page.getByRole("button", { name: "Add link" }).click();
    await page.getByLabel("Link 1 label").fill("Example");
    await page.getByLabel("Link 1 URL").fill("https://example.com/guide");
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText("Resource updated.")).toBeVisible();
    await expect(page.getByText(/Content editor · published/)).toBeVisible();
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(page.getByText("No changes were needed.")).toBeVisible();
    const resourceTimestamps = await database<
      { createdAt: Date; firstPublishedAt: Date; publishedAt: Date; updatedAt: Date }[]
    >`select created_at "createdAt",first_published_at "firstPublishedAt",published_at "publishedAt",updated_at "updatedAt" from app.preparation_resource where id=${resourceId}::uuid`;
    const prohibitedInfrastructure = [
      databaseUrl,
      "offerlab_runtime_login",
      "app.audit_event",
      "app.preparation_resource",
    ];
    const prohibitedTimestamps = Object.values(resourceTimestamps[0]!).map((value) =>
      value.toISOString(),
    );

    const resourceAuditsBefore = await database<
      { count: number }[]
    >`select count(*)::int count from app.audit_event where entity_id=${resourceId}::uuid`;
    const serverTitle = `SERVER_RESOURCE_TITLE_${suffix}`;
    const attemptedTitle = `ATTEMPTED_RESOURCE_TITLE_${suffix}`;
    await database`update app.preparation_resource set title=${serverTitle},version=version+1 where id=${resourceId}::uuid`;
    await page.locator('input[name="expectedVersion"]').evaluate((input: HTMLInputElement) => {
      input.value = "0";
    });
    await editor.getByLabel("Title (required to publish)").fill(attemptedTitle);
    await submitAndInspectConflict(
      page.getByRole("button", { name: "Save changes", exact: true }),
      [
        resourceId,
        categoryId,
        tagId,
        resourceTitle,
        serverTitle,
        attemptedTitle,
        "Browser-tested summary.",
        "Browser-tested body",
        categoryName,
        tagName,
        categorySlug,
        tagSlug,
        resourceSlug,
        "video_interview",
        "graduate_scheme",
        "https://example.com/guide",
        ...prohibitedTimestamps,
        ...prohibitedInfrastructure,
      ],
    );
    const resourceConflict = page.getByRole("alert").filter({ hasText: "changed elsewhere" });
    await expect(resourceConflict).toBeVisible();
    await expect(
      resourceConflict.getByRole("link", { name: "Reload current content" }),
    ).toBeVisible();
    await expect(
      database`select count(*)::int count from app.audit_event where entity_id=${resourceId}::uuid`,
    ).resolves.toEqual(resourceAuditsBefore);
    await expect(
      database`select title from app.preparation_resource where id=${resourceId}::uuid`,
    ).resolves.toEqual([{ title: serverTitle }]);
    await resourceConflict.getByRole("link", { name: "Reload current content" }).click();
    await page
      .locator("article.cms-content-row")
      .filter({ has: page.getByRole("heading", { name: serverTitle }) })
      .getByRole("link", { name: "Edit" })
      .click();

    await page.getByRole("button", { name: "Unpublish" }).click();
    await expect(page.getByText(/Content editor · draft/)).toBeVisible();
    const publicationAuditsBefore = await database<
      { count: number }[]
    >`select count(*)::int count from app.audit_event where entity_id=${resourceId}::uuid`;
    const serverSummary = `SERVER_RESOURCE_SUMMARY_${suffix}`;
    const attemptedPublishTitle = `ATTEMPTED_PUBLISH_TITLE_${suffix}`;
    await database`update app.preparation_resource set short_description=${serverSummary},version=version+1 where id=${resourceId}::uuid`;
    await page.locator('input[name="expectedVersion"]').evaluate((input: HTMLInputElement) => {
      input.value = "0";
    });
    await page.getByLabel("Title (required to publish)").fill(attemptedPublishTitle);
    await submitAndInspectConflict(page.getByRole("button", { name: "Publish", exact: true }), [
      resourceId,
      categoryId,
      tagId,
      serverTitle,
      serverSummary,
      attemptedPublishTitle,
      resourceSlug,
      categoryName,
      tagName,
      ...prohibitedTimestamps,
      ...prohibitedInfrastructure,
    ]);
    const publicationConflict = page.getByRole("alert").filter({ hasText: "changed elsewhere" });
    await expect(publicationConflict).toBeVisible();
    await expect(
      database`select count(*)::int count from app.audit_event where entity_id=${resourceId}::uuid`,
    ).resolves.toEqual(publicationAuditsBefore);
    await publicationConflict.getByRole("link", { name: "Reload current content" }).click();
    await page
      .locator("article.cms-content-row")
      .filter({ has: page.getByRole("heading", { name: serverTitle }) })
      .getByRole("link", { name: "Edit" })
      .click();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText(/Content editor · published/)).toBeVisible();
    await page.getByRole("button", { name: "Unpublish" }).click();
    await expect(page.getByText(/Content editor · draft/)).toBeVisible();
    await page.getByRole("button", { name: "Archive" }).click();
    await expect(page.getByText(/Content editor · archived/)).toBeVisible();
    await page.getByRole("button", { name: "Restore to draft" }).click();
    await expect(page.getByText(/Content editor · draft/)).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
    ).toBe(false);

    await page.goto("/admin/content/tags");
    let tagForm = page.locator("form.cms-taxonomy-row").filter({ hasText: tagSlug });
    const tagAuditsBefore = await database<
      { count: number }[]
    >`select count(*)::int count from app.audit_event where entity_id in (select id from app.content_tag where slug=${tagSlug})`;
    const tagServerName = `SERVER_TAG_${suffix}`;
    const tagAttemptedName = `ATTEMPTED_TAG_${suffix}`;
    await database`update app.content_tag set name=${tagServerName},version=version+1 where slug=${tagSlug}`;
    await tagForm.locator('input[name="version"]').evaluate((input: HTMLInputElement) => {
      input.value = "0";
    });
    await tagForm.getByLabel("Name").fill(tagAttemptedName);
    await submitAndInspectConflict(tagForm.getByRole("button", { name: "Save" }), [
      tagName,
      tagServerName,
      tagAttemptedName,
      tagSlug,
      categoryId,
      tagId,
      ...prohibitedInfrastructure,
    ]);
    const tagConflict = page.getByRole("alert").filter({ hasText: "changed elsewhere" });
    await expect(tagConflict).toBeVisible();
    await expect(tagConflict.getByRole("link", { name: "Reload current content" })).toBeVisible();
    await expect(
      database`select count(*)::int count from app.audit_event where entity_id in (select id from app.content_tag where slug=${tagSlug})`,
    ).resolves.toEqual(tagAuditsBefore);
    await tagConflict.getByRole("link", { name: "Reload current content" }).click();
    tagForm = page.locator("form.cms-taxonomy-row").filter({ hasText: tagSlug });
    await tagForm.getByRole("button", { name: "Archive" }).click();
    await expect(page.getByRole("status")).toContainText("changed");
    const restoredTag = page.locator("form.cms-taxonomy-row").filter({ hasText: tagSlug });
    await restoredTag.getByRole("button", { name: "Restore" }).click();
    await expect(page.getByRole("status")).toContainText("changed");
    await page.goto("/admin/content/categories");
    let categoryForm = page.locator("form.cms-taxonomy-row").filter({ hasText: categorySlug });
    const categoryAuditsBefore = await database<
      { count: number }[]
    >`select count(*)::int count from app.audit_event where entity_id in (select id from app.content_category where slug=${categorySlug})`;
    const categoryServerName = `SERVER_CATEGORY_${suffix}`;
    const categoryAttemptedName = `ATTEMPTED_CATEGORY_${suffix}`;
    await database`update app.content_category set name=${categoryServerName},version=version+1 where slug=${categorySlug}`;
    await categoryForm.locator('input[name="version"]').evaluate((input: HTMLInputElement) => {
      input.value = "0";
    });
    await categoryForm.getByLabel("Name").fill(categoryAttemptedName);
    await submitAndInspectConflict(categoryForm.getByRole("button", { name: "Save" }), [
      categoryName,
      categoryServerName,
      categoryAttemptedName,
      categorySlug,
      categoryId,
      tagId,
      ...prohibitedInfrastructure,
    ]);
    const categoryConflict = page.getByRole("alert").filter({ hasText: "changed elsewhere" });
    await expect(categoryConflict).toBeVisible();
    await expect(
      categoryConflict.getByRole("link", { name: "Reload current content" }),
    ).toBeVisible();
    await expect(
      database`select count(*)::int count from app.audit_event where entity_id in (select id from app.content_category where slug=${categorySlug})`,
    ).resolves.toEqual(categoryAuditsBefore);
    await categoryConflict.getByRole("link", { name: "Reload current content" }).click();
    categoryForm = page.locator("form.cms-taxonomy-row").filter({ hasText: categorySlug });
    await categoryForm.getByRole("button", { name: "Archive" }).click();
    await expect(page.getByRole("status")).toContainText("changed");
    const restoredCategory = page
      .locator("form.cms-taxonomy-row")
      .filter({ hasText: categorySlug });
    await restoredCategory.getByRole("button", { name: "Restore" }).click();
    await expect(page.getByRole("status")).toContainText("changed");
  } finally {
    if (ownerId) await database`delete from app.audit_event where actor_user_id=${ownerId}::uuid`;
    if (resourceId)
      await database`delete from app.preparation_resource where id=${resourceId}::uuid`;
    await database`delete from app.content_tag where slug=${tagSlug}`;
    await database`delete from app.content_category where slug=${categorySlug}`;
    if (ownerId) {
      await database`delete from app.audit_event where actor_user_id=${ownerId}::uuid`;
      await database`delete from app.onboarding_profile where user_id=${ownerId}::uuid`;
      await database`delete from app.beta_entitlement where user_id=${ownerId}::uuid`;
      await database`delete from app."user" where id=${ownerId}::uuid`;
    }
    if (authId) await database`delete from auth.users where id=${authId}::uuid`;
    await database.end();
  }
});
