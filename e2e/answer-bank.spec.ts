import { expect, test } from "@playwright/test";
import postgres from "postgres";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const password = "StrongPassword123!";

test("member prepares and reviews an answer in the question-first bank at 390px", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  test.skip(testInfo.project.name !== "chromium", "The focused mobile journey runs once.");
  const db = postgres(databaseUrl, { prepare: false });
  const suffix = `${testInfo.project.name}-${Date.now()}`.replaceAll(/[^a-z0-9-]/g, "-");
  const email = `question-bank-${suffix}@example.com`;
  let authId = "";
  let ownerId = "";
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
    if (!signup.ok || !signupBody.id)
      throw new Error(
        `Could not create the local test member: ${signupBody.message ?? signup.status}`,
      );
    authId = signupBody.id;
    await db`update auth.users set email_confirmed_at=now(),updated_at=now() where id=${authId}::uuid`;
    ownerId = (
      await db<
        { id: string }[]
      >`insert into app."user"(auth_user_id,email) values(${authId}::uuid,${email}) returning id`
    )[0]!.id;
    await db`insert into app.beta_entitlement(user_id,status,activated_at,updated_at) values(${ownerId}::uuid,'active',now(),now())`;
    await db`insert into app.onboarding_profile(user_id,education_stage,opportunity_types,industries,preparation_priorities,completed_at) values(${ownerId}::uuid,'recent_graduate',array['graduate_scheme'],array['consulting'],array['behavioural_interview'],now())`;

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/member$/);
    await page.goto("/member/learn/answer-bank");

    await expect(
      page.getByRole("heading", { name: "Prepare your interview answers" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Introduction and the three whys" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "10 competency questions" })).toBeVisible();
    await expect(page.locator(".simple-question")).toHaveCount(14);
    await expect(page.getByRole("navigation", { name: "My Answer and Story Bank" })).toHaveCount(0);
    const desktopSection = page.locator(".simple-question-section").first();
    const desktopWidths = await desktopSection.evaluate((section) => {
      const list = section.querySelector<HTMLElement>(".simple-question-list");
      return {
        list: list?.getBoundingClientRect().width ?? 0,
        section: section.getBoundingClientRect().width,
      };
    });
    expect(desktopWidths.list / desktopWidths.section).toBeGreaterThan(0.95);

    await page.setViewportSize({ width: 390, height: 844 });

    const question = page.locator(".simple-question").first();
    await question.getByRole("button", { name: /Tell me about yourself/ }).click();
    await expect(question.getByRole("button", { name: "Save & check with AI" })).toBeVisible();
    await question
      .getByLabel("Your answer")
      .fill(
        "I am a final-year economics student who enjoys turning evidence into practical recommendations. During a university project I interviewed local businesses and presented our findings to the course team. I now want to apply that analytical and collaborative experience in a graduate role.",
      );
    await question.getByRole("button", { name: "Save & check with AI" }).click();
    await expect(question.getByRole("region", { name: "AI answer review" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(question.locator("mark").first()).toBeVisible();
    expect(
      await question.locator(".simple-coach-comments").evaluate((comments) => ({
        maxHeight: getComputedStyle(comments).maxHeight,
        overflowY: getComputedStyle(comments).overflowY,
      })),
    ).toEqual({ maxHeight: "none", overflowY: "visible" });
    await expect(question.getByRole("status")).toContainText("Review ready");
    await question.getByRole("button", { name: "Review again" }).click();
    await expect(question.getByLabel("Review history")).toBeVisible({ timeout: 20_000 });
    await expect(question.getByLabel("Review history").locator("option")).toHaveCount(2);
    await expect(question.getByRole("link", { name: "Previous reviews" })).toHaveCount(0);
    const completion = question.locator(".simple-question-completion");
    const markPrepared = completion.getByRole("button", { name: "Mark prepared" });
    const alignment = await completion.evaluate((container) => {
      const button = container.querySelector("button");
      if (!button) return Number.POSITIVE_INFINITY;
      return Math.abs(
        container.getBoundingClientRect().right - button.getBoundingClientRect().right,
      );
    });
    expect(alignment).toBeLessThanOrEqual(1);
    await markPrepared.click();
    await expect(question.getByText("Prepared", { exact: true })).toBeVisible();
    await expect(page.getByText("1 of 14 prepared")).toBeVisible();
    await page.reload();
    const reopenedQuestion = page.locator(".simple-question").first();
    await reopenedQuestion.getByRole("button", { name: /Tell me about yourself/ }).click();
    await expect(reopenedQuestion.getByLabel("Review history")).toBeVisible({ timeout: 20_000 });
    await expect(reopenedQuestion.getByLabel("Review history").locator("option")).toHaveCount(2);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
    ).toBe(false);
  } finally {
    if (ownerId) {
      await db`delete from app.audit_event where actor_user_id=${ownerId}::uuid`;
      await db`delete from app.answer_coach_comment where owner_user_id=${ownerId}::uuid`;
      await db`delete from app.answer_coach_review where owner_user_id=${ownerId}::uuid`;
      await db`delete from app.member_answer_story where owner_user_id=${ownerId}::uuid`;
      await db`delete from app.member_answer where owner_user_id=${ownerId}::uuid`;
      await db`delete from app.onboarding_profile where user_id=${ownerId}::uuid`;
      await db`delete from app.beta_entitlement where user_id=${ownerId}::uuid`;
      await db`delete from app."user" where id=${ownerId}::uuid`;
    }
    if (authId) await db`delete from auth.users where id=${authId}::uuid`;
    await db.end();
  }
});
