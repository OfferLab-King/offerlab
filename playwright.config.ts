import { defineConfig, devices } from "@playwright/test";

const e2ePort = process.env.E2E_PORT ?? "3106";

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: false,
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  reporter: process.env.CI ? "github" : "list",
  retries: process.env.CI ? 2 : 0,
  testDir: "./e2e",
  use: {
    actionTimeout: 10_000,
    baseURL: `http://127.0.0.1:${e2ePort}`,
    navigationTimeout: 20_000,
    screenshot: "only-on-failure",
    trace: "off",
  },
  webServer: {
    command: `pnpm exec next dev -p ${e2ePort}`,
    reuseExistingServer: false,
    timeout: 120_000,
    url: `http://127.0.0.1:${e2ePort}/api/health`,
  },
  workers: 1,
});
