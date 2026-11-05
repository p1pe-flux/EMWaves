import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './design-tests',
  outputDir: 'test-results/design-browser',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/design', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', grep: /@smoke/, use: { browserName: 'firefox' } },
    { name: 'webkit', grep: /@smoke/, use: { browserName: 'webkit' } },
  ],
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173/design-preview.html',
    reuseExistingServer: !process.env.CI,
  },
});
