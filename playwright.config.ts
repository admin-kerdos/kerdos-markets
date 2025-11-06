import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  timeout: 60000,
  testDir: "./tests",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5173",
    headless: true,
    trace: "on-first-retry"
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 120000,
    env: {
      HOST: "127.0.0.1",
      NEXTAUTH_URL: "http://127.0.0.1:5173",
      NEXTAUTH_SECRET: "0123456789abcdef0123456789abcdef",
      GOOGLE_CLIENT_ID: "playwright-client",
      GOOGLE_CLIENT_SECRET: "playwright-secret",
      NEXT_PUBLIC_TEST_WALLETS:
        '{"phantom":[187,136,100,68,201,105,27,96,250,200,15,132,0,25,20,181,253,2,73,66,61,47,255,224,58,37,28,101,88,212,23,61,56,58,148,6,209,84,159,167,174,156,120,82,242,54,77,62,58,156,68,192,116,208,87,29,255,174,236,86,35,120,50,245],"solflare":[141,236,208,140,233,173,13,92,78,31,80,120,58,85,180,102,83,172,210,200,220,243,182,31,0,214,190,214,3,254,221,231,150,30,95,191,54,32,75,14,233,37,201,203,108,197,128,207,60,74,216,113,64,194,209,139,99,43,248,95,64,117,93,169]}'
    }
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
