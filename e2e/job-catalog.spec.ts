import { expect, test } from "@playwright/test";

test.skip(
  process.env.JOB_CATALOG_ENABLED === "true",
  "catalogue-enabled runs replace the dormant assertions",
);

test("the unapproved public job catalog remains dormant by default", async ({ page }) => {
  const response = await page.goto("/jobs");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: /fresh roles/i })).toHaveCount(0);

  const sectorsResponse = await page.goto("/jobs/sectors");
  expect(sectorsResponse?.status()).toBe(404);

  const savedJobsResponse = await page.goto("/member/saved-jobs");
  expect(savedJobsResponse?.status()).toBe(404);

  const savedJobsApiResponse = await page.request.get("/api/member/saved-jobs");
  expect(savedJobsApiResponse.status()).toBe(404);

  const eventsResponse = await page.request.post("/api/jobs/events", {
    data: { event: "job_view" },
  });
  expect(eventsResponse.status()).toBe(404);
});
