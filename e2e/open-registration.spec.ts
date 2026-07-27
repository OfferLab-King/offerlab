import { expect, test } from "@playwright/test";
import postgres from "postgres";
const databaseUrl =
    process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres",
  mailpit = "http://127.0.0.1:55324";
async function confirmationLink(email: string) {
  let id = "";
  await expect
    .poll(
      async () => {
        const box = (await (await fetch(`${mailpit}/api/v1/messages`)).json()) as {
          messages: { ID: string; Subject: string; To: { Address: string }[] }[];
        };
        id =
          box.messages.find(
            (x) =>
              x.To.some((to) => to.Address === email) &&
              x.Subject.toLowerCase().includes("confirm"),
          )?.ID ?? "";
        return id;
      },
      { timeout: 15000 },
    )
    .not.toBe("");
  const message = (await (await fetch(`${mailpit}/api/v1/message/${id}`)).json()) as {
    HTML: string;
  };
  const link = [...message.HTML.matchAll(/href=["']([^"']+)["']/g)]
    .map((x) => (x[1] ?? "").replaceAll("&amp;", "&"))
    .find((x) => x.includes("/auth/v1/verify") || x.includes("/auth/callback"));
  if (!link) throw new Error("Confirmation link missing");
  return link;
}
test("a member registers openly, verifies, onboards and opens Prepare", async ({
  page,
}, testInfo) => {
  const db = postgres(databaseUrl, { prepare: false }),
    suffix = `${testInfo.project.name}-${Date.now()}`.replaceAll(/[^a-z0-9-]/g, "-"),
    email = `open-${suffix}@example.com`,
    password = "StrongPassword123!";
  let authId = "",
    ownerId = "";
  try {
    await page.goto("/register?invitation=fake-value");
    await expect(page.getByRole("heading", { name: "Create your OfferLab account" })).toBeVisible();
    await expect(page.getByText(/invitation required|invite only|invited email/i)).toHaveCount(0);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Create password").fill(password);
    const [response] = await Promise.all([
      page.waitForResponse((x) => x.url().endsWith("/api/auth/register")),
      page.getByRole("button", { name: "Create account" }).click(),
    ]);
    expect(response.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();
    await page.goto(await confirmationLink(email));
    await expect(page.getByText(/email is verified/i)).toBeVisible();
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Tell us where you’re heading" })).toBeVisible();
    const undergraduateChoice = await page.getByLabel("Undergraduate").locator("..").boundingBox();
    expect(undergraduateChoice?.height).toBeLessThanOrEqual(52);
    await page.getByLabel("Undergraduate").check();
    await page.getByLabel("Graduate scheme").check();
    await page.getByLabel("Consulting").check();
    await page.getByLabel("Applications and CV").check();
    await page.getByRole("button", { name: "Complete onboarding" }).click();
    await page.waitForURL("**/member");
    await page.getByRole("link", { name: "Prepare" }).click();
    await expect(page.getByRole("heading", { name: "Preparation Hub" })).toBeVisible();
    const state = await db<
      {
        auth_user_id: string;
        id: string;
        role: string;
        invitations: number;
        invite_audits: number;
      }[]
    >`select u.auth_user_id,u.id,u.role,(select count(*)::int from app.invitation i where i.email=u.email) invitations,(select count(*)::int from app.audit_event a where a.actor_user_id=u.id and a.action like 'invitation.%') invite_audits from app."user" u where u.email=${email}`;
    expect(state).toHaveLength(1);
    expect(state[0]).toMatchObject({ role: "member", invitations: 0, invite_audits: 0 });
    authId = state[0]!.auth_user_id;
    ownerId = state[0]!.id;
  } finally {
    if (ownerId) {
      await db`delete from app.audit_event where actor_user_id=${ownerId}::uuid`;
      await db`delete from app.onboarding_profile where user_id=${ownerId}::uuid`;
      await db`delete from app.beta_entitlement where user_id=${ownerId}::uuid`;
      await db`delete from app."user" where id=${ownerId}::uuid`;
    }
    if (authId) await db`delete from auth.users where id=${authId}::uuid`;
    await db.end();
  }
});
