import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  outputDir: 'test-results/browser',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4189',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', testIgnore: '**/mobile.spec.ts', use: { browserName: 'chromium', viewport: { width: 1440, height: 1100 } } },
    { name: 'firefox', testIgnore: '**/mobile.spec.ts', use: { browserName: 'firefox', viewport: { width: 1440, height: 1100 } } },
    { name: 'webkit', testIgnore: '**/mobile.spec.ts', use: { browserName: 'webkit', viewport: { width: 1440, height: 1100 } } },
    { name: 'mobile', testMatch: '**/mobile.spec.ts', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: 'npm run preview -- --port 4189 --strictPort',
    url: 'http://127.0.0.1:4189',
    reuseExistingServer: !process.env.CI,
  },
});
