import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
const status = (page: Page) => page.getByRole('status',{name:'对局状态'});
const history = (page: Page) => page.getByLabel('走棋记录',{exact:true});
async function move(page: Page, from: string, to: string) {
  await page.getByTestId(`square-${from}`).click(); await page.getByTestId(`square-${to}`).click();
}
async function configure(page: Page, color: 'w'|'b', difficulty: string) {
  await page.getByRole('button',{name:'对局设置',exact:true}).click();
  await page.getByLabel('我的执棋').selectOption(color);
  await page.getByLabel('AI 难度').selectOption(difficulty);
  await page.getByRole('button',{name:'应用并开始新局'}).click();
}
test('real WASM engine responds, undo restores both plies, and new game resets', async ({page}) => {
  const errors: string[] = []; page.on('pageerror', error=>errors.push(error.message));
  await page.goto('./'); await expect(status(page)).toContainText('白方走棋',{timeout:20000});
  await move(page,'e2','e4'); await expect(status(page)).toContainText('白方走棋',{timeout:15000});
  await expect(history(page)).toContainText('e4'); await expect(page.locator('.history-row')).toHaveCount(1);
  await expect(page.locator('.history-footer')).toContainText('2 步');
  await move(page,'g1','f3'); await expect(page.locator('.history-footer')).toContainText('4 步',{timeout:15000});
  await page.getByRole('button',{name:'悔棋',exact:false}).click(); await page.getByRole('button',{name:'确认悔棋',exact:true}).click(); await expect(page.locator('.history-footer')).toContainText('2 步');
  await expect(status(page)).toContainText('白方走棋');
  await page.getByRole('button',{name:'开始新局'}).click(); await page.getByRole('button',{name:'确认新局'}).click();
  await expect(status(page)).toContainText('白方走棋',{timeout:15000}); await expect(page.locator('.history-footer')).toContainText('0 步');
  expect(errors).toEqual([]);
});
test('all difficulties support black side with an automatic white opening', async ({page}) => {
  await page.goto('./');
  for (const level of ['0','1','2']) {
    await configure(page,'b',level);
    await expect(status(page)).toContainText('黑方走棋',{timeout:20000});
    await expect(page.locator('.history-footer')).toContainText('1 步');
    await expect(page.getByRole('button',{name:'悔棋'})).toBeDisabled();
    const a1 = await page.getByTestId('square-a1').boundingBox(); const h8 = await page.getByTestId('square-h8').boundingBox();
    expect(a1!.x).toBeGreaterThan(h8!.x);
  }
});
test('undo during search and side switching do not apply old results', async ({page}) => {
  await page.goto('./'); await configure(page,'w','2');
  await expect(status(page)).toContainText('白方走棋',{timeout:20000});
  await move(page,'e2','e4'); await page.getByRole('button',{name:'悔棋',exact:false}).click(); await page.getByRole('button',{name:'确认悔棋',exact:true}).click();
  await expect(status(page)).toContainText('白方走棋',{timeout:15000});
  await expect(page.locator('.history-footer')).toContainText('0 步');
  await move(page,'d2','d4'); await configure(page,'b','0');
  await expect(status(page)).toContainText('黑方走棋',{timeout:15000});
  await expect(page.locator('.history-footer')).toContainText('1 步');
});
test('failed WASM load is visible and retry recovers the same position', async ({page}) => {
  await page.route('**/engine/*.wasm',route=>route.abort());
  await page.goto('./'); await expect(page.getByRole('alert')).toBeVisible({timeout:25000});
  await expect(page.locator('.history-footer')).toContainText('0 步');
  await page.unroute('**/engine/*.wasm'); await page.getByRole('button',{name:'重试引擎'}).click();
  await expect(status(page)).toContainText('白方走棋',{timeout:20000});
  await move(page,'e2','e4'); await expect(page.locator('.history-footer')).toContainText('2 步',{timeout:15000});
});
