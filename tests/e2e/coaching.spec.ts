import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { closeTools, openTools } from './tools';

test.setTimeout(60000);
const status = (page: Page) => page.getByRole('status', { name: '对局状态' });
const coach = (page: Page) => page.getByRole('region', { name: '指导棋', exact: true });
async function configure(page: Page, color = 'w', mode = 'coach') {
  await openTools(page); await page.getByRole('button', { name: '对局设置', exact: true }).click();
  await page.getByRole('combobox', { name: '对弈模式', exact: true }).selectOption(mode);
  if (mode !== 'local') await page.getByLabel('我的执棋').selectOption(color);
  await page.getByRole('button', { name: '应用并开始新局' }).click(); await closeTools(page);
}
async function hint(page: Page) {
  const button = coach(page).getByRole('button', { name: '给我提示' });
  await expect(button).toBeEnabled({ timeout: 20000 }); await button.click();
  await expect(coach(page)).toContainText('可以考虑：', { timeout: 20000 });
  await expect(page.locator('[data-coach-hint]')).toHaveCount(2);
}
test('guided white game shows actionable hints, reviews moves and clears guidance on undo and new game', async ({ page }) => {
  await page.goto('./'); await configure(page); await expect(status(page)).toContainText('白方走棋', { timeout: 20000 });
  await expect(coach(page)).toBeVisible(); await expect(page.getByRole('region', { name: '棋手人格' })).toHaveCount(0);
  await hint(page);
  await coach(page).getByRole('button', { name: '隐藏提示' }).click(); await expect(page.locator('[data-coach-hint]')).toHaveCount(0);
  await hint(page);
  const from = await page.locator('[data-coach-hint="from"]').getAttribute('data-testid');
  const to = await page.locator('[data-coach-hint="to"]').getAttribute('data-testid');
  await page.getByTestId(from!).click();
  await expect(page.getByTestId(from!)).toHaveCSS('box-shadow', /rgb\(54, 127, 166\)/);
  await expect(page.getByTestId(to!)).toHaveCSS('box-shadow', /rgb\(54, 127, 166\)/);
  await page.getByTestId(to!).click();
  await expect(page.locator('[data-coach-hint]')).toHaveCount(0);
  await expect(coach(page)).toContainText('你走了', { timeout: 20000 });
  await openTools(page); await expect(page.locator('.history-footer')).toContainText('2 步'); await closeTools(page);
  await page.getByRole('button', { name: '悔棋' }).click(); await page.getByRole('button', { name: '确认悔棋', exact: true }).click();
  await expect(coach(page)).not.toContainText('上一步点评'); await expect(coach(page)).toContainText('先自己想一想');
  await hint(page); await page.getByRole('button', { name: '开始新局' }).click();
  await expect(page.locator('[data-coach-hint]')).toHaveCount(0); await expect(coach(page)).not.toContainText('可以考虑：');
  const bounds = await coach(page).boundingBox(); expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('black coaching restores mode and history, archives its identity and can switch to normal play', async ({ page }) => {
  await page.goto('./'); await configure(page, 'b');
  await expect(status(page)).toContainText('黑方走棋', { timeout: 20000 }); await hint(page);
  const a1 = await page.getByTestId('square-a1').boundingBox(), h8 = await page.getByTestId('square-h8').boundingBox();
  expect(a1!.x).toBeGreaterThan(h8!.x);
  await page.reload(); await expect(status(page)).toContainText('黑方走棋', { timeout: 20000 });
  await expect(coach(page)).toBeVisible(); await expect(page.locator('[data-coach-hint]')).toHaveCount(0);
  await openTools(page); await expect(page.locator('.history-footer')).toContainText('1 步');
  await page.getByRole('button', { name: '对局设置', exact: true }).click();
  await expect(page.getByRole('combobox', { name: '对弈模式', exact: true })).toHaveValue('coach');
  await expect(page.getByLabel('我的执棋')).toHaveValue('b'); await page.getByRole('button', { name: '取消', exact: true }).click(); await closeTools(page);
  await page.getByRole('button', { name: '认输', exact: true }).click(); await page.getByRole('button', { name: '确认认输' }).click();
  await expect(coach(page).getByRole('button', { name: '给我提示' })).toBeDisabled();
  await openTools(page); await page.getByRole('button', { name: /对弈记录/ }).click();
  await expect(page.getByRole('dialog', { name: '对弈记录' })).toContainText('下指导棋');
  await page.getByRole('button', { name: '关闭', exact: true }).click(); await closeTools(page);
  await configure(page, 'w', 'ai'); await expect(coach(page)).toHaveCount(0);
  await openTools(page); await expect(page.getByRole('region', { name: '棋手人格' })).toBeVisible(); await closeTools(page);
  await configure(page, 'w', 'local'); await expect(coach(page)).toHaveCount(0);
});
test.describe('coach recovery without a cached engine', () => {
  // Cached production resources correctly bypass routing; this test needs a real load failure.
  test.use({ serviceWorkers: 'block' });
  test('coach load failure can retry while the game remains playable', async ({ page }) => {
    await page.goto('./'); await configure(page); await expect(status(page)).toContainText('白方走棋', { timeout: 20000 });
    await page.route('**/engine/*.js*', route => route.abort());
    await coach(page).getByRole('button', { name: '给我提示' }).click();
    await expect(coach(page)).toContainText('指导分析暂不可用', { timeout: 20000 });
    await expect(status(page)).toContainText('白方走棋');
    await page.unroute('**/engine/*.js*'); await coach(page).getByRole('button', { name: '重试指导' }).click();
    await expect(coach(page)).toContainText('可以考虑：', { timeout: 20000 });
    await page.getByTestId('square-e2').click(); await page.getByTestId('square-e4').click();
    await expect(coach(page)).toContainText('你走了 e4', { timeout: 20000 });
  });
});
