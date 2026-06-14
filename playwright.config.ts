import { defineConfig, devices } from '@playwright/test'

/**
 * E2E tests run against the full dev stack (`dev:full` = Vite client on 5173
 * proxying `/ws` to the websocket server on 4174). Specs live in `e2e/` and
 * use the `.spec.ts` suffix so Vitest (which only collects `*.test.ts`) never
 * picks them up.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev:full',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
