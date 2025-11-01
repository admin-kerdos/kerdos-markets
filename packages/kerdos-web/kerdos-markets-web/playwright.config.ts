import { defineConfig, devices } from "@playwright/test";

const shouldStartWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER !== "1";

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: process.env.PW_BASE_URL || "http://localhost:5173",
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"]
      }
    }
  ],
  webServer: shouldStartWebServer
    ? {
        command: "pnpm run build:next && pnpm run start:next",
        port: 5173,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000
      }
    : undefined
});
