import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import postgres from "postgres";
const databaseUrl =
    process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres",
  password = "StrongPassword123!";
test("member completes the Answer and Story Bank journey at 390px", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "This focused journey declares its own 390px viewport and runs once.",
  );
  const db = postgres(databaseUrl, { prepare: false }),
    suffix = `${testInfo.project.name}-${Date.now()}`.replaceAll(/[^a-z0-9-]/g, "-"),
    email = `answer-bank-${suffix}@example.com`,
    questionKey = `browser_teamwork_${suffix.replaceAll("-", "_")}`;
  let authId = "",
    ownerId = "",
    questionId = "";
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
      key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Supabase configuration missing");
    const client = createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
      }),
      signup = await client.auth.signUp({ email, password });
    authId = signup.data.user?.id ?? "";
    await db`update auth.users set email_confirmed_at=now(),updated_at=now() where id=${authId}::uuid`;
    ownerId = (
      await db<
        { id: string }[]
      >`insert into app."user"(auth_user_id,email) values(${authId}::uuid,${email}) returning id`
    )[0]!.id;
    await db`insert into app.beta_entitlement(user_id,status,activated_at,updated_at) values(${ownerId}::uuid,'active',now(),now())`;
    await db`insert into app.onboarding_profile(user_id,education_stage,opportunity_types,industries,preparation_priorities,completed_at) values(${ownerId}::uuid,'recent_graduate',array['graduate_scheme'],array['consulting'],array['behavioural_interview'],now())`;
    questionId = (
      await db<
        { id: string }[]
      >`insert into app.interview_question(stable_key,question_family,prompt,guidance,position) values(${questionKey},'competency_and_behavioural',${`Tell me about browser-tested teamwork ${suffix}.`},'Use a clear evidence story.',9000) returning id`
    )[0]!.id;
    await db`insert into app.interview_question_stage(question_id,recruitment_stage) values(${questionId}::uuid,'interview')`;
    await db`insert into app.member_story(owner_user_id,title,experience_type,situation,task,actions,reasoning,result,reflection,ready_at) values(${ownerId}::uuid,${`Existing leadership story ${suffix}`},'employment','A project needed direction.','Set a clear plan.','I coordinated the work.','Clarity reduced risk.','The project completed.','I learned to align early.',now())`;
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/member$/);
    const homeWidth = await page
      .locator("main")
      .evaluate((main) => main.getBoundingClientRect().width);
    await page.getByRole("link", { name: "Prepare" }).click();
    const prepareWidth = await page
      .locator("main")
      .evaluate((main) => main.getBoundingClientRect().width);
    expect(prepareWidth).toBe(homeWidth);
    const headerAlignment = await page.locator(".member-header").evaluate((header) => {
      const brand = header.querySelector(".brand")?.getBoundingClientRect();
      const signOut = header.querySelector("button")?.getBoundingClientRect();
      if (!brand || !signOut) return Number.POSITIVE_INFINITY;
      return Math.abs(brand.top + brand.height / 2 - (signOut.top + signOut.height / 2));
    });
    expect(headerAlignment).toBeLessThanOrEqual(1);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("navigation", { name: "Prepare" })).toBeVisible();
    await page.getByRole("link", { name: "Open my Answer Bank" }).click();
    await expect(page.getByRole("navigation", { name: "My Answer and Story Bank" })).toBeVisible();
    await page.getByRole("link", { name: "Stories", exact: true }).click();
    await page.getByRole("link", { name: "Add a story" }).first().click();
    await page.getByLabel("Story title").fill(`Browser teamwork story ${suffix}`);
    await page.getByLabel("Situation").fill("Our student project had a short deadline.");
    await page.getByLabel("Task").fill("I needed to coordinate a complete submission.");
    await page
      .getByLabel("Actions")
      .fill("I divided the work, checked progress and resolved a blocker.");
    await page.getByLabel("Reasoning").fill("Clear ownership would keep the team moving.");
    await page.getByLabel("Result").fill("We submitted on time and received strong feedback.");
    await page.getByLabel("Reflection").fill("I would agree checkpoints earlier next time.");
    await page.getByLabel("Teamwork").check();
    await page.getByRole("button", { name: "Mark Ready" }).click();
    await expect(page.getByRole("heading", { name: "Review evidence story" })).toBeVisible();
    await page.getByRole("link", { name: "Questions" }).click();
    await page.getByLabel("Recruitment stage").selectOption("interview");
    await page.getByLabel("Family").selectOption("competency_and_behavioural");
    await page.getByRole("button", { name: "Filter" }).click();
    await expect(page).toHaveURL(/stage=interview/);
    const questionCard = page
      .locator("article")
      .filter({ hasText: `browser-tested teamwork ${suffix}` });
    await questionCard.getByRole("link", { name: "Draft answer" }).click();
    await page.getByLabel("Answer label").fill(`Teamwork answer ${suffix}`);
    await page.getByLabel("Key points").fill("My coordination and direct contribution.");
    await page
      .getByLabel("Draft answer")
      .fill("I coordinated a team under time pressure and helped us deliver a strong result.");
    await page.getByLabel(new RegExp(`Existing leadership story ${suffix}`)).check();
    await page.getByLabel(new RegExp(`Browser teamwork story ${suffix}`)).check();
    const order = page.getByRole("list", { name: "Linked story order" });
    await expect(order.getByRole("button", { name: new RegExp("Move .* up") })).toHaveCount(2);
    await order
      .getByRole("button", { name: new RegExp(`Move Browser teamwork story ${suffix} up`) })
      .click();
    await expect(order.locator("li").first()).toContainText(`Browser teamwork story ${suffix}`);
    await page.getByRole("button", { name: "Mark Ready" }).click();
    await expect(page.getByRole("heading", { name: "Review answer" })).toBeVisible();
    await page
      .getByRole("navigation", { name: "My Answer and Story Bank" })
      .getByRole("link", { name: "Overview", exact: true })
      .click();
    await expect(page.getByText("1 Ready").first()).toBeVisible();
    await expect(page.getByText("Covered").first()).toBeVisible();
    await page.getByRole("link", { name: "Answers", exact: true }).click();
    await page.getByRole("link", { name: "Review" }).click();
    await page.getByRole("button", { name: "Archive answer" }).click();
    await expect(page.getByRole("link", { name: "View active answers" })).toBeVisible();
    await expect(page.getByText("Archived", { exact: true }).first()).toBeVisible();
    await page.getByRole("link", { name: "View and restore" }).click();
    await page.getByRole("button", { name: "Restore answer" }).click();
    await expect(page.getByRole("heading", { name: "Interview answers" })).toBeVisible();
    await page
      .getByRole("navigation", { name: "My Answer and Story Bank" })
      .getByRole("link", { name: "Overview", exact: true })
      .click();
    await page
      .getByRole("navigation", { name: "Prepare" })
      .getByRole("link", { name: "Overview" })
      .click();
    await expect(page.getByText("2 evidence stories")).toBeVisible();
    await expect(page.getByText("1 Ready answers")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
    ).toBe(false);
    await page.getByRole("link", { name: "Profile" }).click();
    await expect(page.getByRole("navigation", { name: "Member navigation" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Profile" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  } finally {
    if (ownerId) {
      await db`delete from app.audit_event where actor_user_id=${ownerId}::uuid`;
      await db`delete from app.member_answer_story where owner_user_id=${ownerId}::uuid`;
      await db`delete from app.member_answer where owner_user_id=${ownerId}::uuid`;
      await db`delete from app.member_story_competency where owner_user_id=${ownerId}::uuid`;
      await db`delete from app.member_story where owner_user_id=${ownerId}::uuid`;
      await db`delete from app.onboarding_profile where user_id=${ownerId}::uuid`;
      await db`delete from app.beta_entitlement where user_id=${ownerId}::uuid`;
      await db`delete from app."user" where id=${ownerId}::uuid`;
    }
    if (questionId) await db`delete from app.interview_question where id=${questionId}::uuid`;
    if (authId) await db`delete from auth.users where id=${authId}::uuid`;
    await db.end();
  }
});
