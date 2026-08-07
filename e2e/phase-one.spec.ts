import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import postgres from "postgres";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const password = "StrongPassword123!";

test("member explores the bounded Phase 1 preparation tools at 390px", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  test.skip(testInfo.project.name !== "chromium", "This focused responsive journey runs once.");
  const database = postgres(databaseUrl, { prepare: false });
  const suffix = `${Date.now()}`;
  const email = `phase-one-${suffix}@example.com`;
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
      >`select id from app.interview_question where stable_key='teamwork' and active=true`
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
    await expect(page.getByRole("heading", { name: "Edit the member view" })).toBeVisible();
    await expect(page.locator(".cms-member-canvas .resource-content")).toBeVisible();
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

    await database`update app."user" set role='member' where id=${ownerId}::uuid`;
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
    const resourceContentBox = await page.locator(".resource-content").first().boundingBox();
    const coachingCaseBox = await page.locator(".coaching-case-review").boundingBox();
    const resourceActionsBox = await page
      .getByRole("region", { name: "Resource actions" })
      .boundingBox();
    expect(resourceContentBox).not.toBeNull();
    expect(coachingCaseBox).not.toBeNull();
    expect(resourceActionsBox).not.toBeNull();
    expect(Math.abs(resourceContentBox!.x - coachingCaseBox!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(resourceContentBox!.x - resourceActionsBox!.x)).toBeLessThanOrEqual(1);
    await expect(
      page.getByRole("article", { name: "Answer with tracked changes" }).locator("del"),
    ).toHaveCount(3);
    await expect(
      page.getByRole("article", { name: "Answer with tracked changes" }).locator("ins"),
    ).toHaveCount(3);
    const commentHues = await page
      .locator("[data-case-comment]")
      .evaluateAll((comments) =>
        comments.map((comment) =>
          (comment as HTMLElement).style.getPropertyValue("--case-comment-hue"),
        ),
      );
    expect(new Set(commentHues).size).toBe(commentHues.length);
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
    await expect(
      page.getByRole("heading", { name: "Prepare your interview answers" }),
    ).toBeVisible();
    await expect(page.locator(".simple-question")).toHaveCount(14);
    await expect(page.getByRole("heading", { name: "10 competency questions" })).toBeVisible();

    await page.goto(`/member/learn/answer-bank/answers/${answerId}`);
    await expect(page.getByText(/local fallback sends nothing to an AI provider/i)).toBeVisible();
    await page.getByRole("button", { name: "Review this answer" }).click();
    await expect(page.getByRole("dialog", { name: "Coaching comments" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator(".coach-category").first()).toBeVisible();
    await page.getByRole("button", { name: "Close comments" }).first().click();

    await page.goto("/member/learn/practice");
    await expect(page.getByRole("heading", { name: "Practice & Feedback" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Choose a practice room" })).toBeVisible();
    await expect(page.getByText("No rooms are scheduled yet")).toBeVisible();

    await page.goto("/member/learn/intelligence/share");
    await expect(
      page.getByRole("heading", { name: "Share a recruitment experience" }),
    ).toBeVisible();
    await page.getByLabel("Employer").fill("Example employer");
    await page.getByLabel("Role or programme").fill("Audit graduate programme");
    await page.getByLabel("Recruitment cycle").fill("2026/27");
    await page.getByLabel("Approximate date").fill("2026-07-20");
    await page.getByLabel("Recruitment stage").selectOption("assessment_centre");
    await page.getByLabel("Format summary").fill("Timed group discussion and recommendation");
    await page
      .getByLabel("General themes—not exact questions")
      .fill("Prioritisation, trade-offs and inclusive discussion.");
    await page.getByLabel("Skills assessed").fill("Communication, Prioritisation");
    await page
      .getByLabel("Your reflection")
      .fill("The strongest contributions made comparison criteria explicit.");
    await page
      .getByLabel("What would help someone prepare?")
      .fill("Practise stating criteria early and making space for quieter contributors.");
    await page.getByLabel(/I confirm this report is my experience/).check();
    const invalidFields = await page
      .locator(".intelligence-report-form :invalid")
      .evaluateAll((fields) => fields.map((field) => (field as HTMLInputElement).name));
    expect(invalidFields).toEqual([]);
    await page.getByRole("button", { name: "Submit for moderation" }).click();
    await expect(page).toHaveURL(/\/member\/learn\/intelligence\?result=submitted$/, {
      timeout: 30_000,
    });
    await expect(page.getByText("Report submitted for moderation")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your submissions" })).toBeVisible();

    await database`update app."user" set role='administrator' where id=${ownerId}::uuid`;
    await page.goto("/admin/intelligence");
    await expect(
      page
        .getByRole("navigation", { name: "Content management" })
        .getByRole("link", { name: "Intelligence" }),
    ).toHaveAttribute("aria-current", "page");
    const reportCard = page
      .locator("article")
      .filter({ hasText: "Timed group discussion and recommendation" });
    await reportCard.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText("Report status updated")).toBeVisible();
    const publicHref = await page
      .locator("article")
      .filter({ hasText: "Timed group discussion and recommendation" })
      .getByRole("link", { name: "Public preview" })
      .getAttribute("href");
    expect(publicHref).toMatch(/^\/intelligence\//);
    await page.goto(publicHref!);
    await expect(
      page.getByRole("heading", { name: /Example employer.*Assessment centre/ }),
    ).toBeVisible();
    await expect(
      page.getByText("See assessed skills, reflection and preparation advice"),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Member discussion" })).toHaveCount(0);
    await page.goto("/member/learn/intelligence");
    await expect(page.getByRole("heading", { name: "Example employer" })).toBeVisible();
    await page
      .locator("article")
      .filter({ hasText: "Example employer" })
      .getByRole("link", { name: "Read experience" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Ask for context and share useful experience" }),
    ).toBeVisible();
    await page
      .getByLabel("Add a comment or question")
      .fill("How did the group make space for quieter contributors?");
    await page.getByRole("button", { name: "Submit for review" }).click();
    await expect(page.getByText("Your comment is awaiting moderation.")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
    ).toBe(false);

    await page.goto("/admin/intelligence#discussion-moderation");
    const commentCard = page
      .locator("article.cms-discussion-item")
      .filter({ hasText: "How did the group make space" });
    await commentCard.getByRole("button", { name: "Publish comment" }).click();
    await expect(page.getByText("Discussion moderation updated.")).toBeVisible();
    await page.goto(publicHref!.replace("/intelligence/", "/member/learn/intelligence/"));
    await expect(
      page.getByText("How did the group make space for quieter contributors?"),
    ).toBeVisible();
    await expect(page.getByText("1 published")).toBeVisible();

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
    ).toBe(false);
  } finally {
    if (ownerId) {
      await database`delete from app.audit_event where actor_user_id=${ownerId}::uuid`;
      await database`delete from app.service_request where owner_user_id=${ownerId}::uuid`;
      await database`delete from app.recruitment_intelligence_comment_flag where owner_user_id=${ownerId}::uuid`;
      await database`delete from app.recruitment_intelligence_comment where owner_user_id=${ownerId}::uuid`;
      await database`delete from app.member_community_agreement where owner_user_id=${ownerId}::uuid`;
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
    if (authId) await database`delete from auth.users where id=${authId}::uuid`;
    await database.end();
  }
});
