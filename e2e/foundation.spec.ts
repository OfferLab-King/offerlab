import { expect, test } from "@playwright/test";

test("serves the application foundation", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Prepare with evidence. Practise with purpose." }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Start building your evidence" })).toHaveAttribute(
    "href",
    "/register",
  );
  await expect(page.getByText("Evidence-grounded AI Answer Coach")).toBeVisible();
  await expect(
    page
      .locator("article.distinctive-card")
      .filter({ hasText: "Evidence-grounded AI Answer Coach" })
      .getByText("In development", { exact: true }),
  ).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("navigation", { name: "Public navigation" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    ),
  ).toBe(false);
});

test("reports service health without caching", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.ok()).toBe(true);
  expect(response.headers()["cache-control"]).toContain("no-store");
  await expect(response.json()).resolves.toMatchObject({ status: "ok" });
});
