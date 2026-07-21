import { expect, test } from "@playwright/test";
import postgres from "postgres";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";

test("anonymous library responses expose only accessible published content", async ({
  page,
  request,
}) => {
  const database = postgres(databaseUrl, { max: 1, prepare: false });
  const privateMarker = `PRIVATE-DRAFT-${Date.now()}`;
  const draftSlug = `e2e-private-${Date.now()}`;
  let draftId: string | undefined;
  try {
    const rows = await database<
      { id: string }[]
    >`insert into app.preparation_resource(resource_key,slug,title,short_description,resource_type,access_level,publication_state,markdown_body,primary_category_id) select ${`e2e_${Date.now()}`},${draftSlug},${privateMarker},'Must not leak','guide','public','draft','Highly private draft body',id from app.content_category where slug='applications' returning id`;
    draftId = rows[0]?.id;
    await page.goto("/learn/application-planning-checklist");
    await expect(
      page.getByRole("heading", { name: "Application planning checklist" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    const memberOnly = await request.get("/learn/video-interview-preparation");
    expect(memberOnly.status()).toBe(404);
    const memberBody = await memberOnly.text();
    expect(memberBody).not.toContain("Prepare concise answers");
    expect(memberBody).not.toContain("Prepare with purpose");
    const draft = await request.get(`/learn/${draftSlug}`);
    const draftBody = await draft.text();
    expect(draft.status()).toBe(404);
    expect(draftBody).not.toContain(privateMarker);
    expect(draftBody).not.toContain("Highly private draft body");
  } finally {
    if (draftId) await database`delete from app.preparation_resource where id=${draftId}::uuid`;
    await database.end();
  }
});
