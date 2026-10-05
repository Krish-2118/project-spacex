import { test, expect, type Page } from '@playwright/test';

/** Everything that should never happen while touring the site. */
function watch(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`console.error: ${m.text()}`); });
  page.on('requestfailed', (r) => {
    problems.push(`request failed: ${r.url()} (${r.failure()?.errorText || ''})`);
  });
  page.on('response', (r) => { if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`); });
  return problems;
}

/** The loader hides itself (display: none) once its exit animation has finished (Innovision#hideLoader). */
async function loaderDone(page: Page) {
  await expect(page.locator('[data-loader]')).toBeHidden({ timeout: 45_000 });
}

/**
 * Routes by hash, then waits for the view to be shown (under the curtain) and for the curtain to come
 * to rest again: it is marked [data-idle] when its timeline completes (Innovision#curtain).
 */
async function go(page: Page, hash: string, view: string) {
  await page.evaluate((h) => { location.hash = h; }, hash);
  await expect(page.locator(`[data-view="${view}"]`)).toBeVisible();
  await expect(page.locator('[data-curtain][data-idle]')).toHaveCount(1);
}

/** Opens the register / log-in overlay and closes it again; the rift has finished opening once clip-path is gone. */
async function authRoundTrip(page: Page, open: () => Promise<void>, title: string) {
  await open();
  const root = page.locator('[data-auth-root]');
  await expect(root).toBeVisible();
  await expect(page.locator('[data-auth] h2').first()).toHaveText(title);
  await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-auth]')!).clipPath === 'none');
  await page.locator('[data-auth] button', { hasText: 'CLOSE' }).click();
  await expect(root).toBeHidden();
}

test('tour every view without errors', async ({ page, isMobile }) => {
  const problems = watch(page);

  await page.goto('/');
  await loaderDone(page);
  await expect(page.locator('[data-view="home"]')).toBeVisible();
  await expect(page.locator('[data-view="home"] h1')).toHaveAttribute('aria-label', 'Innovision');

  // Worlds slider, then a world's detail page.
  await go(page, '#/worlds/flagship-events', 'worlds');
  await expect(page.locator('[data-slide="0"]')).toBeVisible();
  await go(page, '#/world/flagship-events', 'detail');
  await expect(page.locator('[data-d-title]')).toHaveAttribute('aria-label', 'Flagship Events');
  await page.locator('[data-d-scroller]').evaluate((el) => { el.scrollTop = el.scrollHeight / 2; });
  await expect(page.locator('[data-d-card]').first()).toBeAttached();

  // Schedule: switch day.
  await go(page, '#/schedule', 'schedule');
  await expect(page.locator('[data-sc-list] .sc-card').first()).toBeVisible();
  await page.locator('[data-sc-tab]').nth(1).click();
  await expect(page.locator('[data-sc-title] h2')).toHaveText('Orbit');

  // Store, then the bag panel from the cart pill.
  await go(page, '#/merch', 'merch');
  await page.locator('[data-view="merch"] button', { hasText: 'ADD TO CART' }).first().click();
  await page.getByRole('button', { name: 'VIEW BAG' }).click();
  const bag = page.locator('[data-bag]');
  await expect(bag).toBeVisible();
  await expect(bag).toContainText('Odyssey Tee');
  await bag.locator('button', { hasText: 'CLOSE' }).click();
  await expect(bag).toBeHidden();

  // Gallery.
  await go(page, '#/gallery', 'gallery');
  await expect(page.locator('[data-g-item]')).toHaveCount(12);
  if (!isMobile) await page.mouse.wheel(0, 1600);

  // Menu (compact screens only: on a wide desktop the HUD shows the full nav instead).
  const vp = page.viewportSize()!;
  if (vp.width >= 1100) await page.setViewportSize({ width: 1000, height: vp.height });
  await page.locator('[data-hud] button', { hasText: 'MENU' }).click();
  const menu = page.locator('[data-menu]');
  await expect(menu).toBeVisible();
  await expect(menu).toHaveAttribute('data-open', '');

  if (vp.width < 720) {
    // Phones: LOG IN lives in the menu.
    await authRoundTrip(page, () => menu.locator('a[href="#login"]').click(), 'Welcome back');
  } else {
    await menu.locator('.menu-close').click();
    await expect(menu).toBeHidden();
    if (vp.width >= 1100) await page.setViewportSize(vp);
    await authRoundTrip(page, () => page.locator('[data-hud] a[href="#login"]').click(), 'Welcome back');
  }
  // REGISTER from the HUD: signed-out visitors are sent to log in first (openAuth's auth guard).
  await authRoundTrip(page, () => page.locator('[data-hud] a[href="#register"]').click(), 'Welcome back');

  await go(page, '#/', 'home');

  expect(problems, problems.join('\n')).toEqual([]);
});

test('deep link opens a lazy view straight from the loader', async ({ page }) => {
  const problems = watch(page);
  await page.goto('/#/world/main-events');
  await loaderDone(page);
  await expect(page.locator('[data-view="detail"]')).toBeVisible();
  await expect(page.locator('[data-d-title]')).toHaveAttribute('aria-label', 'Main Events');
  expect(problems, problems.join('\n')).toEqual([]);
});
