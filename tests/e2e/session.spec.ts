import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { Chess } from 'chess.js';
const status = (page: Page) => page.getByRole('status',{name:'对局状态'});
async function move(page: Page, from: string, to: string) { await page.getByTestId(`square-${from}`).click(); await page.getByTestId(`square-${to}`).click(); }
async function local(page: Page) {
  await page.goto('/'); await page.getByRole('button',{name:'对局设置',exact:true}).click();
  await page.getByRole('combobox',{name:'对弈模式',exact:true}).selectOption('local');
  await page.getByRole('button',{name:'应用并开始新局'}).click();
}
test('reload restores captures, SAN, orientation, mute and undo; PGN downloads', async ({page}) => {
  await local(page); await move(page,'e2','e4'); await move(page,'d7','d5'); await move(page,'e4','d5');
  await page.getByRole('button',{name:'翻转棋盘'}).click(); await page.getByRole('button',{name:'落子音效'}).click();
  await page.reload(); await expect(page.getByRole('status',{name:'恢复提示'})).toContainText('已恢复');
  await expect(page.getByLabel('白方吃子').getByRole('img',{name:'兵'})).toHaveCount(1);
  await expect(page.getByRole('button',{name:'落子音效'})).toHaveAttribute('aria-pressed','false');
  await expect(page.getByLabel('走棋记录',{exact:true})).toContainText('exd5');
  const a1 = await page.getByTestId('square-a1').boundingBox(); const h8 = await page.getByTestId('square-h8').boundingBox(); expect(a1!.x).toBeGreaterThan(h8!.x);
  const download = page.waitForEvent('download'); await page.getByRole('button',{name:'导出 PGN'}).click();
  const file = await download; const parsed = new Chess(); parsed.loadPgn(await readFile((await file.path())!,'utf8'));
  expect(parsed.history()).toEqual(['e4','d5','exd5']); expect(file.suggestedFilename()).toBe('chess-lab.pgn');
  await page.getByRole('button',{name:'悔棋'}).click(); await page.getByRole('button',{name:'继续对局'}).click();
  await expect(page.locator('.history-footer')).toContainText('3 步');
  await page.getByRole('button',{name:'悔棋'}).click(); await page.getByRole('button',{name:'确认悔棋',exact:true}).click();
  await expect(page.getByLabel('白方吃子').getByRole('img')).toHaveCount(0);
  await page.reload(); await expect(page.locator('.history-footer')).toContainText('2 步');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('pending promotion is restored and can be cancelled or completed', async ({page}) => {
  await local(page);
  for (const [from,to] of [['a2','a4'],['h7','h5'],['a4','a5'],['h5','h4'],['a5','a6'],['h4','h3'],['a6','b7'],['h3','g2'],['b7','a8']]) await move(page,from,to);
  await page.reload(); await expect(page.getByRole('dialog',{name:'兵升变'})).toBeVisible();
  await page.getByRole('button',{name:'取消',exact:true}).click(); await expect(status(page)).toContainText('白方走棋');
  await move(page,'b7','a8'); await page.getByRole('button',{name:'升变为马'}).click(); await page.reload();
  await expect(page.getByLabel('走棋记录',{exact:true})).toContainText('bxa8=N');
});
test('repetition and resignation remain terminal after reload', async ({page}) => {
  await local(page);
  for (const [from,to] of [['g1','f3'],['g8','f6'],['f3','g1'],['f6','g8'],['g1','f3'],['g8','f6'],['f3','g1']]) await move(page,from,to);
  await page.reload(); await move(page,'f6','g8'); await expect(status(page)).toContainText('三次重复');
  await page.reload(); await expect(status(page)).toContainText('三次重复');
  await page.getByRole('button',{name:'开始新局'}).click(); await page.getByRole('button',{name:'确认新局'}).click();
  await page.getByRole('button',{name:'认输',exact:true}).click(); await page.getByRole('button',{name:'确认认输'}).click();
  await page.reload(); await expect(status(page)).toContainText('黑方获胜 · 白方认输');
});
test('AI resumes a saved pending turn once and retains side and difficulty', async ({page}) => {
  await page.goto('/'); await page.getByRole('button',{name:'对局设置',exact:true}).click();
  await page.getByLabel('我的执棋').selectOption('b'); await page.getByLabel('AI 难度').selectOption('2');
  // Block the new Worker resource so reload occurs deterministically before its opening.
  await page.route('**/engine/*.js',route=>route.abort());
  await page.getByRole('button',{name:'应用并开始新局'}).click();
  await page.unroute('**/engine/*.js'); await page.reload();
  await expect(status(page)).toContainText('黑方走棋',{timeout:20000});
  await expect(page.locator('.history-footer')).toContainText('1 步');
  await page.getByRole('button',{name:'对局设置',exact:true}).click();
  await expect(page.getByLabel('我的执棋')).toHaveValue('b'); await expect(page.getByLabel('AI 难度')).toHaveValue('2');
  await page.getByRole('button',{name:'取消',exact:true}).click(); await page.reload();
  await expect(status(page)).toContainText('黑方走棋',{timeout:20000}); await expect(page.locator('.history-footer')).toContainText('1 步');
});
test('corrupt storage and blocked storage show feedback without breaking play', async ({page}) => {
  await page.addInitScript(()=>localStorage.setItem('chess-lab.session.v1','broken'));
  await page.goto('/'); await expect(page.getByRole('status',{name:'恢复提示'})).toContainText('无法读取');
  await page.addInitScript(()=>{ Storage.prototype.setItem = () => {throw new Error('quota');}; });
  await local(page); await expect(page.getByRole('status',{name:'保存状态'})).toContainText('无法自动保存');
  await move(page,'e2','e4'); await expect(status(page)).toContainText('黑方走棋');
});
