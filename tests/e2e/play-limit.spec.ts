import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { closeTools, openTools } from './tools';

test.use({ timezoneId: 'Asia/Shanghai' });
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
async function speechMock(page: Page, fail = false) {
  await page.addInitScript(throwSpeech => {
    const log: string[] = []; Object.defineProperty(window, '__limitSpeechLog', { value: log });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: class { text: string; constructor(text: string) { this.text = text; } } });
    Object.defineProperty(window, 'speechSynthesis', { value: { getVoices: () => [{ lang: 'zh-CN', localService: true }], cancel: () => {}, speak: (u: { text: string; onstart?: () => void }) => {
      if (throwSpeech) throw new Error('audio denied');
      log.push(u.text); u.onstart?.();
    } } });
  }, fail);
}
const reminders = (page: Page) => page.evaluate(() => (Reflect.get(window, '__limitSpeechLog') as string[]).filter(text => text.startsWith('防沉迷提醒')));
async function local(page: Page) {
  await page.goto('./'); await openTools(page); await page.getByRole('button', { name: '对局设置', exact: true }).click();
  await page.getByRole('combobox', { name: '对弈模式', exact: true }).selectOption('local');
  await page.getByRole('button', { name: '应用并开始新局' }).click(); await closeTools(page);
}
async function resign(page: Page) {
  await page.getByRole('button', { name: '认输', exact: true }).click(); await page.getByRole('button', { name: '确认认输' }).click();
}
async function next(page: Page) {
  await page.getByRole('button', { name: '开始新局' }).click(); await page.getByRole('button', { name: '确认新局' }).click();
}
async function seedDailyLimit(page: Page) {
  await page.clock.install({ time: new Date('2026-10-12T17:00:00+08:00') });
  await page.addInitScript(() => {
    if (localStorage.getItem('chess-lab.play-usage.v1')) return;
    const day = new Date('2026-10-12T00:00:00+08:00');
    const usage = [0, 4, 8].flatMap(hour => [0, 1, 2].map(minute => ({ id: `game-${hour}-${minute}`, startedAt: new Date(day.getTime() + hour * 3600000 + minute * 60000).toISOString() })));
    localStorage.setItem('chess-lab.play-usage.v1', JSON.stringify({ version: 1, usage }));
  });
}

test('three games show and speak the limit; refresh and terminal undo cannot reopen play', async ({ page }) => {
  await speechMock(page); await local(page);
  for (let i = 0; i < 3; i++) { if (i) await next(page); await resign(page); }
  const warning = page.getByRole('alert', { name: '防沉迷提示' });
  await expect(warning).toContainText('最近4小时已玩满3局'); await expect(warning).toContainText('后可开始新局');
  await expect.poll(() => reminders(page)).toHaveLength(1);
  await expect(page.getByRole('button', { name: '开始新局' })).toBeDisabled(); await expect(page.getByRole('button', { name: '悔棋' })).toBeDisabled();
  await page.reload(); await expect(warning).toBeVisible();
  expect(await reminders(page)).toEqual([]); await warning.getByRole('heading').click();
  await expect.poll(() => reminders(page)).toHaveLength(1);
  await page.getByTestId('square-e2').click(); await page.getByTestId('square-e4').click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('chess-lab.play-usage.v1')!).usage.length)).toBe(3);
  await openTools(page); await expect(page.getByRole('button', { name: '对局设置', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: /对弈记录/ }).click();
  await expect(page.getByRole('dialog', { name: '对弈记录', exact: true }).getByRole('listitem')).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('the last admitted game can finish and the rolling limit automatically unlocks after four hours', async ({ page }) => {
  await speechMock(page); await page.clock.install({ time: new Date('2026-10-12T08:00:00+08:00') }); await local(page);
  await resign(page); await next(page); await resign(page); await next(page);
  await page.getByTestId('square-e2').click(); await page.getByTestId('square-e4').click();
  await expect(page.getByRole('status', { name: '对局状态' })).toContainText('黑方走棋');
  await expect(page.getByRole('button', { name: '开始新局' })).toBeDisabled();
  await expect(page.getByRole('alert', { name: '防沉迷提示' })).toHaveCount(0);
  await page.getByTestId('square-e7').click(); await page.getByTestId('square-e5').click(); await resign(page);
  await expect(page.getByRole('alert', { name: '防沉迷提示' })).toBeVisible();
  await page.clock.fastForward(FOUR_HOURS_MS + 10000);
  await expect(page.getByRole('alert', { name: '防沉迷提示' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '开始新局' })).toBeEnabled();
  await next(page); await page.getByTestId('square-d2').click(); await page.getByTestId('square-d4').click();
  await expect(page.getByRole('status', { name: '防沉迷用量' })).toContainText('今日：4 / 9');
});

test('the daily cap survives an empty rolling window and unlocks at local midnight', async ({ page }) => {
  await speechMock(page); await seedDailyLimit(page); await page.goto('./');
  const warning = page.getByRole('alert', { name: '防沉迷提示' });
  await expect(warning).toContainText('今天已玩满9局'); await expect(page.getByRole('status', { name: '防沉迷用量' })).toContainText('最近 4 小时：0 / 3');
  await warning.getByRole('button', { name: '再次朗读' }).click(); await expect.poll(() => reminders(page)).toHaveLength(1);
  await expect(page.getByRole('button', { name: '开始新局' })).toBeDisabled(); await expect(page.locator('.board-loading')).toHaveCount(0);
  await page.reload(); await expect(warning).toContainText('9局');
  await page.clock.fastForward(7 * 3600000 + 10000);
  await expect(warning).toHaveCount(0); await expect(page.getByRole('status', { name: '防沉迷用量' })).toContainText('今日：0 / 9');
  await expect(page.getByRole('status', { name: '对局状态' })).toContainText('白方走棋', { timeout: 20000 });
  await page.getByTestId('square-e2').click(); await page.getByTestId('square-e4').click();
  await expect(page.getByRole('status', { name: '防沉迷用量' })).toContainText('今日：1 / 9');
});

test('the AI limit reminder overrides terminal commentary even with personality voice and move sounds off', async ({ page }) => {
  await speechMock(page);
  await page.addInitScript(() => {
    const startedAt = new Date().toISOString();
    localStorage.setItem('chess-lab.play-usage.v1', JSON.stringify({ version: 1, usage: [{ id: 'previous-1', startedAt }, { id: 'previous-2', startedAt }] }));
  });
  await page.goto('./'); await expect(page.getByRole('status', { name: '对局状态' })).toContainText('白方走棋', { timeout: 20000 });
  await page.getByRole('button', { name: '落子音效' }).click(); await openTools(page);
  const voice = page.getByRole('switch', { name: '语音朗读', exact: true }); await voice.click(); await expect(voice).toHaveAttribute('aria-checked', 'false');
  await closeTools(page); await page.getByTestId('square-e2').click(); await page.getByTestId('square-e4').click(); await resign(page);
  await expect(page.getByRole('alert', { name: '防沉迷提示' })).toBeVisible(); await expect.poll(() => reminders(page)).toHaveLength(1);
  const log = await page.evaluate(() => Reflect.get(window, '__limitSpeechLog') as string[]);
  expect(log.some(text => text.includes('这盘我赢了'))).toBe(false);
  expect(log.at(-1)).toContain('防沉迷提醒');
});

for (const mode of ['unsupported', 'failed'] as const) test(`${mode} speech preserves a visible limit and blocked controls`, async ({ page }) => {
  await seedDailyLimit(page);
  if (mode === 'unsupported') await page.addInitScript(() => { Object.defineProperty(window, 'speechSynthesis', { value: undefined }); });
  else await speechMock(page, true);
  await page.goto('./'); const warning = page.getByRole('alert', { name: '防沉迷提示' }); await expect(warning).toBeVisible();
  if (mode === 'unsupported') { await expect(warning.getByRole('button', { name: '再次朗读' })).toBeDisabled(); await expect(page.getByRole('status', { name: '防沉迷语音状态' })).toContainText('不支持'); }
  else { await warning.getByRole('button', { name: '再次朗读' }).click(); await expect(page.getByRole('status', { name: '防沉迷语音状态' })).toContainText('未成功'); }
  await expect(page.getByRole('button', { name: '开始新局' })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
