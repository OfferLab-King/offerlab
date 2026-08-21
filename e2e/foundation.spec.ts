import { expect, test } from "@playwright/test";

test("serves the application foundation", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Build the proof behind every application." }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Build your free workspace" })).toHaveAttribute(
    "href",
    "/register",
  );
  await expect(page.getByRole("heading", { name: "Find the right opportunity" })).toBeVisible();
  await expect(page.getByText("In development", { exact: true })).toHaveCount(0);

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
