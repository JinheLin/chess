import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
async function move(page: Page, from: string, to: string) {
  await page.getByTestId(`square-${from}`).click();
  await page.getByTestId(`square-${to}`).click();
}
test.beforeEach(async ({ page }) => { await page.goto('/'); });
test('click moves, legal markers, SAN, undo and new game confirmation', async ({ page }) => {
  await expect(page.getByRole('status', {name:'对局状态'})).toContainText('白方走棋');
  await page.getByTestId('square-e2').click();
  await expect(page.getByTestId('square-e4')).toHaveAttribute('style', /radial-gradient/);
  await page.getByTestId('square-e4').click();
  await expect(page.getByRole('status', {name:'对局状态'})).toContainText('黑方走棋');
  await move(page,'e7','e5');
  await expect(page.getByLabel('走棋记录', {exact:true})).toContainText('e4');
  await expect(page.getByLabel('走棋记录', {exact:true})).toContainText('e5');
  await page.getByRole('button',{name:'悔棋'}).click();
  await expect(page.getByRole('status', {name:'对局状态'})).toContainText('黑方走棋');
  await expect(page.getByLabel('走棋记录', {exact:true})).not.toContainText('e5');
  await page.getByRole('button',{name:'开始新局'}).click();
  await page.getByRole('button',{name:'继续对局'}).click();
  await expect(page.getByLabel('走棋记录', {exact:true})).toContainText('e4');
  await page.getByRole('button',{name:'开始新局'}).click();
  await page.getByRole('button',{name:'确认新局'}).click();
  await expect(page.getByRole('status', {name:'对局状态'})).toContainText('白方走棋');
  await expect(page.getByRole('button',{name:'悔棋'})).toBeDisabled();
});
test('illegal move leaves turn unchanged and flip retains position', async ({page}) => {
  await move(page,'e2','e5');
  await expect(page.getByRole('status', {name:'对局状态'})).toContainText('白方走棋');
  await expect(page.getByRole('button',{name:'悔棋'})).toBeDisabled();
  await page.getByRole('button',{name:'翻转棋盘'}).click();
  const a1 = await page.getByTestId('square-a1').boundingBox();
  const h8 = await page.getByTestId('square-h8').boundingBox();
  expect(a1!.x).toBeGreaterThan(h8!.x);
  await move(page,'e2','e4');
  await expect(page.getByRole('status', {name:'对局状态'})).toContainText('黑方走棋');
});
test('finish a complete game and undo checkmate', async ({page}) => {
  for (const [from,to] of [['f2','f3'],['e7','e5'],['g2','g4'],['d8','h4']]) await move(page,from,to);
  await expect(page.getByRole('status', {name:'对局状态'})).toContainText('黑方获胜 · 将死');
  await expect(page.getByRole('button',{name:'认输',exact:true})).toBeDisabled();
  await move(page,'a2','a3');
  await expect(page.getByLabel('走棋记录',{exact:true})).not.toContainText('a3');
  await page.getByRole('button',{name:'悔棋'}).click();
  await expect(page.getByRole('status', {name:'对局状态'})).toContainText('黑方走棋');
});
test('promotion dialog cancels safely and allows knight underpromotion', async ({page}) => {
  for (const [from,to] of [['a2','a4'],['h7','h5'],['a4','a5'],['h5','h4'],['a5','a6'],['h4','h3'],['a6','b7'],['h3','g2'],['b7','a8']]) await move(page,from,to);
  await expect(page.getByRole('dialog',{name:'兵升变'})).toBeVisible();
  await expect(page.getByRole('button',{name:/升变为/})).toHaveCount(4);
  await page.getByRole('button',{name:'取消',exact:true}).click();
  await expect(page.getByRole('status', {name:'对局状态'})).toContainText('白方走棋');
  await move(page,'b7','a8');
  await page.getByRole('button',{name:'升变为马'}).click();
  await expect(page.getByLabel('走棋记录',{exact:true})).toContainText('bxa8=N');
  await expect(page.getByRole('status', {name:'对局状态'})).toContainText('黑方走棋');
});
test('resign confirmation, focus return and no horizontal overflow', async ({page}) => {
  await page.getByRole('button',{name:'认输',exact:true}).click();
  await page.getByRole('button',{name:'继续对局'}).click();
  await expect(page.getByRole('button',{name:'认输',exact:true})).toBeFocused();
  await page.getByRole('button',{name:'认输',exact:true}).click();
  await page.getByRole('button',{name:'确认认输'}).click();
  await expect(page.getByRole('status', {name:'对局状态'})).toContainText('黑方获胜 · 白方认输');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('drag and drop moves pieces', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Touch click interaction covered by all other mobile tests');
  await page.getByTestId('square-d2').scrollIntoViewIfNeeded();
  const from = await page.getByTestId('square-d2').boundingBox();
  const to = await page.getByTestId('square-d4').boundingBox();
  await page.mouse.move(from!.x+from!.width/2,from!.y+from!.height/2);
  await page.mouse.down();
  await page.mouse.move(to!.x+to!.width/2,to!.y+to!.height/2,{steps:15});
  await page.mouse.up();
  await expect(page.getByLabel('走棋记录',{exact:true})).toContainText('d4');
});
