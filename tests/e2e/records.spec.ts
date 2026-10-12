import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { Chess } from 'chess.js';
import { closeTools, openTools } from './tools';

async function local(page: Page) {
  await page.goto('./'); await openTools(page);
  await page.getByRole('button', { name: '对局设置', exact: true }).click();
  await page.getByRole('combobox', { name: '对弈模式', exact: true }).selectOption('local');
  await page.getByRole('button', { name: '应用并开始新局' }).click(); await closeTools(page);
}
async function move(page: Page, from: string, to: string) {
  await closeTools(page); await page.getByTestId(`square-${from}`).click(); await page.getByTestId(`square-${to}`).click();
}
async function records(page: Page) {
  await openTools(page); await page.getByRole('button', { name: /对弈记录/ }).click();
  return page.getByRole('dialog', { name: '对弈记录', exact: true });
}

test('completed records show start, result and fixed duration, survive a new game and export PGN', async ({ page }) => {
  await local(page);
  const startedAt = await page.evaluate(() => JSON.parse(localStorage.getItem('chess-lab.session.v1')!).game.startedAt);
  await page.clock.install(); await page.clock.fastForward(65000);
  for (const [from, to] of [['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']]) await move(page, from, to);
  const dialog = await records(page);
  await expect(dialog.getByRole('listitem')).toHaveCount(1);
  await expect(dialog).toContainText('黑方获胜 · 将死');
  await expect(dialog).toContainText('耗时'); await expect(dialog).toContainText('1 分');
  await expect(dialog.locator('time')).toHaveAttribute('datetime', startedAt);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('chess-lab.session.v1')!).records[0]);
  const downloaded = page.waitForEvent('download'); await dialog.getByRole('button', { name: '导出记录 PGN' }).click();
  const file = await downloaded; const pgn = await readFile((await file.path())!, 'utf8');
  const chess = new Chess(); chess.loadPgn(pgn);
  expect(chess.history()).toEqual(['f3', 'e5', 'g4', 'Qh4#']);
  expect(chess.getHeaders()).toMatchObject({ Result: '0-1', StartTime: startedAt, EndTime: saved.endedAt });
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  await page.clock.fastForward(120000); await page.reload();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('chess-lab.session.v1')!).records)).toEqual([saved]);
  await page.getByRole('button', { name: '开始新局' }).click(); await page.getByRole('button', { name: '确认新局' }).click();
  await page.reload(); await records(page); await expect(page.locator('.game-record')).toHaveCount(1);
  await expect(page.locator('.game-record')).toContainText('黑方获胜 · 将死');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('undo withdraws the terminal record, and reopening or changing settings preserves previous games', async ({ page }) => {
  await local(page); const dialog = await records(page);
  await expect(dialog).toContainText('还没有对弈记录'); await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  await move(page, 'e2', 'e4');
  await page.getByRole('button', { name: '认输', exact: true }).click(); await page.getByRole('button', { name: '确认认输' }).click();
  await records(page); await expect(page.locator('.game-record')).toContainText('白方获胜 · 黑方认输');
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: '悔棋' }).click(); await page.getByRole('button', { name: '确认悔棋', exact: true }).click();
  await page.reload(); await records(page); await expect(dialog).toContainText('还没有对弈记录');
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: '开始新局' }).click(); await page.getByRole('button', { name: '确认新局' }).click();
  await move(page, 'd2', 'd4'); await openTools(page);
  await page.getByRole('button', { name: '对局设置', exact: true }).click();
  await page.getByRole('button', { name: '应用并开始新局' }).click();
  await page.reload(); await records(page); await expect(dialog.getByRole('listitem')).toHaveCount(2);
  await expect(dialog.getByRole('listitem').first()).toContainText('未完成');
  const download = page.waitForEvent('download'); await dialog.getByRole('listitem').last().getByRole('button', { name: '导出记录 PGN' }).click();
  const chess = new Chess(); chess.loadPgn(await readFile((await (await download).path())!, 'utf8'));
  expect(chess.history()).toEqual(['e4']); expect(chess.getHeaders().Result).toBe('*');
});
