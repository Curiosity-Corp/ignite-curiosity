import { defineConfig, devices } from '@playwright/test';

// Production smoke only: this suite runs in CI (job e2e:production) against the live site, never a
// local server. E2E_BASE_URL defaults to the public site; the job sets it explicitly.
export default defineConfig({
  testDir: '.',
  testMatch: 'production.spec.ts',
  fullyParallel: true,
  workers: process.env['CI'] ? 3 : undefined,
  timeout: 60_000,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'https://ignitecuriosity.org',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
});
