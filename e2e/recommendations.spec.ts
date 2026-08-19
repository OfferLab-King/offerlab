import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import postgres, { type Sql } from "postgres";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const password = "StrongPassword123!";

type SeededMember = Readonly<{
  applicationId: string;
  email: string;
  ownerId: string;
}>;

function londonCalendarDate(instant: Date): string {
  const values: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
  for (const part of new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/London",
    year: "numeric",
  }).formatToParts(instant)) {
    values[part.type] = part.value;
  }
  if (!values.year || !values.month || !values.day) {
    throw new Error("Could not resolve the London test date.");
  }
  return `${values.year}-${values.month}-${values.day}`;
}

async function seedCompletedMember(database: Sql, suffix: string): Promise<SeededMember> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) {
    throw new Error("Local Supabase E2E configuration is missing.");
  }

  const email = `recommendations-${suffix}@example.com`;
  const publicClient = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await publicClient.auth.signUp({ email, password });
  expect(error).toBeNull();
  const authUserId = data.user?.id;
  if (!authUserId) throw new Error("Local Supabase did not create the E2E identity.");

  await database`
    update auth.users
    set email_confirmed_at = now(), updated_at = now()
    where id = ${authUserId}::uuid
  `;
  const owners = await database<{ id: string }[]>`
    insert into app."user" (auth_user_id, email)
    values (${authUserId}::uuid, ${email})
    returning id
  `;
  const ownerId = owners[0]?.id;
  if (!ownerId) throw new Error("The E2E member was not created.");

  await database`
    insert into app.beta_entitlement (user_id, status, activated_at, updated_at)
    values (${ownerId}::uuid, 'active', now(), now())
  `;
  await database`
    insert into app.onboarding_profile (
      user_id,
      education_stage,
      opportunity_types,
      industries,
      preparation_priorities,
      completed_at
    ) values (
      ${ownerId}::uuid,
      'recent_graduate',
      array['graduate_scheme']::text[],
      array['consulting']::text[],
      array['application_cv']::text[],
      now()
    )
  `;

  const today = londonCalendarDate(new Date());
  const primaryApplications = await database<{ id: string }[]>`
    insert into app.application (
      owner_user_id,
      company_name,
      role_title,
      opportunity_type,
      industry,
      current_stage,
      application_deadline
    ) values (
      ${ownerId}::uuid,
      'Recommendation Test Partners',
      'Graduate Consultant',
      'graduate_scheme',
      'consulting',
      'preparing',
      ${today}::date
    )
    returning id
  `;
  const applicationId = primaryApplications[0]?.id;
  if (!applicationId) throw new Error("The primary E2E application was not created.");

  for (let index = 1; index <= 3; index += 1) {
    await database`
      insert into app.application (
        owner_user_id,
        company_name,
        role_title,
        opportunity_type,
        industry,
        current_stage
      ) values (
        ${ownerId}::uuid,
        ${`Dashboard Limit Employer ${index}`},
        ${`Graduate Role ${index}`},
        'graduate_scheme',
        'consulting',
        'preparing'
      )
    `;
  }

  return { applicationId, email, ownerId };
}

async function cleanUpMember(database: Sql, email: string): Promise<void> {
  const owners = await database<{ id: string }[]>`
    select id from app."user" where email = ${email}
  `;
  const ownerId = owners[0]?.id;
  if (ownerId) {
    await database`delete from app.audit_event where actor_user_id = ${ownerId}::uuid`;
    await database`delete from app.member_resource_state where owner_user_id = ${ownerId}::uuid`;
    await database`delete from app.recommendation_state where owner_user_id = ${ownerId}::uuid`;
    await database`delete from app.application where owner_user_id = ${ownerId}::uuid`;
    await database`delete from app.onboarding_profile where user_id = ${ownerId}::uuid`;
    await database`delete from app.beta_entitlement where user_id = ${ownerId}::uuid`;
    await database`delete from app."user" where id = ${ownerId}::uuid`;
  }
  await database`delete from auth.users where email = ${email}`;
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
}

function pendingCards(page: Page) {
  return page.locator(".recommendations > .recommendation-grid .recommendation-card");
}

function recommendationCard(page: Page, title: string) {
  return page
    .locator("article.recommendation-card")
    .filter({ has: page.getByRole("heading", { name: title }) });
}

test("member recommendations remain deterministic and stateful", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(120_000);
  const database = postgres(databaseUrl, { max: 2, prepare: false });
  const suffix = `${testInfo.project.name.replaceAll(/\W/g, "-")}-${Date.now()}`;
  let member: SeededMember | undefined;

  try {
    member = await seedCompletedMember(database, suffix);
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(member.email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/member");

    await expect(page.getByRole("heading", { name: "Your preparation workspace" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recommended next actions" })).toBeVisible();
    await expect(page.locator("article.recommendation-card")).toHaveCount(10);
    await expect(page.getByText("4 active applications")).toBeVisible();
    await expect(
      page
        .getByRole("link", {
          name: "Recommendation Test Partners — Graduate Consultant",
        })
        .first(),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto("/member/learn/resources?q=video&stage=video_interview");
    await expect(page.getByRole("heading", { name: "Resource Library" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Video interview preparation" })).toBeVisible();
    await page.getByRole("link", { name: "Start" }).click();
    await expect(page.getByRole("heading", { name: "Prepare with purpose" })).toBeVisible();
    await page.getByRole("button", { name: "Save resource" }).click();
    await expect(page.getByText("Resource updated.")).toBeVisible();
    await page.getByRole("button", { name: "Mark complete" }).click();
    await expect(page.getByRole("button", { name: "Mark incomplete" })).toBeVisible();
    await page.goto("/member/learn/resources?saved=1&completed=complete");
    await expect(page.getByRole("heading", { name: "Video interview preparation" })).toBeVisible();
    await page.getByRole("link", { name: "Review" }).click();
    await page.getByRole("button", { name: "Mark incomplete" }).click();
    await expect(page.getByRole("button", { name: "Mark complete" })).toBeVisible();
    await page.getByRole("button", { name: "Unsave" }).click();
    await expect(page.getByRole("button", { name: "Save resource" })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const detailPath = `/member/applications/${member.applicationId}`;
    await page.goto(detailPath);
    await expect(page.getByRole("heading", { name: "Next actions" })).toBeVisible();
    await expect(pendingCards(page)).toHaveCount(3);
    expect(await pendingCards(page).count()).toBeLessThanOrEqual(5);
    const deadlineCard = recommendationCard(page, "Confirm the deadline and make a plan");
    await expect(deadlineCard.getByText("Urgency: urgent")).toBeVisible();
    await expect(deadlineCard).toContainText(
      "Prioritised because the application deadline is today.",
    );
    await expect(deadlineCard).toContainText(
      "Recommended because this application is currently being prepared.",
    );
    await expectNoHorizontalOverflow(page);

    const endpoint = `${detailPath}/recommendations`.replace(
      "/member/applications/",
      "/api/member/applications/",
    );
    const mutation = {
      expectedVersion: null,
      recommendationKey: "preparing_confirm_deadline_plan",
      ruleVersion: 1,
      targetState: "completed",
    } as const;
    const origin = new URL(page.url()).origin;
    const unauthenticated = await request.post(endpoint, {
      data: mutation,
      headers: { origin },
    });
    expect(unauthenticated.status()).toBe(401);
    expect(await unauthenticated.json()).toEqual({
      message: "We could not complete that request. Please try again.",
    });

    const completed = await page.context().request.post(endpoint, {
      data: mutation,
      headers: { origin },
    });
    expect(completed.status()).toBe(200);
    expect(await completed.json()).toEqual({
      ok: true,
      outcome: "completed",
      stateVersion: 1,
    });

    const staleComplete = deadlineCard.getByRole("button", {
      name: "Mark “Confirm the deadline and make a plan” as completed.",
    });
    const [conflictResponse] = await Promise.all([
      page.waitForResponse(
        (response) => response.url().endsWith(endpoint) && response.request().method() === "POST",
      ),
      staleComplete.click(),
    ]);
    expect(conflictResponse.status()).toBe(409);
    expect(await conflictResponse.json()).toEqual({ ok: true, outcome: "conflict" });
    const conflictAlert = page.getByRole("alert").filter({
      hasText: "This recommendation changed elsewhere.",
    });
    await expect(conflictAlert).toBeFocused();
    await expect(conflictAlert).toContainText(
      "This recommendation changed elsewhere. Reload before trying again.",
    );
    await conflictAlert.getByRole("button", { name: "Reload recommendations" }).click();

    const completedHistory = page.getByText("Completed recommendations (1)");
    await expect(completedHistory).toBeVisible();
    await expect(pendingCards(page)).toHaveCount(2);
    await completedHistory.click();
    await page
      .getByRole("button", {
        name: "Restore “Confirm the deadline and make a plan” to pending.",
      })
      .click();
    const restoredStatus = page.getByRole("status").filter({
      hasText: "“Confirm the deadline and make a plan” was restored to pending.",
    });
    await expect(restoredStatus).toBeFocused();
    await expect(pendingCards(page)).toHaveCount(3);

    const tailorCard = recommendationCard(page, "Tailor your application materials");
    await tailorCard
      .getByRole("button", { name: "Dismiss “Tailor your application materials” recommendation." })
      .click();
    const dismissDialog = page.getByRole("alertdialog", {
      name: "Dismiss this recommendation?",
    });
    await expect(
      dismissDialog.getByRole("button", {
        name: "Confirm dismissal of “Tailor your application materials”.",
      }),
    ).toBeFocused();
    await dismissDialog
      .getByRole("button", {
        name: "Confirm dismissal of “Tailor your application materials”.",
      })
      .click();
    await expect(page.getByText("Dismissed recommendations (1)")).toBeVisible();
    await page.getByText("Dismissed recommendations (1)").click();
    await page
      .getByRole("button", {
        name: "Restore “Tailor your application materials” to pending.",
      })
      .click();
    await expect(pendingCards(page)).toHaveCount(3);

    await recommendationCard(page, "Confirm the deadline and make a plan")
      .getByRole("button", {
        name: "Mark “Confirm the deadline and make a plan” as completed.",
      })
      .click();
    await expect(page.getByText("Completed recommendations (1)")).toBeVisible();

    await page.getByLabel("Current recruitment stage").selectOption("interview");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Application saved.")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Prepare evidence-based examples" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Confirm the deadline and make a plan" }),
    ).toHaveCount(0);
    await expect(pendingCards(page)).toHaveCount(3);

    await page.getByLabel("Current recruitment stage").selectOption("preparing");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Application saved.")).toBeVisible();
    await expect(page.getByText("Completed recommendations (1)")).toBeVisible();
    await expect(pendingCards(page)).toHaveCount(2);
    await page.getByText("Completed recommendations (1)").click();
    await expect(
      recommendationCard(page, "Confirm the deadline and make a plan").getByText("Completed"),
    ).toBeVisible();

    await page.getByRole("button", { name: "Archive application" }).click();
    const archiveDialog = page.getByRole("alertdialog", { name: "Archive this application?" });
    await expect(archiveDialog.getByRole("button", { name: "Confirm archive" })).toBeFocused();
    await archiveDialog.getByRole("button", { name: "Confirm archive" }).click();
    await page.waitForURL("**/member/applications?view=archived");
    await page.goto(detailPath);
    await expect(
      page.getByText(/Archived applications do not have active recommendations/i),
    ).toBeVisible();
    await expect(page.locator("article.recommendation-card")).toHaveCount(0);

    await page.goto("/member");
    await expect(page.getByText("3 active applications")).toBeVisible();
    await expect(page.locator("article.recommendation-card")).toHaveCount(9);
    await expect(
      page
        .getByRole("link", {
          name: "Recommendation Test Partners — Graduate Consultant",
        })
        .first(),
    ).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    await page.goto(detailPath);
    await page.getByRole("button", { name: "Restore application" }).click();
    await page.waitForURL("**/member/applications");
    await page.goto(detailPath);
    await expect(page.getByRole("heading", { name: "Next actions" })).toBeVisible();
    await expect(pendingCards(page)).toHaveCount(2);
    await expect(page.getByText("Completed recommendations (1)")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto("/member");
    await expect(page.getByText("4 active applications")).toBeVisible();
    await expect(page.locator("article.recommendation-card")).toHaveCount(10);
    await expect(
      page
        .getByRole("link", {
          name: "Recommendation Test Partners — Graduate Consultant",
        })
        .first(),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  } finally {
    if (member) await cleanUpMember(database, member.email);
    await database.end();
  }
});
