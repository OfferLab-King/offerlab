import { expect, test } from "@playwright/test";
import postgres from "postgres";

const databaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const password = "StrongPassword123!";

function syntheticPdf(text: string): Buffer {
  const escaped = text.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
  const stream = `BT\n/F1 12 Tf\n72 720 Td\n(${escaped}) Tj\nET`;
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n",
    `4 0 obj\n<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ];
  let document = "%PDF-1.4\n";
  const offsets = objects.map((object) => {
    const offset = Buffer.byteLength(document);
    document += object;
    return offset;
  });
  const xrefOffset = Buffer.byteLength(document);
  document += "xref\n0 6\n0000000000 65535 f \n";
  document += offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  document += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(document);
}

test("member uploads, versions and reviews career documents and saves a job target", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  test.skip(testInfo.project.name !== "chromium", "The responsive career journey runs once.");
  const database = postgres(databaseUrl, { prepare: false });
  const suffix = `${testInfo.project.name}-${Date.now()}`.replaceAll(/[^a-z0-9-]/g, "-");
  const email = `career-documents-${suffix}@example.com`;
  const cvTitle = `Graduate developer CV ${"TypeScript".repeat(10)}`;
  const coverLetterTitle = `Experian cover letter ${"Evidence".repeat(12)}`;
  const savedJobRole = `Graduate Software Developer ${"Accessibility".repeat(8)}`;
  let authId = "";
  let coverLetterDetailUrl = "";
  let cvDetailUrl = "";
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

    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/member$/);

    await page.goto("/member/cvs");
    await expect(page.getByRole("heading", { name: "CV workspace" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Application documents" })).toContainText(
      "Cover letters",
    );
    await page.getByLabel("Document name").fill(cvTitle);
    await page.getByLabel("CV file").setInputFiles({
      buffer: syntheticPdf(
        "Graduate developer with TypeScript, React, PostgreSQL and automated testing project experience.",
      ),
      mimeType: "application/pdf",
      name: "graduate-developer-cv.pdf",
    });
    await page.getByRole("button", { name: "Upload CV" }).click();
    await page.waitForURL(/\/member\/cvs\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { name: cvTitle })).toBeVisible();
    await expect(page.getByLabel("Extracted CV text")).toHaveValue(/TypeScript/);

    await page.getByLabel("New version name").fill("Experian developer version");
    await page
      .getByRole("textbox", { name: "Job description" })
      .fill(
        "Build accessible TypeScript and React services, work with PostgreSQL, and provide evidence of automated testing and collaboration.",
      );
    await page.getByRole("button", { name: "Save as a new version" }).click();
    await expect(page.getByLabel("Company", { exact: true })).toHaveAttribute(
      "aria-invalid",
      "true",
      { timeout: 15_000 },
    );
    await expect(page.getByLabel("Company", { exact: true })).toBeFocused();
    await expect(page.getByText("Add the company when using a job description.")).toBeVisible();
    await page.getByLabel("Company", { exact: true }).fill("Experian");
    await page.getByLabel("Role", { exact: true }).fill("Graduate Software Developer");
    await page.getByRole("button", { name: "Save as a new version" }).click();
    await expect(page.getByText(/2 immutable versions/)).toBeVisible({ timeout: 20_000 });
    cvDetailUrl = page.url();
    await page.getByRole("button", { name: "Review CV for this job" }).click();
    await expect(page.getByText("Local review", { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Document evidence coverage", { exact: true })).toBeVisible();
    await expect(page.getByText("4 of 4 assessed requirements")).toBeVisible();
    await expect(page.locator("main")).not.toContainText(
      "Make the connection to Graduate Software Developer at Experian",
    );
    await expect(page.locator("main")).not.toContainText(/\b\d{1,3}%\s*(?:ATS|match|interview)/i);

    await page.goto("/member/cover-letters");
    await expect(page.getByRole("heading", { name: "Cover-letter workspace" })).toBeVisible();
    await page.getByLabel("Document name").fill(coverLetterTitle);
    await page.getByLabel("Cover-letter file").setInputFiles({
      buffer: syntheticPdf(
        "Dear hiring team, I am applying for the graduate developer role with grounded project experience in TypeScript and testing.",
      ),
      mimeType: "application/pdf",
      name: "experian-cover-letter.pdf",
    });
    await page.getByRole("button", { name: "Upload cover letter" }).click();
    await page.waitForURL(/\/member\/cover-letters\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { name: coverLetterTitle })).toBeVisible();
    await expect(page.getByLabel("Extracted cover letter text")).toHaveValue(/hiring team/);
    coverLetterDetailUrl = page.url();

    const saveJobResponse = await page.evaluate(
      async (job) => {
        const response = await fetch("/api/member/jobs", {
          body: JSON.stringify(job),
          headers: { "content-type": "application/json" },
          method: "POST",
        });
        return response.status;
      },
      {
        applyUrl: null,
        companyName: "Experian",
        description:
          "Build customer-facing software with TypeScript and verify releases with automated tests.",
        employmentType: null,
        fetchedAt: null,
        location: null,
        provider: "manual",
        providerJobId: null,
        publishedAt: null,
        roleTitle: savedJobRole,
        sourcePublisher: null,
        sourceUrl: null,
      },
    );
    expect(saveJobResponse).toBe(201);

    let jobsUrl: string | null = null;
    if (process.env.JOB_CATALOG_ENABLED === "true") {
      await page.goto("/member/jobs");
      await expect(page).toHaveURL(/\/jobs$/);
      await expect(
        page.getByRole("heading", { name: /Find your next opportunity/i }),
      ).toBeVisible();
      jobsUrl = page.url();
    }

    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto(cvDetailUrl);
    await expect(page.locator("main").last()).toBeVisible();
    await page.waitForLoadState("networkidle");
    const memberNavigation = page.getByRole("navigation", { name: "Member navigation" });
    await memberNavigation.getByRole("button", { name: /Menu|Close/ }).click();
    await expect(memberNavigation.getByRole("link")).toHaveCount(8);
    for (const responsiveUrl of [jobsUrl, cvDetailUrl, coverLetterDetailUrl].filter(
      (url): url is string => url !== null,
    )) {
      await page.goto(responsiveUrl);
      await expect(page.locator("main").last()).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        ),
      ).toBe(false);
    }
  } finally {
    if (ownerId) {
      await database`delete from app.audit_event where actor_user_id=${ownerId}::uuid`;
      await database`delete from app.career_document_review where owner_user_id=${ownerId}::uuid`;
      await database`delete from app.career_document_review_usage where owner_user_id=${ownerId}::uuid`;
      await database`delete from app.career_document_version where owner_user_id=${ownerId}::uuid`;
      await database`delete from app.career_document where owner_user_id=${ownerId}::uuid`;
      await database`delete from app.career_job_target where owner_user_id=${ownerId}::uuid`;
      await database`delete from app.onboarding_profile where user_id=${ownerId}::uuid`;
      await database`delete from app.beta_entitlement where user_id=${ownerId}::uuid`;
      await database`delete from app."user" where id=${ownerId}::uuid`;
    }
    if (authId) await database`delete from auth.users where id=${authId}::uuid`;
    await database.end();
  }
});
