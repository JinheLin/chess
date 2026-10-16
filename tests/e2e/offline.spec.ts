import { test, expect } from '@playwright/test';
import { closeTools, openTools } from './tools';

test.beforeEach(() => {
  test.skip(process.env.PLAYWRIGHT_PRODUCTION !== '1', 'Offline support is generated in production builds');
});

test('Android home screen manifest uses this subdirectory and valid local icons', async ({ request }) => {
  const response = await request.get('manifest.webmanifest');
  expect(response.headers()['content-type']).toContain('application/manifest+json');
  const manifest = await response.json();
  expect(manifest).toMatchObject({ start_url: './', scope: './', display: 'standalone' });
  for (const icon of manifest.icons) {
    const image = await request.get(icon.src);
    expect(image.status()).toBe(200);
    expect(image.headers()['content-type']).toContain('image/png');
    const bytes = await image.body();
    expect(bytes.readUInt32BE(16)).toBe(Number(icon.sizes.split('x')[0]));
    expect(bytes.readUInt32BE(20)).toBe(Number(icon.sizes.split('x')[1]));
  }
});

test('cached app reopens offline, preserves the game and makes a real AI move', async ({ page, context }) => {
  await page.goto('./');
  await expect(page.getByRole('status', { name: '对局状态' })).toContainText('白方走棋', { timeout: 20000 });
  await page.getByTestId('square-e2').click();
  await page.getByTestId('square-e4').click();
  await openTools(page);
  await expect(page.locator('.history-footer')).toContainText('2 步', { timeout: 20000 });
  await expect(page.getByRole('status', { name: '离线状态' })).toHaveText('已可离线使用', { timeout: 20000 });
  await expect(page.getByRole('button', { name: '更新版本 · 保留棋局' })).toHaveCount(0);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('chess-lab.session.v1')!).game.moves);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('status', { name: '对局状态' })).toContainText('白方走棋', { timeout: 20000 });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('chess-lab.session.v1')!).game.moves)).toEqual(saved);
  await page.getByTestId('square-g1').click();
  await page.getByTestId('square-f3').click();
  await openTools(page);
  await expect(page.locator('.history-footer')).toContainText('4 步', { timeout: 20000 });
  await expect(page.getByRole('status', { name: '离线状态' })).toHaveText('已可离线使用');
});

test('home screen installation is only requested by a user click', async ({ page }) => {
  await page.goto('./');
  await openTools(page);
  await page.evaluate(() => {
    document.documentElement.dataset.installRequests = '0';
    window.dispatchEvent(Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: async () => { document.documentElement.dataset.installRequests = '1'; },
    }));
  });
  await expect(page.getByRole('button', { name: '安装到主屏幕' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-install-requests', '0');
  await page.getByRole('button', { name: '安装到主屏幕' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-install-requests', '1');
});

test('an available update waits for a click and restores the saved game after refresh', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('status', { name: '对局状态' })).toContainText('白方走棋', { timeout: 20000 });
  await page.getByTestId('square-e2').click();
  await page.getByTestId('square-e4').click();
  await openTools(page);
  await expect(page.locator('.history-footer')).toContainText('2 步', { timeout: 20000 });
  await expect(page.getByRole('status', { name: '离线状态' })).toHaveText('已可离线使用', { timeout: 20000 });
  await page.evaluate(() => navigator.serviceWorker.register('./sw.js?update-test', { scope: './', updateViaCache: 'none' }).then(() => {}));
  await expect(page.getByRole('button', { name: '更新版本 · 保留棋局' })).toBeVisible({ timeout: 20000 });
  await closeTools(page);
  await expect(page.getByTestId('square-e4').locator('[data-piece="wP"]')).toHaveCount(1);
  await openTools(page);
  const refreshed = page.waitForEvent('load');
  await page.getByRole('button', { name: '更新版本 · 保留棋局' }).click();
  await refreshed;
  await expect(page.getByRole('status', { name: '对局状态' })).toContainText('白方走棋', { timeout: 20000 });
  await openTools(page);
  await expect(page.locator('.history-footer')).toContainText('2 步');
});

test.describe('Android tablet touch layout', () => {
  test.use({ hasTouch: true });
  test('portrait and landscape keep the board visible and allow touch moves', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 1280 });
    await page.goto('./');
    await expect(page.getByRole('status', { name: '对局状态' })).toContainText('白方走棋', { timeout: 20000 });
    const board = page.locator('.board-frame');
    const portrait = await board.boundingBox();
    expect(portrait!.width).toBeGreaterThan(720);
    expect(portrait!.y).toBeGreaterThanOrEqual(0);
    expect(portrait!.y + portrait!.height).toBeLessThanOrEqual(1280 - 64);
    await page.getByTestId('square-e2').tap();
    await page.getByTestId('square-e4').tap();
    await openTools(page);
    await expect(page.locator('.history-footer')).toContainText('2 步', { timeout: 20000 });
    await closeTools(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    const landscape = await board.boundingBox();
    expect(landscape!.y).toBeGreaterThanOrEqual(0);
    expect(landscape!.y + landscape!.height).toBeLessThanOrEqual(800);
    await page.getByTestId('square-g1').tap();
    await page.getByTestId('square-f3').tap();
    await expect(page.locator('.history-footer')).toContainText('4 步', { timeout: 20000 });
    expect((await page.locator('.history-scroll').boundingBox())!.height).toBeGreaterThan(50);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});
