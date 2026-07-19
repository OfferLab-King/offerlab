import { expect, test } from "@playwright/test";

test("serves the application foundation", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "OfferLab" })).toBeVisible();
});

test("reports service health without caching", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.ok()).toBe(true);
  expect(response.headers()["cache-control"]).toContain("no-store");
  await expect(response.json()).resolves.toMatchObject({ status: "ok" });
});
