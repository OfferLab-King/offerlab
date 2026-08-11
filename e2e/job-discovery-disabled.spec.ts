import { expect, test } from "@playwright/test";
import postgres from "postgres";

/**
 * The retired member job-discovery route sends members directly to the public
 * catalogue. JSearch and the duplicate manual-target workspace stay absent.
 */
const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const password = "StrongPassword123!";

test("the retired member job page redirects directly to the catalogue", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  test.skip(testInfo.project.name !== "chromium", "The job-discovery flow runs once.");
  const database = postgres(databaseUrl, { prepare: false });
  const suffix = `${testInfo.project.name}-${Date.now()}`.replaceAll(/[^a-z0-9-]/g, "-");
  const email = `job-discovery-${suffix}@example.com`;
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
    if (!signup.ok || !signupBody.id) {
      throw new Error(
        `Could not create the local test member: ${signupBody.message ?? signup.status}`,
      );
    }
    authId = signupBody.id;
    await database`update auth.users set email_confirmed_at=now(),updated_at=now() where id=${authId}::uuid`;
    ownerId = (
      await database<
        { id: string }[]
      >`insert into app."user"(auth_user_id,email) values(${authId}::uuid,${email}) returning id`
    )[0]!.id;
    await database`insert into app.beta_entitlement(user_id,status,activated_at,updated_at) values(${ownerId}::uuid,'active',now(),now())`;
    await database`insert into app.onboarding_profile(user_id,education_stage,opportunity_types,industries,preparation_priorities,completed_at) values(${ownerId}::uuid,'recent_graduate',array['graduate_scheme'],array['technology'],array['application_cv'],now())`;

    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/member/);

    await page.goto("/member/jobs");
    await expect(page).toHaveURL(/\/jobs$/);
    await expect(page.getByRole("heading", { name: /Find your next opportunity/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Search jobs" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Search by role and location" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Save private target" })).toHaveCount(0);
  } finally {
    await database.end();
  }
});
