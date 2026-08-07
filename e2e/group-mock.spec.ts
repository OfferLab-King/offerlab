import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import postgres from "postgres";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const password = "StrongPassword123!";

test("member reserves a Group Mock room at 390px", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  test.skip(testInfo.project.name !== "chromium", "This focused responsive journey runs once.");
  const database = postgres(databaseUrl, { prepare: false });
  const suffix = Date.now().toString(36);
  const email = `group-mock-${suffix}@example.com`;
  let authId = "";
  let ownerId = "";
  let materialId = "";
  let sessionId = "";
  let priorAdministratorId = "";
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Supabase configuration missing");
    const client = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    priorAdministratorId =
      (await database<{ id: string }[]>`select id from app."user" where role='administrator'`)[0]
        ?.id ?? "";
    if (priorAdministratorId)
      await database`update app."user" set role='member' where id=${priorAdministratorId}::uuid`;
    const signup = await client.auth.signUp({ email, password });
    authId = signup.data.user?.id ?? "";
    await database`update auth.users set email_confirmed_at=now(),updated_at=now() where id=${authId}::uuid`;
    ownerId = (
      await database<{ id: string }[]>`
        insert into app."user"(auth_user_id,email,role)
        values(${authId}::uuid,${email},'administrator') returning id`
    )[0]!.id;
    await database`insert into app.beta_entitlement(user_id,status,activated_at,updated_at)
      values(${ownerId}::uuid,'active',now(),now())`;
    await database`insert into app.onboarding_profile(user_id,education_stage,opportunity_types,industries,
      preparation_priorities,completed_at) values(${ownerId}::uuid,'recent_graduate',
      array['graduate_scheme'],array['consulting'],array['assessment_centre'],now())`;
    materialId = (
      await database<{ id: string }[]>`
        insert into app.group_mock_material(stable_key,title,summary,sector,exercise_type,difficulty,
          recommended_minutes,scenario,participant_instructions,information_pack,deliverable,
          observer_rubric,debrief_questions,publication_state,originality_confirmed_at,originality_confirmed_by_user_id)
        values(${`e2e_group_mock_${suffix}`},'Community investment decision',
          'Compare fictional projects and agree a reasoned recommendation.','retail_consumer',
          'prioritisation','standard',60,'A fictional organisation has limited funding for one project.',
          'Read the pack and agree how the group will make its decision.',
          'Each fictional option has different reach, delivery risk and cost.',
          'Present one recommendation and the key trade-off.',
          'Observe inclusion, explicit criteria, evidence and time management.',
          array['What helped the decision?','What would you change?'],'published',now(),${ownerId}::uuid)
        returning id`
    )[0]!.id;
    sessionId = (
      await database<{ id: string }[]>`
        insert into app.group_mock_session(material_id,title,starts_at,ends_at,minimum_participants,
          capacity,access_mode,state) values(${materialId}::uuid,'Thursday group exercise',
          now()+interval '7 days',now()+interval '7 days 1 hour',3,6,'member_included','open') returning id`
    )[0]!.id;
    await database`insert into app.group_mock_session_meeting(session_id,provider,join_url,joining_instructions)
      values(${sessionId}::uuid,'external','https://meet.example.test/group-mock','Use your first name only.')`;

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/(admin|member)$/);

    await page.goto("/admin/group-mock");
    await expect(page.getByRole("heading", { name: "Group Mock", level: 1 })).toBeVisible();
    await expect(page.getByText("Community investment decision", { exact: true })).toBeVisible();
    await expect(page.getByText("Thursday group exercise", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Create case" }).click();
    await page.getByLabel("Internal key").fill(`invalid_debrief_${suffix}`);
    await page.getByLabel("Title").fill("Validation example");
    await page.getByLabel("Short summary").fill("A safe validation fixture.");
    await page
      .getByLabel("Candidate brief and context")
      .fill("A fictional organisation must choose between several projects.");
    await page
      .getByLabel("Working instructions")
      .fill("Read the information and agree a recommendation as a group.");
    await page
      .getByLabel("Flexible case pack (Markdown)")
      .fill("Each fictional option has a different cost, reach and delivery risk.");
    await page.getByLabel("Required output").fill("Present one recommendation.");
    await page
      .getByLabel("Facilitator and observer guide")
      .fill("Observe inclusion, evidence, reasoning and time management.");
    await page.getByLabel("Debrief questions").fill("Only one question?");
    await page.getByLabel(/I confirm this is original OfferLab material/).check();
    await page.getByRole("button", { name: "Create material" }).click();
    await expect(page.locator("p.error-summary[role='alert']")).toContainText(
      "debrief questions (enter at least two, one per line)",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
    ).toBe(false);

    await database`update app."user" set role='member' where id=${ownerId}::uuid`;
    await page.goto("/member/learn/practice");
    await page.getByRole("link", { name: "Browse 100 practice cases" }).click();
    await expect(page.getByRole("heading", { name: "Group exercise case library" })).toBeVisible();
    await expect(page.getByText("Showing 101 of 101 cases")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
    ).toBe(false);
    await page.goto("/member/learn/practice");
    const room = page
      .locator("article.group-mock-room")
      .filter({ hasText: "Thursday group exercise" });
    await expect(room.getByText("0 of 6 seats")).toBeVisible();
    await room.getByLabel("I confirm I am 18 or over.").check();
    await room.getByLabel(/I will not record/).check();
    await room.getByRole("button", { name: "Reserve seat" }).click();
    await expect(page.getByRole("status")).toContainText("seat is confirmed");
    await expect(room.getByText("Your status: confirmed")).toBeVisible();
    await expect(room.getByRole("link", { name: "View session material" })).toBeVisible();
    await expect(room.getByRole("link", { name: "Enter meeting" })).toHaveCount(0);
    await room.getByRole("link", { name: "View session material" }).click();
    await expect(
      page.getByRole("heading", { name: "Community investment decision" }),
    ).toBeVisible();
    await expect(page.getByText("A fictional organisation has limited funding")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
    ).toBe(false);
  } finally {
    if (ownerId) {
      await database`delete from app.audit_event where actor_user_id=${ownerId}::uuid`;
      await database`delete from app.group_mock_session_meeting where session_id=${sessionId || null}::uuid`;
      await database`delete from app.group_mock_booking where owner_user_id=${ownerId}::uuid`;
      await database`delete from app.group_mock_session where id=${sessionId || null}::uuid`;
      await database`delete from app.group_mock_material where id=${materialId || null}::uuid`;
      await database`delete from app.onboarding_profile where user_id=${ownerId}::uuid`;
      await database`delete from app.beta_entitlement where user_id=${ownerId}::uuid`;
      await database`delete from app."user" where id=${ownerId}::uuid`;
    }
    if (priorAdministratorId)
      await database`update app."user" set role='administrator' where id=${priorAdministratorId}::uuid`;
    if (authId) await database`delete from auth.users where id=${authId}::uuid`;
    await database.end();
  }
});
