import { test, expect } from '@playwright/test';
import { closeTools, openTools } from './tools';
test('personality settings persist independently and reset stories on new games',async({page})=>{
  await page.goto('./'); await openTools(page);
  await page.getByLabel('棋手性格').selectOption('victor');await page.getByLabel('互动频率').selectOption('quiet');
  await expect(page.getByLabel('棋手人格')).toContainText('Victor');
  await expect(page.getByLabel('棋手人格')).toContainText('好胜');
  await page.reload(); await openTools(page);
  await expect(page.getByLabel('棋手性格')).toHaveValue('victor');await expect(page.getByLabel('互动频率')).toHaveValue('quiet');
  await page.getByRole('button',{name:'对局设置',exact:true}).click();await expect(page.getByLabel('AI 难度')).toHaveValue('0');await page.getByRole('button',{name:'应用并开始新局'}).click(); await closeTools(page);
  await page.getByRole('button',{name:'认输',exact:true}).click();await page.getByRole('button',{name:'确认认输'}).click();
  await openTools(page); await expect(page.getByRole('status',{name:'棋手对话'})).toContainText('这盘我赢了');
  await page.getByText('本局对话 · 1',{exact:true}).click();await expect(page.getByLabel('对话历史')).toContainText('认输');
  await page.getByRole('button',{name:'开始新局'}).click();await page.getByRole('button',{name:'确认新局'}).click();
  await expect(page.getByText('本局对话 · 0',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('real analysis reacts to an observed tactic without exposing a future variation',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('chess-lab.session.v1',JSON.stringify({version:1,preferences:{flipped:false,sound:false},game:{version:1,initialFen:'4k3/8/8/8/8/8/4q3/4R1K1 w - - 0 1',moves:[],settings:{mode:'ai',playerColor:'w',difficulty:0},resignedColor:null,promotion:null,startedAt:'2026-10-11T00:00:00.000Z'}}));
  });
  await page.goto('./');await expect(page.getByRole('status',{name:'对局状态'})).toContainText('白方走棋',{timeout:20000});
  await page.getByTestId('square-e1').click();await page.getByTestId('square-e2').click();
  await openTools(page); await expect(page.locator('.history-footer')).toContainText('2 步',{timeout:15000});
  await expect(page.getByText('本局对话 · 1',{exact:true})).toBeVisible({timeout:20000});
  await page.getByText('本局对话 · 1',{exact:true}).click();
  await expect(page.getByLabel('对话历史')).not.toContainText('我输了');
  const dialogue = await page.getByLabel('对话历史').locator('p').allTextContents();
  expect(dialogue.join('')).not.toMatch(/[a-h][1-8]/);
  await page.getByRole('button',{name:'悔棋'}).click();await page.getByRole('button',{name:'确认悔棋',exact:true}).click();
  await expect(page.getByText('本局对话 · 0',{exact:true})).toBeVisible();
});
test('removed every-move preference migrates to chatty',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('chess-lab.personality.v1',JSON.stringify({character:'alex',frequency:'every',muted:false})));
  await page.goto('./'); await openTools(page); await expect(page.getByLabel('互动频率')).toHaveValue('chatty');
  await expect(page.getByRole('option',{name:'每步一句'})).toHaveCount(0);
});
