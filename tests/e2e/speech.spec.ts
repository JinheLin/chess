import {test,expect} from '@playwright/test';
test('voice opt-in speaks dialogue, mute cancels, and new game clears narration',async({page})=>{
  await page.addInitScript(()=>{
    const log:string[]=[];
    Object.defineProperty(window,'__speechLog',{value:log});
    Object.defineProperty(window,'SpeechSynthesisUtterance',{value:class {text:string; constructor(text:string){this.text=text;}}});
    Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[{lang:'zh-CN',localService:true}],speak:(u:{text:string;onstart:()=>void})=>{log.push(u.text);u.onstart?.();},cancel:()=>{log.push('[cancel]');}}});
  });
  await page.goto('./');const voice=page.getByRole('button',{name:'棋手语音',exact:true});
  await expect(voice).toHaveAttribute('aria-pressed','false');await voice.click();
  await expect(page.getByRole('status',{name:'语音状态'})).toContainText('正在朗读');
  await page.getByRole('button',{name:'认输',exact:true}).click();await page.getByRole('button',{name:'确认认输'}).click();
  const readLog=()=>page.evaluate(()=>Reflect.get(window,'__speechLog') as string[]);
  await expect.poll(readLog).toContain('这盘我赢了，谢谢你认真下完。期待再来一盘。');
  await page.getByRole('button',{name:'棋手互动静音'}).click();await expect(voice).toBeDisabled();
  expect((await readLog()).at(-1)).toBe('[cancel]');
  await page.getByRole('button',{name:'棋手互动静音'}).click();
  await page.getByRole('button',{name:'开始新局'}).click();await page.getByRole('button',{name:'确认新局'}).click();
  await expect(page.getByText('本局对话 · 0',{exact:true})).toBeVisible();
  await page.reload();await expect(voice).toHaveAttribute('aria-pressed','false');
});
test('unsupported speech leaves text and game controls usable',async({page})=>{
  await page.addInitScript(()=>{Object.defineProperty(window,'speechSynthesis',{value:undefined});});
  await page.goto('./');await expect(page.getByRole('button',{name:'棋手语音',exact:true})).toBeDisabled();
  await expect(page.getByRole('status',{name:'语音状态'})).toContainText('不支持');
  await expect(page.getByRole('button',{name:'认输',exact:true})).toBeEnabled();
});
