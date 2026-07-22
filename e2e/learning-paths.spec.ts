import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import postgres from "postgres";
const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const password = "StrongPassword123!";
test("administrator publishes a path and member progress follows resource completion", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const db = postgres(databaseUrl, { prepare: false });
  const suffix = `${testInfo.project.name}-${Date.now()}`.replaceAll(/[^a-z0-9-]/g, "-");
  const email = `path-${suffix}@example.com`;
  let authId = "",
    ownerId = "",
    pathId = "";
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
      key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Supabase configuration missing");
    const client = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const signup = await client.auth.signUp({ email, password });
    authId = signup.data.user?.id ?? "";
    await db`update auth.users set email_confirmed_at=now(),updated_at=now() where id=${authId}::uuid`;
    ownerId = (
      await db<
        { id: string }[]
      >`insert into app."user"(auth_user_id,email,role) values(${authId}::uuid,${email},'administrator') returning id`
    )[0]!.id;
    await db`insert into app.beta_entitlement(user_id,status,activated_at,updated_at) values(${ownerId}::uuid,'active',now(),now())`;
    await db`insert into app.onboarding_profile(user_id,education_stage,opportunity_types,industries,preparation_priorities,completed_at) values(${ownerId}::uuid,'recent_graduate',array['graduate_scheme'],array['consulting'],array['application_cv'],now())`;
    const title = `Browser learning path ${suffix}`,
      slug = `browser-learning-path-${suffix}`;
    pathId = (
      await db<
        { id: string }[]
      >`insert into app.learning_path(path_key,slug,title,short_description,introduction) values(${`browser_path_${suffix.replaceAll("-", "_")}`},${slug},${title},'A focused browser-tested guided path.','') returning id`
    )[0]!.id;
    const sectionId = (
      await db<
        { id: string }[]
      >`insert into app.learning_path_section(learning_path_id,heading,position) values(${pathId}::uuid,'Prepare',1) returning id`
    )[0]!.id;
    const resourceId = (
      await db<
        { id: string }[]
      >`select id from app.preparation_resource where resource_key='application_planning_checklist'`
    )[0]!.id;
    await db`insert into app.learning_path_item(learning_path_id,section_id,preparation_resource_id,position) values(${pathId}::uuid,${sectionId}::uuid,${resourceId}::uuid,1)`;
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/(admin|member)$/);
    await page.goto("/admin/content/paths");
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await page.goto(`/admin/content/paths/${pathId}`);
    await expect(page.getByRole("heading", { name: "Edit learning path" })).toBeVisible();
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText("Administrator CMS · published", { exact: true })).toBeVisible();
    await page.goto("/member/learn/paths");
    await page.getByRole("link", { name: "Continue learning" }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await page.getByRole("button", { name: "Start this path" }).click();
    await page.getByRole("link", { name: "Continue learning" }).click();
    await page.getByRole("button", { name: "Mark complete" }).click();
    await expect(page.getByText("Resource updated.")).toBeVisible();
    await page.goto(`/member/learn/paths/${slug}`);
    await expect(page.getByText("1 of 1 complete · 100%")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
    await page.goto(`/admin/content/paths/${pathId}`);
    await page.getByRole("button", { name: "Unpublish", exact: true }).click();
  } finally {
    if (ownerId) {
      await db`delete from app.audit_event where actor_user_id=${ownerId}::uuid`;
      await db`delete from app.member_learning_path_state where owner_user_id=${ownerId}::uuid`;
      await db`delete from app.member_resource_state where owner_user_id=${ownerId}::uuid`;
    }
    if (pathId) {
      await db`delete from app.audit_event where entity_id=${pathId}::uuid`;
      await db`delete from app.learning_path where id=${pathId}::uuid`;
    }
    if (ownerId) {
      await db`delete from app.onboarding_profile where user_id=${ownerId}::uuid`;
      await db`delete from app.beta_entitlement where user_id=${ownerId}::uuid`;
      await db`delete from app."user" where id=${ownerId}::uuid`;
    }
    if (authId) await db`delete from auth.users where id=${authId}::uuid`;
    await db.end();
  }
});
