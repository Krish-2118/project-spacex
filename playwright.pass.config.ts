import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', testMatch: 'pass.spec.ts', timeout: 30_000,
  globalTeardown: './tests/browser/teardown.ts',
  use: { baseURL: 'http://127.0.0.1:3191', channel: 'chrome', trace: 'retain-on-failure' },
  webServer: { command: 'node tests/browser/serve-pass.cjs', url: 'http://127.0.0.1:3191', timeout: 60_000 },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 5'], viewport: { width: 320, height: 740 } } },
  ],
});
