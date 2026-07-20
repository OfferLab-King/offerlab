import { createHmac, createPrivateKey, sign } from "node:crypto";
import type { JsonWebKey as NodeJsonWebKey } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import postgres from "postgres";

import { createInvitation } from "../src/modules/identity-access/infrastructure/invitations";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const mailpitUrl = "http://127.0.0.1:55324";
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";

type MailSummary = Readonly<{
  ID: string;
  Subject: string;
  To: readonly Readonly<{ Address: string }>[];
}>;

function encodeSessionCookie(session: Record<string, unknown>): string {
  return `base64-${Buffer.from(JSON.stringify(session), "utf8").toString("base64url")}`;
}

function decodeSessionCookie(value: string): Record<string, unknown> {
  if (!value.startsWith("base64-")) throw new Error("Unexpected Supabase session encoding.");
  return JSON.parse(
    Buffer.from(value.slice("base64-".length), "base64url").toString("utf8"),
  ) as Record<string, unknown>;
}

function expireAccessToken(accessToken: string): string {
  const signingKeys = process.env.TEST_SUPABASE_SIGNING_KEYS;
  if (!signingKeys) throw new Error("Local Supabase JWT test configuration missing.");
  const [encodedHeader, encodedPayload] = accessToken.split(".");
  if (!encodedHeader || !encodedPayload) throw new Error("Unexpected access-token encoding.");
  const header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8")) as {
    alg?: unknown;
    kid?: unknown;
  };
  if (header.alg !== "ES256" || typeof header.kid !== "string") {
    throw new Error("Unexpected local access-token signing algorithm.");
  }
  const key = (JSON.parse(signingKeys) as (NodeJsonWebKey & { kid?: string })[]).find(
    (candidate) => candidate.kid === header.kid,
  );
  if (!key) throw new Error("Local Supabase signing key did not match the access token.");
  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Record<
    string,
    unknown
  >;
  payload.exp = Math.floor(Date.now() / 1000) - 60;
  const expiredPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signingInput = `${encodedHeader}.${expiredPayload}`;
  const signature = sign("sha256", Buffer.from(signingInput), {
    dsaEncoding: "ieee-p1363",
    key: createPrivateKey({ format: "jwk", key }),
  }).toString("base64url");
  return `${signingInput}.${signature}`;
}

async function latestEmailLink(email: string, subjectIncludes: string): Promise<string> {
  let messageId = "";
  await expect
    .poll(
      async () => {
        const response = await fetch(`${mailpitUrl}/api/v1/messages`);
        const mailbox = (await response.json()) as { messages: MailSummary[] };
        const message = mailbox.messages.find(
          (candidate) =>
            candidate.To.some((recipient) => recipient.Address === email) &&
            candidate.Subject.toLowerCase().includes(subjectIncludes.toLowerCase()),
        );
        messageId = message?.ID ?? "";
        return messageId;
      },
      { timeout: 15_000 },
    )
    .not.toBe("");

  const response = await fetch(`${mailpitUrl}/api/v1/message/${messageId}`);
  const message = (await response.json()) as { HTML: string };
  const links = [...message.HTML.matchAll(/href=["']([^"']+)["']/g)].map((match) =>
    (match[1] ?? "").replaceAll("&amp;", "&"),
  );
  const link = links.find(
    (candidate) => candidate.includes("/auth/v1/verify") || candidate.includes("/auth/callback"),
  );
  if (!link) throw new Error("Captured Supabase email did not contain a verification link.");
  return link;
}

test("invite-only authentication and recovery journey", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const suffix = `${testInfo.project.name.replaceAll(/\W/g, "-")}-${Date.now()}`;
  const email = `invited-${suffix}@example.com`;
  const password = "StrongPassword123!";
  const newPassword = "NewStrongPassword456!";
  const database = postgres(databaseUrl, { max: 2, prepare: false });

  try {
    await page.goto("/member");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

    const invitation = await createInvitation(database, {
      email,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    await page.goto(`/register#invitation=${encodeURIComponent(invitation.token)}`);
    await page.getByLabel("Invited email").fill(email);
    await page.getByLabel("Create password").fill(password);
    const [registrationResponse] = await Promise.all([
      page.waitForResponse((response) => response.url().endsWith("/api/auth/register")),
      page.getByRole("button", { name: "Create account" }).click(),
    ]);
    expect(registrationResponse.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();
    await page.goto(await latestEmailLink(email, "confirm"));
    await expect(page.getByText(/email is verified/i)).toBeVisible();
    const linked = await database<{ entitlement: string; users: number }[]>`
      select count(app_user.id)::int as users, max(entitlement.status) as entitlement
      from app."user" as app_user
      join app.beta_entitlement as entitlement on entitlement.user_id = app_user.id
      where app_user.email = ${email}
    `;
    expect(linked[0]).toEqual({ entitlement: "active", users: 1 });

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Tell us where you’re heading" })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    const companies = page.getByLabel("Target companies");
    await companies.fill(Array.from({ length: 11 }, (_, index) => `Company ${index}`).join(","));
    await page.getByRole("button", { name: "Complete onboarding" }).click();
    const errorSummary = page.locator("#onboarding-error-summary");
    await expect(errorSummary).toBeFocused();
    await expect(errorSummary).toHaveAttribute("role", "alert");
    await expect(companies).toHaveAttribute("aria-invalid", "true");
    await expect(companies).toHaveAttribute(
      "aria-describedby",
      /targetCompanies-hint targetCompanies-error/,
    );
    await expect(page.locator("#targetCompanies-error")).toBeVisible();
    await companies.fill("Example Plc");
    await expect(companies).toHaveAttribute("aria-invalid", "false");
    await expect(page.locator("#targetCompanies-error")).toHaveCount(0);

    await page.getByRole("button", { name: "Complete onboarding" }).click();
    await expect(errorSummary).toBeFocused();
    const undergraduate = page.getByLabel("Undergraduate");
    await expect(page.locator("#educationStage-group")).toHaveAttribute("aria-invalid", "true");
    await errorSummary
      .getByRole("link", { name: "Choose your education or career stage." })
      .click();
    await expect(undergraduate).toBeFocused();
    await expect(undergraduate).toHaveAttribute("aria-invalid", "true");
    const educationDescription = await undergraduate.getAttribute("aria-describedby");
    expect(educationDescription).toBe("educationStage-error");
    await expect(page.locator(`#${educationDescription}`)).toBeVisible();
    await expect(errorSummary).toContainText("Choose at least one opportunity type");

    await undergraduate.check();
    await expect(undergraduate).toHaveAttribute("aria-invalid", "false");
    await expect(page.locator("#educationStage-error")).toHaveCount(0);

    const graduateScheme = page.getByLabel("Graduate scheme");
    await errorSummary.getByRole("link", { name: "Choose at least one opportunity type." }).click();
    await expect(graduateScheme).toBeFocused();
    await expect(graduateScheme).toHaveAttribute("aria-invalid", "true");
    await expect(graduateScheme).toHaveAttribute(
      "aria-describedby",
      /opportunityTypes-description opportunityTypes-error/,
    );
    await graduateScheme.check();
    await expect(graduateScheme).toHaveAttribute("aria-invalid", "false");
    await expect(page.locator("#opportunityTypes-error")).toHaveCount(0);

    const consulting = page.getByLabel("Consulting");
    await errorSummary.getByRole("link", { name: "Choose at least one target industry." }).click();
    await expect(consulting).toBeFocused();
    await expect(consulting).toHaveAttribute("aria-invalid", "true");
    await consulting.check();
    await expect(consulting).toHaveAttribute("aria-invalid", "false");
    await expect(page.locator("#industries-error")).toHaveCount(0);

    await page.getByRole("button", { name: "Save and finish later" }).click();
    await expect(page.getByText(/progress has been saved/i)).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Undergraduate")).toBeChecked();
    await page.getByLabel("Graduate scheme").check();
    await page.getByLabel("Consulting").check();
    await page.getByLabel("Applications and CV").check();
    await page.getByLabel("Target companies").fill(" Example Plc, example plc\nAcme UK ");
    await page.getByRole("button", { name: "Complete onboarding" }).click();
    await page.waitForURL("**/member");
    await expect(
      page.getByRole("heading", { name: "You’re ready for what comes next" }),
    ).toBeVisible();
    await page.getByRole("link", { name: /review or update/i }).click();
    await page.getByLabel("I feel confident overall").check();
    await page.getByRole("button", { name: "Update profile" }).click();
    await expect(page.getByText(/profile changes have been saved/i)).toBeVisible();
    await expect(page).toHaveURL(/\/member\/onboarding$/);

    const authCookies = (await page.context().cookies(page.url())).filter(
      ({ name }) => name.includes("-auth-token") && !name.includes("code-verifier"),
    );
    expect(authCookies).toHaveLength(1);
    const session = decodeSessionCookie(authCookies[0]?.value ?? "");
    if (typeof session.access_token !== "string") {
      throw new Error("Supabase session did not include an access token.");
    }
    session.access_token = expireAccessToken(session.access_token);
    session.expires_at = Math.floor(Date.now() / 1000) - 60;
    session.expires_in = 0;
    await page.context().addCookies([
      {
        ...authCookies[0]!,
        value: encodeSessionCookie(session),
      },
    ]);
    const refreshedResponse = await page.goto("/member");
    await expect(
      page.getByRole("heading", { name: "You’re ready for what comes next" }),
    ).toBeVisible();
    expect(refreshedResponse?.headers()["cache-control"]).not.toContain("public");
    expect(refreshedResponse?.headers()["vercel-cdn-cache-control"]).toContain("no-store");
    const rotatedCookies = (await page.context().cookies(page.url())).filter(
      ({ name }) => name.includes("-auth-token") && !name.includes("code-verifier"),
    );
    expect(rotatedCookies[0]?.value).not.toBe(encodeSessionCookie(session));

    await page.getByRole("link", { name: "Administration" }).click();
    await expect(page.getByRole("heading", { name: "Access denied" })).toBeVisible();
    await page.getByRole("link", { name: "Return to member area" }).click();

    const internalUsers = await database<{ id: string }[]>`
      select id from app."user" where email = ${email}
    `;
    const internalUserId = internalUsers[0]?.id;
    if (!internalUserId) throw new Error("Linked internal test user was not found.");
    await database`
      update app.beta_entitlement
      set status = 'revoked', revoked_at = now(), updated_at = now()
      where user_id = ${internalUserId}::uuid
    `;
    await page.goto("/member");
    await expect(page.getByRole("heading", { name: "Beta access unavailable" })).toBeVisible();
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Beta access unavailable" })).toBeVisible();
    await database`
      update app.beta_entitlement
      set status = 'active', revoked_at = null, updated_at = now()
      where user_id = ${internalUserId}::uuid
    `;
    await database`update app."user" set role = 'administrator' where id = ${internalUserId}::uuid`;
    await page.goto("/member");
    await expect(
      page.getByRole("heading", { name: "You’re ready for what comes next" }),
    ).toBeVisible();
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "OfferLab administration" })).toBeVisible();
    await database`
      update app.beta_entitlement
      set status = 'revoked', revoked_at = now(), updated_at = now()
      where user_id = ${internalUserId}::uuid
    `;
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Beta access unavailable" })).toBeVisible();
    await page.goto("/member");
    await expect(page.getByRole("heading", { name: "Beta access unavailable" })).toBeVisible();
    await database`
      update app.beta_entitlement
      set status = 'active', revoked_at = null, updated_at = now()
      where user_id = ${internalUserId}::uuid
    `;
    await database`update app."user" set role = 'member' where id = ${internalUserId}::uuid`;
    await page.goto("/member");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(
      page.getByRole("heading", { name: "You’re ready for what comes next" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Sign out" }).click();

    await page.getByRole("link", { name: "Forgot your password?" }).click();
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText(/recovery instructions have been sent/i)).toBeVisible();
    await page.goto(await latestEmailLink(email, "reset"));
    await expect(page.getByRole("heading", { name: "Set new password" })).toBeVisible();
    expect(
      (await page.context().cookies(page.url())).some(
        ({ name }) => name.includes("-auth-token") && !name.includes("code-verifier"),
      ),
    ).toBe(true);
    await page.getByLabel("New password").fill(newPassword);
    const [updateResponse] = await Promise.all([
      page.waitForResponse((response) => response.url().endsWith("/api/auth/update-password")),
      page.getByRole("button", { name: "Set new password" }).click(),
    ]);
    expect(updateResponse.status()).toBe(200);
    await expect(page.getByText(/password has been updated/i)).toBeVisible();
    const replay = await page.evaluate(async (passwordToReplay) => {
      const response = await fetch("/api/auth/update-password", {
        body: JSON.stringify({ password: passwordToReplay }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      return { body: await response.json(), status: response.status };
    }, newPassword);
    expect([400, 401]).toContain(replay.status);
    expect(replay.body).toEqual({ updated: false });

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(newPassword);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(
      page.getByRole("heading", { name: "You’re ready for what comes next" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Sign out" }).click();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !publishableKey)
      throw new Error("Local Supabase E2E configuration missing.");
    const publicClient = createClient(supabaseUrl, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const uninvitedEmail = `uninvited-${suffix}@example.com`;
    const { error: createError } = await publicClient.auth.signUp({
      email: uninvitedEmail,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/member`,
      },
    });
    expect(createError).toBeNull();
    await page.goto(await latestEmailLink(uninvitedEmail, "confirm"));
    await expect(page.getByText(/unable to verify that link/i)).toBeVisible();
    await page.getByLabel("Email").fill(uninvitedEmail);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Beta access unavailable" })).toBeVisible();
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Beta access unavailable" })).toBeVisible();
    await page.getByRole("button", { name: "Sign out" }).click();

    const unverifiedEmail = `unverified-${suffix}@example.com`;
    const unverifiedInvitation = await createInvitation(database, {
      email: unverifiedEmail,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    await page.goto(`/register#invitation=${encodeURIComponent(unverifiedInvitation.token)}`);
    await page.getByLabel("Invited email").fill(unverifiedEmail);
    await page.getByLabel("Create password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();
    await page.getByLabel("Email").fill(unverifiedEmail);
    await page.getByRole("button", { name: "Resend verification" }).click();
    await expect(page.getByText(/account is eligible/i)).toBeVisible();
    await page.goto("/member");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    const unlinked = await database<{ count: number }[]>`
      select count(*)::int as count from app."user" where email = ${unverifiedEmail}
    `;
    expect(unlinked[0]?.count).toBe(0);
  } finally {
    await database`delete from app.auth_rate_limit where action = 'registration'`;
    await database.end();
  }
});

test("direct onboarding endpoint preserves authenticated ownership", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "One real direct-endpoint integration run is sufficient.",
  );
  test.setTimeout(60_000);
  const database = postgres(databaseUrl, { max: 2, prepare: false });
  const suffix = `direct-${Date.now()}`;
  const password = "StrongPassword123!";

  async function registerAndSignIn(email: string): Promise<void> {
    const invitation = await createInvitation(database, {
      email,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    await page.goto(`/register#invitation=${encodeURIComponent(invitation.token)}`);
    await page.getByLabel("Invited email").fill(email);
    await page.getByLabel("Create password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await page.goto(await latestEmailLink(email, "confirm"));
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Tell us where you’re heading" })).toBeVisible();
  }

  try {
    const ownerEmail = `owner-${suffix}@example.com`;
    await registerAndSignIn(ownerEmail);
    const payload = {
      confidence: null,
      educationStage: "recent_graduate",
      industries: ["technology"],
      intent: "complete",
      opportunityTypes: ["entry_level_role"],
      preparationPriorities: ["application_planning"],
      supportNeeds: [],
      targetCompanies: ["Example Technology Plc"],
    };
    const completion = await page.evaluate(async (body) => {
      const response = await fetch("/api/member/onboarding", {
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
        method: "PUT",
      });
      return { body: await response.json(), status: response.status };
    }, payload);
    expect(completion).toMatchObject({
      body: { completed: true, outcome: "completed" },
      status: 200,
    });

    const ownerRows = await database<{ id: string }[]>`
      select id from app."user" where email = ${ownerEmail}
    `;
    const ownerId = ownerRows[0]?.id;
    if (!ownerId) throw new Error("Direct-endpoint owner was not linked.");
    const persisted = await database<
      { audits: number; profiles: number; target_companies: string[] }[]
    >`
      select
        (select count(*)::int from app.onboarding_profile where user_id = ${ownerId}::uuid)
          as profiles,
        (select target_companies from app.onboarding_profile where user_id = ${ownerId}::uuid)
          as target_companies,
        (
          select count(*)::int from app.audit_event
          where entity_id = ${ownerId}::uuid and action = 'onboarding.completed'
        ) as audits
    `;
    expect(persisted).toEqual([
      { audits: 1, profiles: 1, target_companies: ["Example Technology Plc"] },
    ]);

    await page.goto("/member");
    await page.getByRole("button", { name: "Sign out" }).click();
    const secondEmail = `second-${suffix}@example.com`;
    await registerAndSignIn(secondEmail);
    const crossUserAttempt = await page.evaluate(async (firstOwnerId) => {
      const read = await fetch(`/api/member/onboarding?userId=${encodeURIComponent(firstOwnerId)}`);
      const write = await fetch("/api/member/onboarding", {
        body: JSON.stringify({
          confidence: null,
          educationStage: "recent_graduate",
          industries: ["technology"],
          intent: "complete",
          opportunityTypes: ["entry_level_role"],
          preparationPriorities: ["application_planning"],
          supportNeeds: [],
          targetCompanies: [],
          userId: firstOwnerId,
        }),
        headers: { "content-type": "application/json" },
        method: "PUT",
      });
      return {
        readBody: await read.json(),
        readStatus: read.status,
        writeStatus: write.status,
      };
    }, ownerId);
    expect(crossUserAttempt).toEqual({
      readBody: { profile: null },
      readStatus: 200,
      writeStatus: 422,
    });
    const ownerStillIsolated = await database<{ count: number }[]>`
      select count(*)::int as count
      from app.onboarding_profile
      where user_id = ${ownerId}::uuid
        and target_companies = array['Example Technology Plc']::text[]
    `;
    expect(ownerStillIsolated).toEqual([{ count: 1 }]);
  } finally {
    await database`delete from app.auth_rate_limit where action = 'registration'`;
    await database.end();
  }
});

test("auth surfaces enforce private headers, generic limits and no secondary reset credential", async ({
  page,
  request,
}, testInfo) => {
  const registerResponse = await page.goto("/register#invitation=not-a-real-secret");
  expect(registerResponse?.headers()["cache-control"]).not.toContain("public");
  expect(registerResponse?.headers()["vercel-cdn-cache-control"]).toContain("no-store");
  expect(registerResponse?.headers()["referrer-policy"]).toBe("no-referrer");
  expect(registerResponse?.headers()["content-security-policy"]).toContain("default-src 'self'");
  await expect.poll(() => page.url()).not.toContain("invitation=");

  const callbackResponse = await request.get(
    "/auth/callback?token_hash=non-sensitive-test-value&type=recovery&next=/reset-password/update",
    { maxRedirects: 0 },
  );
  expect(callbackResponse.headers()["cache-control"]).not.toContain("public");
  expect(callbackResponse.headers()["vercel-cdn-cache-control"]).toContain("no-store");
  expect(callbackResponse.headers()["referrer-policy"]).toBe("no-referrer");
  expect(callbackResponse.headers()["content-security-policy"]).toContain("default-src 'self'");

  const recoveryResponse = await page.goto("/reset-password");
  expect(recoveryResponse?.headers()["cache-control"]).not.toContain("public");
  expect(recoveryResponse?.headers()["vercel-cdn-cache-control"]).toContain("no-store");
  expect(recoveryResponse?.headers()["referrer-policy"]).toBe("no-referrer");

  const missingSession = await request.post("/api/auth/update-password", {
    data: { password: "AnotherStrongPassword123!" },
    headers: { origin: appUrl },
  });
  expect(missingSession.status()).toBe(401);
  expect(await missingSession.json()).toEqual({ updated: false });

  const bodies: unknown[] = [];
  let limitedStatus = 0;
  let retryAfter = 0;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await request.post("/api/auth/recovery", {
      data: { email: "unknown-rate-limit@example.com" },
      headers: {
        origin: appUrl,
        "x-vercel-forwarded-for": "192.0.2.44",
      },
    });
    bodies.push(await response.json());
    if (response.status() === 429) {
      limitedStatus = response.status();
      retryAfter = Number(response.headers()["retry-after"]);
    }
  }
  expect(bodies.every((body) => JSON.stringify(body) === JSON.stringify(bodies[0]))).toBe(true);
  expect(limitedStatus).toBe(429);
  expect(retryAfter).toBeGreaterThan(0);

  const database = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    await database`
      insert into app.invitation (email, token_hash, created_at, expires_at)
      values (
        'expired-resend@example.com',
        ${createHmac("sha256", "e2e-expired-invitation").update(testInfo.project.name).digest("hex")},
        now() - interval '2 hours',
        now() - interval '1 hour'
      )
    `;
    const revoked = await createInvitation(database, {
      email: "revoked-resend@example.com",
      expiresAt: new Date(Date.now() + 60_000),
    });
    await database`update app.invitation set revoked_at = now() where id = ${revoked.id}::uuid`;
  } finally {
    await database.end();
  }
  const resendBodies: unknown[] = [];
  for (const [index, email] of [
    "unknown-resend@example.com",
    "expired-resend@example.com",
    "revoked-resend@example.com",
  ].entries()) {
    const response = await request.post("/api/auth/resend", {
      data: { email },
      headers: {
        origin: appUrl,
        "x-vercel-forwarded-for": `192.0.2.${60 + index}`,
      },
    });
    expect(response.status()).toBe(202);
    resendBodies.push(await response.json());
  }
  expect(
    resendBodies.every((body) => JSON.stringify(body) === JSON.stringify(resendBodies[0])),
  ).toBe(true);
});

test("an invalid or expired refresh token cannot authorize a member route", async ({ request }) => {
  const response = await request.get("/member", {
    headers: { cookie: "sb-localhost-auth-token=invalid-refresh-token" },
    maxRedirects: 0,
  });
  expect(response.status()).toBeGreaterThanOrEqual(300);
  expect(response.status()).toBeLessThan(400);
  expect(response.headers().location).toContain("/sign-in");
});
