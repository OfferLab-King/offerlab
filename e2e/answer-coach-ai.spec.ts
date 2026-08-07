import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import postgres from "postgres";

const databaseUrl =
    process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres",
  password = "StrongPassword123!";

test("AI Answer Coach requires consent and falls back safely at 390px", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium" || process.env.ANSWER_COACH_PROVIDER !== "deepseek",
    "This focused model-boundary journey runs explicitly with the synthetic E2E provider.",
  );
  const db = postgres(databaseUrl, { prepare: false });
  const suffix = Date.now();
  const email = `answer-coach-ai-${suffix}@example.com`;
  let authId = "";
  let ownerId = "";
  let answerId = "";
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Supabase configuration missing");
    const client = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    authId = (await client.auth.signUp({ email, password })).data.user?.id ?? "";
    await db`update auth.users set email_confirmed_at=now(),updated_at=now() where id=${authId}::uuid`;
    ownerId = (
      await db<
        { id: string }[]
      >`insert into app."user"(auth_user_id,email) values(${authId}::uuid,${email}) returning id`
    )[0]!.id;
    await db`insert into app.beta_entitlement(user_id,status,activated_at,updated_at) values(${ownerId}::uuid,'active',now(),now())`;
    await db`insert into app.onboarding_profile(user_id,education_stage,opportunity_types,industries,preparation_priorities,completed_at) values(${ownerId}::uuid,'recent_graduate',array['graduate_scheme'],array['consulting'],array['behavioural_interview'],now())`;
    answerId = (
      await db<
        { id: string }[]
      >`insert into app.member_answer(owner_user_id,custom_question,question_family,title,key_points,draft_answer,ready_at) values(${ownerId}::uuid,'Tell me about teamwork.','competency_and_behavioural','AI boundary fixture','My individual contribution','I compared three options because the deadline was close and the team delivered on time.',now()) returning id`
    )[0]!.id;

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/member$/);
    await page.goto(`/member/learn/answer-bank/answers/${answerId}`);

    const reviewButton = page.getByRole("button", { name: "Review with AI" });
    await expect(reviewButton).toBeDisabled();
    await expect(page.getByText(/send this answer.*DeepSeek/i)).toBeVisible();
    await page.getByLabel(/I agree to send this answer/).check();
    await expect(reviewButton).toBeEnabled();
    await reviewButton.click();
    await expect(page.getByText(/AI service was unavailable/)).toBeVisible();
    await expect(page.getByText(/Local fallback review/)).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Coaching comments" })).toBeVisible();
    await expect(page.getByLabel("Draft answer")).toHaveValue(
      "I compared three options because the deadline was close and the team delivered on time.",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
    ).toBe(false);
  } finally {
    if (ownerId) {
      await db`delete from app.answer_coach_comment where owner_user_id=${ownerId}::uuid`;
      await db`delete from app.answer_coach_review where owner_user_id=${ownerId}::uuid`;
      await db`delete from app.member_answer where owner_user_id=${ownerId}::uuid`;
      await db`delete from app.onboarding_profile where user_id=${ownerId}::uuid`;
      await db`delete from app.beta_entitlement where user_id=${ownerId}::uuid`;
      await db`delete from app."user" where id=${ownerId}::uuid`;
    }
    if (authId) await db`delete from auth.users where id=${authId}::uuid`;
    await db.end();
  }
});
