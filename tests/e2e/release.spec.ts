import { test, expect } from '@playwright/test';
import { Chess } from 'chess.js';
import { closeTools, openTools } from './tools';

test('production resources have correct MIME, no SPA fallback and no external runtime requests', async ({page,request,baseURL}) => {
  test.skip(process.env.PLAYWRIGHT_PRODUCTION !== '1','Strict static host release check');
  const external: string[] = []; page.on('request', req => { if (new URL(req.url()).origin !== new URL(baseURL!).origin && /^https?:/.test(req.url())) external.push(req.url()); });
  const wasm = await request.get('engine/stockfish-19-lite-single.wasm');
  expect(wasm.status()).toBe(200); expect(wasm.headers()['content-type']).toContain('application/wasm');
  expect(WebAssembly.validate(new Uint8Array(await wasm.body()))).toBe(true);
  const js = await request.get('engine/stockfish-19-lite-single.js'); expect(js.headers()['content-type']).toContain('javascript');
  expect((await request.get('engine/missing.wasm')).status()).toBe(404);
  await page.goto('./'); await expect(page.getByRole('status',{name:'对局状态'})).toContainText('白方走棋',{timeout:20000});
  await page.getByTestId('square-e2').click(); await page.getByTestId('square-e4').click();
  await openTools(page); await expect(page.locator('.history-footer')).toContainText('2 步',{timeout:15000});
  expect(external).toEqual([]);
});

test('three consecutive real engine games survive restart, side changes and resignation', async ({page}) => {
  test.setTimeout(90000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('./');
  for (const color of ['w','b','w']) {
    await openTools(page); await page.getByRole('button',{name:'对局设置',exact:true}).click();
    await page.getByLabel('我的执棋').selectOption(color); await page.getByLabel('AI 难度').selectOption('0');
    await page.getByRole('button',{name:'应用并开始新局'}).click(); await closeTools(page);
    for (let turn = 0; turn < 4; turn++) {
      await expect(page.getByRole('status',{name:'对局状态'})).toContainText(color === 'w' ? '白方走棋' : '黑方走棋',{timeout:20000});
      const saved = await page.evaluate(()=>JSON.parse(localStorage.getItem('chess-lab.session.v1')!).game);
      const chess = new Chess(saved.initialFen); for (const move of saved.moves) chess.move(move);
      expect(chess.turn()).toBe(color);
      const move = chess.moves({verbose:true}).find(move=>!move.promotion)!;
      await page.getByTestId(`square-${move.from}`).click(); await page.getByTestId(`square-${move.to}`).click();
    }
    // End this game while the final search may still be pending.
    await page.getByRole('button',{name:'认输',exact:true}).click(); await page.getByRole('button',{name:'确认认输'}).click();
    await expect(page.getByRole('status',{name:'对局状态'})).toContainText('认输');
    await page.reload(); await expect(page.getByRole('status',{name:'对局状态'})).toContainText('认输');
  }
  expect(errors).toEqual([]);
});

test('real engine finds mate and terminal state stays frozen after reload', async ({page}) => {
  await page.addInitScript(()=>{
    if (!localStorage.getItem('chess-lab.session.v1')) localStorage.setItem('chess-lab.session.v1',JSON.stringify({version:1,preferences:{flipped:true,sound:false},game:{version:1,initialFen:'7k/5Q2/6K1/8/8/8/8/8 w - - 0 1',moves:[],settings:{mode:'ai',playerColor:'b',difficulty:2},resignedColor:null,promotion:null,startedAt:'2026-10-11T00:00:00.000Z'}}));
  });
  await page.goto('./'); await expect(page.getByRole('status',{name:'对局状态'})).toContainText('白方获胜 · 将死',{timeout:20000});
  await openTools(page); await expect(page.locator('.history-footer')).toContainText('1 步');
  await page.reload(); await expect(page.getByRole('status',{name:'对局状态'})).toContainText('白方获胜 · 将死');
  await openTools(page); await expect(page.locator('.history-footer')).toContainText('1 步');
});
