import { defineConfig, devices } from '@playwright/test';

/**
 * E2E tests for Project Finance AI Engine.
 * Run with: npx playwright test
 *
 * Prerequisites:
 * - Backend: cd backend && source .venv/bin/activate && uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
 * - Frontend: cd frontend && npm run dev
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    cwd: 'frontend',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
});
