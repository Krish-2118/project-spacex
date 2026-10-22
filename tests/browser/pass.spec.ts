import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const approved = { registrationStatus: 'confirmed', passStatus: 'active', registrationId: 'IV26-1024', name: 'Ananya Priyadarshini Subramanian', college: 'International Institute of Engineering, Technology and Advanced Interdisciplinary Studies', token: 'opaque-real-token-fixture', checkedIn: false };
async function backend(context: BrowserContext, initial = approved) {
  const state = { pass: initial, seen: false, claimed: false, claims: 0, acks: 0 };
  await context.route('**/api/pass', route => {
    expect(route.request().method()).toBe('POST');
    return route.fulfill({ json: { pass: state.pass } });
  });
  await context.route('**/api/pass/experience', route => {
    const body = route.request().postDataJSON();
    if (body.action === 'acknowledge') { state.seen = true; state.acks++; return route.fulfill({ json: { result: true } }); }
    state.claims++;
    const result = state.seen ? 'seen' : state.claimed ? 'busy' : 'claimed'; state.claimed = true;
    return route.fulfill({ json: { result } });
  });
  return state;
}
async function open(page: Page) { await page.goto('/'); await page.getByRole('button', { name: 'My pass', exact: true }).click(); }
async function showDetails(page: Page) {
  const toggle = page.getByRole('button', { name: /Your pass$/i });
  if (await toggle.count()) await toggle.click();
}

test('pending/rejected never reveal; approved data is personalized and persists', async ({ page, context }) => {
  const state = await backend(context, { ...approved, registrationStatus: 'pending', token: '' });
  await open(page); await expect(page.getByText('Payment under review.', { exact: false })).toBeVisible();
  expect(state.claims).toBe(0);
  state.pass = { ...approved, registrationStatus: 'rejected', token: '' };
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText('Your payment was not approved.', { exact: false })).toBeVisible();
  expect(state.claims).toBe(0);
  state.pass = approved;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('heading', { name: 'You’re in, Ananya.' })).toBeVisible();
  await expect(page.locator('[data-pass-phase]')).toHaveAttribute('data-pass-phase', 'settled');
  await showDetails(page);
  await expect(page.getByRole('heading', { name: approved.name })).toBeVisible();
  await expect(page.getByText(approved.college, { exact: true })).toBeVisible();
  await expect.poll(() => state.acks).toBe(1);
  await page.reload(); await page.getByRole('button', { name: 'My pass', exact: true }).click();
  await expect(page.locator('[data-pass-phase]')).toHaveAttribute('data-pass-phase', 'settled');
  await expect(page.getByRole('button', { name: 'SKIP', exact: true })).toHaveCount(0);
});

test('keyboard skip, focus restoration and a real PDF download', async ({ page, context }, testInfo) => {
  const state = await backend(context);
  await open(page);
  const skip = page.getByRole('button', { name: 'SKIP', exact: true });
  await expect(skip).toBeVisible(); await skip.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('[data-pass-phase]')).toHaveAttribute('data-pass-phase', 'settled');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save PDF', exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('INNOVISION-IV26-1024.pdf');
  await download.saveAs(testInfo.outputPath('downloaded-pass.pdf'));
  const bytes = await readFile((await download.path())!);
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
  expect(bytes.length).toBeGreaterThan(10000);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'My pass', exact: true })).toBeFocused();
  await expect.poll(() => state.acks).toBe(1);
});

test('reduced motion and long/unbroken text remain readable without horizontal overflow', async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const name = 'Ananya '.repeat(12).trim(); const college = 'Institute'.repeat(23);
  const state = await backend(context, { ...approved, name, college });
  await open(page);
  await expect(page.locator('[data-pass-phase]')).toHaveAttribute('data-pass-phase', 'settled');
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('article h3, article dd').evaluateAll(els => els.every(el => el.scrollWidth <= el.clientWidth))).toBe(true);
  await expect.poll(() => state.acks).toBe(1);
});

test('parallel tabs elect one reveal', async ({ page, context }) => {
  await backend(context); const second = await context.newPage();
  await Promise.all([open(page), open(second)]);
  await expect.poll(async () => (await page.getByRole('button', { name: 'SKIP', exact: true }).count()) + (await second.getByRole('button', { name: 'SKIP', exact: true }).count())).toBe(1);
  await Promise.all([showDetails(page), showDetails(second)]);
  await expect(page.getByRole('heading', { name: approved.name })).toBeAttached();
  await expect(second.getByRole('heading', { name: approved.name })).toBeAttached();
});

test('desktop stub detaches with the keyboard and retains the pass', async ({ page, context }) => {
  test.skip((page.viewportSize()?.width ?? 0) <= 680, 'Phone pass is an immediately readable vertical card.');
  await backend(context); await open(page);
  await expect(page.locator('[data-pass-phase]')).toHaveAttribute('data-pass-phase', 'settled');
  await showDetails(page);
  const stub = page.getByRole('button', { name: 'Tear off the stub' });
  await stub.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Reattach the stub' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: approved.name })).toBeVisible();
});

test('ordinary close/reopen does not replay', async ({ page, context }) => {
  const state = await backend(context); await open(page);
  await expect.poll(() => state.acks).toBe(1);
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'My pass', exact: true }).click();
  await expect(page.locator('[data-pass-phase]')).toHaveAttribute('data-pass-phase', 'settled');
  await expect(page.getByRole('button', { name: 'SKIP', exact: true })).toHaveCount(0);
  expect(state.acks).toBe(1);
});

test('claim-service failure preserves a static pass and PDF without a fake QR', async ({ page, context }) => {
  await backend(context, { ...approved, token: '' });
  await context.route('**/api/pass/experience', route => route.fulfill({ status: 503, json: { error: 'Unavailable' } }));
  await open(page);
  await expect(page.locator('[data-pass-phase]')).toHaveAttribute('data-pass-phase', 'settled');
  await showDetails(page);
  await expect(page.getByRole('heading', { name: approved.name })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save PDF', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'View entry QR' })).toHaveCount(0);
});

test('revocation between pass fetch and claim never celebrates', async ({ page, context }) => {
  await backend(context);
  await context.route('**/api/pass/experience', route => route.fulfill({ json: { result: 'ineligible' } }));
  await open(page);
  await expect(page.getByText('Registration Status Updated', { exact: true })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'SKIP', exact: true })).toHaveCount(0);
});
