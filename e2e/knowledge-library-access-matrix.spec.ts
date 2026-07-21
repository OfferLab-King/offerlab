import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import postgres, { type Sql } from "postgres";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const password = "StrongPassword123!";

type Member = { authId: string; email: string; ownerId: string };

async function createMember(
  database: Sql,
  suffix: string,
  options: {
    completed?: boolean;
    role?: "administrator" | "member";
    status?: "active" | "revoked";
  } = {},
): Promise<Member> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase E2E configuration missing.");
  const email = `library-matrix-${suffix}@example.com`;
  const client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signup = await client.auth.signUp({ email, password });
  expect(signup.error).toBeNull();
  const authId = signup.data.user?.id;
  if (!authId) throw new Error("Auth identity missing.");
  await database`update auth.users set email_confirmed_at=now(),updated_at=now() where id=${authId}::uuid`;
  const users = await database<{ id: string }[]>`
    insert into app."user"(auth_user_id,email,role)
    values(${authId}::uuid,${email},${options.role ?? "member"}) returning id`;
  const ownerId = users[0]!.id;
  await database`
    insert into app.beta_entitlement(user_id,status,activated_at,revoked_at,updated_at)
    values(${ownerId}::uuid,${options.status ?? "active"},
      now(),case when ${options.status === "revoked"} then now() else null end,now())`;
  if (options.completed === false)
    await database`insert into app.onboarding_profile(user_id) values(${ownerId}::uuid)`;
  else
    await database`
      insert into app.onboarding_profile(user_id,education_stage,opportunity_types,industries,preparation_priorities,completed_at)
      values(${ownerId}::uuid,'recent_graduate',array['graduate_scheme'],array['consulting'],array['application_cv'],clock_timestamp())`;
  return { authId, email, ownerId };
}

async function signIn(page: Page, member: Member) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(member.email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(?:admin|member|beta-access-denied)/);
}

async function cleanMember(database: Sql, member: Member) {
  await database`delete from app.audit_event where actor_user_id=${member.ownerId}::uuid`;
  await database`delete from app.member_resource_state where owner_user_id=${member.ownerId}::uuid`;
  await database`delete from app.onboarding_profile where user_id=${member.ownerId}::uuid`;
  await database`delete from app.beta_entitlement where user_id=${member.ownerId}::uuid`;
  await database`delete from app."user" where id=${member.ownerId}::uuid`;
  await database`delete from auth.users where id=${member.authId}::uuid`;
}

test("real-auth member library access, ownership, parsing, and raw-response matrix", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(120_000);
  const database = postgres(databaseUrl, { max: 2, prepare: false });
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  const resourceKeySuffix = suffix.replaceAll(/[^a-z0-9]/g, "_");
  const members: Member[] = [];
  let draftId = "";
  let archivedId = "";
  try {
    const publicRows = await database<{ id: string }[]>`
      select id from app.preparation_resource where resource_key='application_planning_checklist'`;
    const memberRows = await database<{ id: string }[]>`
      select id from app.preparation_resource where resource_key='video_interview_preparation'`;
    const publicId = publicRows[0]!.id;
    const memberId = memberRows[0]!.id;
    const fixtures = await database<{ id: string; slug: string }[]>`
      insert into app.preparation_resource(resource_key,slug,title,short_description,resource_type,access_level,publication_state,markdown_body,primary_category_id,archived_at)
      select ${`matrix_draft_${resourceKeySuffix}`},${`matrix-draft-${Date.now()}`},'PRIVATE MATRIX DRAFT','PRIVATE SUMMARY','guide','public','draft','PRIVATE MARKDOWN',id,null
      from app.content_category where slug='applications'
      union all
      select ${`matrix_archived_${resourceKeySuffix}`},${`matrix-archived-${Date.now()}`},'PRIVATE MATRIX ARCHIVE','PRIVATE ARCHIVE SUMMARY','guide','public','archived','PRIVATE ARCHIVE MARKDOWN',id,now()
      from app.content_category where slug='applications'
      returning id,slug`;
    draftId = fixtures[0]!.id;
    archivedId = fixtures[1]!.id;

    const publicResponse = await request.get("/learn/application-planning-checklist");
    expect(publicResponse.status()).toBe(200);
    expect(publicResponse.headers()["cache-control"]).toBe("no-cache, must-revalidate");
    expect(await publicResponse.text()).toContain("Application planning checklist");
    for (const slug of [
      "video-interview-preparation",
      fixtures[0]!.slug,
      fixtures[1]!.slug,
      "missing-resource",
    ])
      expect((await request.get(`/learn/${slug}`)).status()).toBe(404);

    const mutationUrl = `/api/member/resources/${memberId}/state`;
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
    for (const body of ["{bad", JSON.stringify({ padding: "x".repeat(2048) })]) {
      const response = await request.post(mutationUrl, {
        data: body,
        headers: { "content-type": "application/json", origin },
      });
      expect(response.status()).toBe(401);
      expect(await response.json()).toEqual({ error: "Access denied." });
    }

    const completed = await createMember(database, `completed-${suffix}`);
    const second = await createMember(database, `second-${suffix}`);
    const administrator = await createMember(database, `admin-${suffix}`, {
      role: "administrator",
    });
    const incomplete = await createMember(database, `incomplete-${suffix}`, { completed: false });
    const revoked = await createMember(database, `revoked-${suffix}`, { status: "revoked" });
    members.push(completed, second, administrator, incomplete, revoked);

    await signIn(page, incomplete);
    await page.goto("/member/learn");
    await expect(page).toHaveURL(/\/member\/onboarding/);
    await page.context().clearCookies();
    await signIn(page, revoked);
    await expect(page).toHaveURL(/\/beta-access-denied/);
    await page.context().clearCookies();

    await signIn(page, completed);
    const sentinel = "OFFERLAB_PRIVATE_SEARCH_SENTINEL_7F39";
    for (const query of [
      `q=${sentinel}`,
      `q=${sentinel}-NO-RESULTS`,
      `q=${sentinel.repeat(4)}`,
      `q=${sentinel}&category=interviews&stage=video_interview`,
    ]) {
      const searchResponse = await page.request.get(`/member/learn?${query}`);
      expect(searchResponse.status()).toBe(200);
      expect(await searchResponse.text()).not.toContain("server exception");
    }
    const storedSentinel = await database<{ found: boolean }[]>`
      select exists(select 1 from app.audit_event where metadata::text like ${`%${sentinel}%`}) found`;
    expect(storedSentinel).toEqual([{ found: false }]);
    await page.goto("/member/learn/video-interview-preparation");
    await expect(page.getByRole("heading", { name: "Video interview preparation" })).toBeVisible();
    const save = await page.request.post(mutationUrl, {
      data: { action: "save" },
      headers: { origin },
    });
    expect(save.status()).toBe(200);
    expect(save.headers()["cache-control"]).toContain("private, no-store");
    expect(await save.json()).toEqual({ outcome: "saved" });
    const ownerState = await database<{ id: string }[]>`
      select id from app.member_resource_state where owner_user_id=${completed.ownerId}::uuid and resource_id=${memberId}::uuid`;
    expect(ownerState).toHaveLength(1);
    await page.context().clearCookies();

    for (const other of [second, administrator]) {
      await signIn(page, other);
      const response = await page.request.post(mutationUrl, {
        data: { action: "complete" },
        headers: { origin },
      });
      expect(response.status()).toBe(200);
      const original = await database<{ saved_at: Date | null; completed_at: Date | null }[]>`
        select saved_at,completed_at from app.member_resource_state where owner_user_id=${completed.ownerId}::uuid and resource_id=${memberId}::uuid`;
      expect(original[0]!.saved_at).not.toBeNull();
      expect(original[0]!.completed_at).toBeNull();
      await page.context().clearCookies();
    }

    await signIn(page, completed);
    const missing = await page.request.post(
      "/api/member/resources/00000000-0000-4000-8000-000000000099/state",
      { data: { action: "save" }, headers: { origin } },
    );
    expect(missing.status()).toBe(404);
    expect(await missing.json()).toEqual({ outcome: "not_found" });
    const malformedId = await page.request.post("/api/member/resources/not-a-uuid/state", {
      data: { action: "save" },
      headers: { origin },
    });
    expect(malformedId.status()).toBe(404);
    expect(await malformedId.json()).toEqual({ error: "Not found." });

    for (const response of [missing, malformedId]) {
      const raw = await response.text();
      for (const prohibited of [
        memberId,
        "Video interview preparation",
        "video-interview-preparation",
        "Prepare concise answers",
        "markdown",
        "version",
        "updated_at",
      ])
        expect(raw).not.toContain(prohibited);
    }
    expect(publicId).toMatch(/^[0-9a-f-]{36}$/);
  } finally {
    for (const member of members.reverse()) await cleanMember(database, member);
    if (draftId || archivedId)
      await database`delete from app.preparation_resource where id in (${draftId || null}::uuid,${archivedId || null}::uuid)`;
    await database.end();
  }
});
