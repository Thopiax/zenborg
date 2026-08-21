import { defineConfig, devices } from "@playwright/test";

/**
 * Browser checks for the things unit tests cannot see: what a card does with
 * the space it has. Runs against the web build (IndexedDB, no vault), so it
 * never touches a real garden.
 *
 * pnpm test:e2e            # headless
 * pnpm test:e2e --ui       # pick through it
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
