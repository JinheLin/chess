import {test,expect} from '@playwright/test';
import { openTools } from './tools';
test('voice switch speaks dialogue, switches off, and new game clears narration',async({page})=>{
  await page.addInitScript(()=>{
    const log:string[]=[];
    Object.defineProperty(window,'__speechLog',{value:log});
    Object.defineProperty(window,'SpeechSynthesisUtterance',{value:class {text:string; constructor(text:string){this.text=text;}}});
    Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[{lang:'zh-CN',localService:true}],speak:(u:{text:string;onstart:()=>void})=>{log.push(u.text);u.onstart?.();},cancel:()=>{log.push('[cancel]');}}});
  });
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
test('unsupported speech leaves text and game controls usable',async({page})=>{
  await page.addInitScript(()=>{Object.defineProperty(window,'speechSynthesis',{value:undefined});});
  await page.goto('./'); await openTools(page); await expect(page.getByRole('switch',{name:'语音朗读',exact:true})).toBeDisabled();
  await expect(page.getByRole('status',{name:'语音状态'})).toContainText('不支持');
  await expect(page.getByRole('button',{name:'认输',exact:true})).toBeEnabled();
});
