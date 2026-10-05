import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;

/**
 * Smoke tests against the production build (`npm run test:e2e` builds first, then `next start` serves it).
 * Browsers: `npx playwright install chromium webkit` (iPhone 13 runs in WebKit).
 */
export default defineConfig({
  testDir: './tests',
  // The site's transitions are real animations (curtain, loader, rift), so a full tour takes a while.
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: true,
  workers: process.env.CI ? 1 : 2,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'pixel-5', use: { ...devices['Pixel 5'] } },
    // WebKit renders this site far slower than Safari on a phone (notably on Windows, where frames can take
    // over 500 ms and GSAP's lag smoothing then stretches every animation), so it gets more time.
    { name: 'iphone-13', use: { ...devices['iPhone 13'] }, timeout: 900_000, expect: { timeout: 120_000 } },
  ],
});
