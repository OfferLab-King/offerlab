import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import postgres from "postgres";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const password = "StrongPassword123!";

test("member explores the bounded Phase 1 preparation tools at 390px", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "This focused responsive journey runs once.");
  const database = postgres(databaseUrl, { prepare: false });
  const suffix = `${Date.now()}`;
  const email = `phase-one-${suffix}@example.com`;
  const questionKey = `phase_one_question_${suffix}`;
  let authId = "";
  let ownerId = "";
  let questionId = "";
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Supabase configuration missing");
    const client = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const signup = await client.auth.signUp({ email, password });
    authId = signup.data.user?.id ?? "";
    await database`update auth.users set email_confirmed_at=now(),updated_at=now() where id=${authId}::uuid`;
    ownerId = (
      await database<
        { id: string }[]
      >`insert into app."user"(auth_user_id,email,role) values(${authId}::uuid,${email},'administrator') returning id`
    )[0]!.id;
    await database`insert into app.beta_entitlement(user_id,status,activated_at,updated_at) values(${ownerId}::uuid,'active',now(),now())`;
    await database`insert into app.onboarding_profile(user_id,education_stage,opportunity_types,industries,preparation_priorities,completed_at) values(${ownerId}::uuid,'recent_graduate',array['graduate_scheme'],array['consulting'],array['behavioural_interview'],now())`;
    questionId = (
      await database<
        { id: string }[]
      >`insert into app.interview_question(stable_key,question_family,prompt,guidance,position) values(${questionKey},'competency_and_behavioural','Describe a time you helped a team decide.','Use a specific example.',990001) returning id`
    )[0]!.id;
    const storyId = (
      await database<
        { id: string }[]
      >`insert into app.member_story(owner_user_id,title,experience_type,situation,task,actions,reasoning,result,reflection,ready_at) values(${ownerId}::uuid,'Phase One team decision','society','The group had limited time.','Reach a recommendation.','I proposed criteria and invited views.','A shared structure made trade-offs visible.','The group agreed a recommendation.','I would invite quieter voices earlier.',now()) returning id`
    )[0]!.id;
    const answerId = (
      await database<
        { id: string }[]
      >`insert into app.member_answer(owner_user_id,question_id,question_family,title,key_points,draft_answer,ready_at) values(${ownerId}::uuid,${questionId}::uuid,'competency_and_behavioural','Helping a team decide','Criteria, inclusion and trade-offs','I proposed three clear criteria, invited each person to test the options and helped the group reach a reasoned recommendation.',now()) returning id`
    )[0]!.id;
    await database`insert into app.member_answer_story(owner_user_id,answer_id,story_id,position) values(${ownerId}::uuid,${answerId}::uuid,${storyId}::uuid,1)`;

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/(admin|member)$/);

    await page.goto("/admin/content?type=coaching_case");
    await expect(page.getByRole("navigation", { name: "Content management" })).toBeVisible();
    const coachingCaseRow = page
      .locator("article.cms-content-row")
      .filter({ hasText: "Before and after: making teamwork evidence specific" });
    const editHref = await coachingCaseRow.getByRole("link", { name: "Edit" }).getAttribute("href");
    if (!editHref) throw new Error("Coaching-case edit link missing.");
    await page.goto(editHref);
    await expect(
      page.getByRole("heading", { name: "Build the annotated before-and-after" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Add comment to selection" })).toBeVisible();
    await expect(page.getByText("Coaching-case detail (validated JSON)")).toHaveCount(0);
    await expect(page.getByText(/Synthetic examples must not contain real student/)).toBeVisible();
    await expect(page.getByText(/I confirm this material is authorised/)).toHaveCount(0);
    await page
      .getByLabel("Source")
      .selectOption({ label: "Anonymised and approved previous work" });
    await expect(page.getByText(/I confirm this material is authorised/)).toBeVisible();
    await page.getByLabel("Source").selectOption({ label: "Synthetic teaching example" });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
    ).toBe(false);

    await page.goto("/member/learn");
    await expect(
      page.getByRole("heading", { name: "Go beyond generic preparation" }),
    ).toBeVisible();

    await page
      .getByRole("navigation", { name: "Prepare" })
      .getByRole("link", { name: "Coaching Cases" })
      .click();
    await expect(page.getByRole("heading", { name: "Annotated Coaching Cases" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Demonstration case/ })).toBeVisible();
    await page
      .getByRole("link", { name: "Before and after: making teamwork evidence specific" })
      .click();
    await expect(
      page.getByRole("heading", { name: "See the edit and the reasoning" }),
    ).toBeVisible();
    await expect(
      page.getByRole("article", { name: "Answer with tracked changes" }).locator("del"),
    ).toHaveCount(3);
    await expect(
      page.getByRole("article", { name: "Answer with tracked changes" }).locator("ins"),
    ).toHaveCount(3);
    await page.getByRole("button", { name: "Jump to change" }).first().click();
    await expect(page.locator("[data-case-change='individual_action']")).toHaveClass(/is-selected/);
    await page.getByRole("button", { name: "Original only" }).click();
    await expect(page.getByRole("article", { name: "Original answer" }).locator("ins")).toHaveCount(
      0,
    );
    await expect(page.getByRole("heading", { name: "Common mistakes shown here" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Why the revised answer is stronger" }),
    ).toBeVisible();
    await page
      .getByRole("navigation", { name: "Prepare" })
      .getByRole("link", { name: "Coaching Cases" })
      .click();

    await page
      .getByRole("navigation", { name: "Prepare" })
      .getByRole("link", { name: "Answer Bank" })
      .click();
    await page.getByRole("link", { name: "Questions" }).click();
    await expect(page.getByRole("heading", { name: "Top 10 interview questions" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Competency collection" })).toHaveAttribute(
      "href",
      "?family=competency_and_behavioural",
    );

    await page.goto(`/member/learn/answer-bank/answers/${answerId}`);
    await expect(page.getByText(/local fallback sends nothing to an AI provider/i)).toBeVisible();
    await page.getByRole("button", { name: "Review this answer" }).click();
    await expect(page.getByRole("dialog", { name: "Coaching comments" })).toBeVisible();
    await expect(page.locator(".coach-category").first()).toBeVisible();
    await page.getByRole("button", { name: "Close comments" }).first().click();

    await page
      .getByRole("navigation", { name: "Prepare" })
      .getByRole("link", { name: "Practice & Feedback" })
      .click();
    await page
      .locator("article")
      .filter({ hasText: "Group Mock pilot" })
      .getByRole("button", { name: "Register interest" })
      .click();
    await expect(page.getByText("Request received")).toBeVisible();
    await expect(page.locator("article").filter({ hasText: "Group Mock pilot" })).toContainText(
      "requested",
    );

    await page
      .getByRole("navigation", { name: "Prepare" })
      .getByRole("link", { name: "Intelligence" })
      .click();
    await page.getByText("Share a recent experience").click();
    await page.getByLabel("Recruitment cycle").fill("2026/27");
    await page.getByLabel("Approximate date").fill("2026-07-20");
    await page.getByLabel("Recruitment stage").selectOption("assessment_centre");
    await page.getByLabel("Format summary").fill("Timed group discussion and recommendation");
    await page
      .getByLabel("Themes (not exact questions)")
      .fill("Prioritisation, trade-offs and inclusive discussion.");
    await page
      .getByLabel("Skills assessed (comma-separated)")
      .fill("Communication, Prioritisation");
    await page
      .getByLabel("What would help another candidate prepare?")
      .fill("Practise stating criteria early and making space for quieter contributors.");
    await page.getByRole("button", { name: "Submit for moderation" }).click();
    await expect(page.getByText("Report submitted for moderation")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your reports" })).toBeVisible();

    await page.goto("/admin/operations");
    await expect(
      page
        .getByRole("navigation", { name: "Content management" })
        .getByRole("link", { name: "Operations" }),
    ).toHaveAttribute("aria-current", "page");
    const reportCard = page
      .locator("article")
      .filter({ hasText: "Timed group discussion and recommendation" });
    await reportCard.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText("Update saved")).toBeVisible();
    await page.goto("/member/learn/intelligence");
    await expect(
      page.getByRole("heading", { name: "Timed group discussion and recommendation" }),
    ).toBeVisible();

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
    ).toBe(false);
  } finally {
    if (ownerId) {
      await database`delete from app.audit_event where actor_user_id=${ownerId}::uuid`;
      await database`delete from app.service_request where owner_user_id=${ownerId}::uuid`;
      await database`delete from app.recruitment_intelligence_report where owner_user_id=${ownerId}::uuid`;
      await database`delete from app.answer_coach_comment where owner_user_id=${ownerId}::uuid`;
      await database`delete from app.answer_coach_review where owner_user_id=${ownerId}::uuid`;
      await database`delete from app.member_answer_story where owner_user_id=${ownerId}::uuid`;
      await database`delete from app.member_answer where owner_user_id=${ownerId}::uuid`;
      await database`delete from app.member_story_competency where owner_user_id=${ownerId}::uuid`;
      await database`delete from app.member_story where owner_user_id=${ownerId}::uuid`;
      await database`delete from app.onboarding_profile where user_id=${ownerId}::uuid`;
      await database`delete from app.beta_entitlement where user_id=${ownerId}::uuid`;
      await database`delete from app."user" where id=${ownerId}::uuid`;
    }
    if (questionId) await database`delete from app.interview_question where id=${questionId}::uuid`;
    if (authId) await database`delete from auth.users where id=${authId}::uuid`;
    await database.end();
  }
});
