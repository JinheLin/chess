import {test,expect,type Page} from '@playwright/test';
import { closeTools, openTools } from './tools';
async function mockSpeech(page:Page) {
  await page.addInitScript(()=>{
    const log:string[]=[];
    Object.defineProperty(window,'__speechLog',{value:log});
    Object.defineProperty(window,'SpeechSynthesisUtterance',{value:class {text:string; constructor(text:string){this.text=text;}}});
    Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[{lang:'zh-CN',localService:true}],speak:(u:{text:string;onstart:()=>void})=>{
      if (!log.length && !navigator.userActivation.isActive) throw new Error('First speech needs a user gesture');
      log.push(u.text);u.onstart?.();
    },cancel:()=>{log.push('[cancel]');}}});
  });
}
async function seedMate(page:Page) {
  await page.addInitScript(()=>{
    localStorage.setItem('chess-lab.session.v1',JSON.stringify({version:1,preferences:{flipped:false,sound:false},game:{version:1,initialFen:'7k/5Q2/6K1/8/8/8/8/8 w - - 0 1',moves:[],settings:{mode:'ai',playerColor:'w',difficulty:0},resignedColor:null,promotion:null,startedAt:'2026-10-12T00:00:00.000Z'}}));
  });
}
const readSpeech = (page:Page)=>page.evaluate(()=>Reflect.get(window,'__speechLog') as string[]);
test('voice switch speaks dialogue, switches off, and new game clears narration',async({page})=>{
  await mockSpeech(page);
  await page.goto('./'); await openTools(page); const voice=page.getByRole('switch',{name:'语音朗读',exact:true});
  await expect(voice).toHaveAttribute('aria-checked','true');await expect(page.getByLabel('互动频率')).toHaveValue('chatty');await page.getByRole('heading',{name:'Alex',exact:true}).click();
  await expect(page.getByRole('status',{name:'语音状态'})).toContainText('正在朗读');
  await page.getByRole('button',{name:'认输',exact:true}).click();await page.getByRole('button',{name:'确认认输'}).click();
  const readLog=()=>page.evaluate(()=>Reflect.get(window,'__speechLog') as string[]);
  await expect.poll(readLog).toContain('这盘我赢了，谢谢你认真下完。期待再来一盘。');
  await voice.click();await expect(voice).toHaveAttribute('aria-checked','false');
  expect((await readLog()).at(-1)).toBe('[cancel]');
  await page.getByRole('button',{name:'开始新局'}).click();await page.getByRole('button',{name:'确认新局'}).click();
  await expect(page.getByText('本局对话 · 0',{exact:true})).toBeVisible();
  await page.reload(); await openTools(page); await expect(voice).toHaveAttribute('aria-checked','true');
});
test.describe('touch speech activation',()=>{
  test.use({hasTouch:true});
  for (const viewport of [{width:600,height:900},{width:1024,height:768}]) {
    test(`board taps activate speech with collapsed dialogue at ${viewport.width}px`,async({page})=>{
      await page.setViewportSize(viewport);await mockSpeech(page);await seedMate(page);
      await page.goto('./');await expect(page.getByRole('status',{name:'对局状态'})).toContainText('白方走棋',{timeout:20000});
      const history=page.locator('.personality-panel details');
      await expect(history).toHaveJSProperty('open',false);
      if (viewport.width<=720) await expect(page.locator('#more-tools')).toBeHidden();
      expect(await readSpeech(page)).toEqual([]);
      await page.getByTestId('square-f7').tap();
      await expect.poll(()=>readSpeech(page)).toHaveLength(1);
      expect((await readSpeech(page))[0]).toContain('下盘好棋');
      await page.getByTestId('square-g7').tap();
      await expect(page.getByRole('status',{name:'对局状态'})).toContainText('白方获胜 · 将死');
      await expect.poll(()=>readSpeech(page)).toContain('恭喜你赢下这一盘！谢谢切磋。');
      await expect(history).toHaveJSProperty('open',false);
      if (viewport.width<=720) await expect(page.locator('#more-tools')).toBeHidden();
      const spoken=await readSpeech(page);
      expect(spoken.filter(text=>text!=='[cancel]')).toHaveLength(2);
      await openTools(page);await history.locator('summary').tap();await history.locator('summary').tap();await closeTools(page);
      await expect(history).toHaveJSProperty('open',false);
      expect(await readSpeech(page)).toEqual(spoken);
    });
  }
  test('touching the voice switch first stays silent and later board taps respect mute',async({page})=>{
    await page.setViewportSize({width:1024,height:768});await mockSpeech(page);await seedMate(page);
    await page.goto('./');await expect(page.getByRole('status',{name:'对局状态'})).toContainText('白方走棋',{timeout:20000});
    const voice=page.getByRole('switch',{name:'语音朗读',exact:true});
    await voice.locator('span').tap();await expect(voice).toHaveAttribute('aria-checked','false');
    expect(await readSpeech(page)).toEqual([]);
    await page.getByTestId('square-f7').tap();expect(await readSpeech(page)).toEqual([]);
    await voice.tap();await expect(voice).toHaveAttribute('aria-checked','true');
    await expect.poll(()=>readSpeech(page)).toHaveLength(1);
    await voice.tap();await expect(voice).toHaveAttribute('aria-checked','false');
    const spoken=await readSpeech(page);
    await page.getByTestId('square-g7').tap();
    await expect(page.getByRole('status',{name:'对局状态'})).toContainText('白方获胜 · 将死');
    await expect(voice).toHaveAttribute('aria-checked','false');expect(await readSpeech(page)).toEqual(spoken);
  });
});
test('unsupported speech leaves text and game controls usable',async({page})=>{
  await page.addInitScript(()=>{Object.defineProperty(window,'speechSynthesis',{value:undefined});});
  await page.goto('./'); await openTools(page); await expect(page.getByRole('switch',{name:'语音朗读',exact:true})).toBeDisabled();
  await expect(page.getByRole('status',{name:'语音状态'})).toContainText('不支持');
  await expect(page.getByRole('button',{name:'认输',exact:true})).toBeEnabled();
});
