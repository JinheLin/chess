import { afterEach, expect, test, vi } from 'vitest';
import { GameController } from '../../src/game/GameController';
import { PersonalityEngine } from '../../src/personality/PersonalityEngine';
import { CommentarySpeech } from '../../src/audio/CommentarySpeech';
const setup = ()=>{
  const game = new GameController(undefined,{mode:'ai',playerColor:'w',difficulty:0});
  const engine = new PersonalityEngine(game,()=>{throw new Error('unused');},{character:'alex',frequency:'normal',muted:false});engine.connect();
  const said:SpeechSynthesisUtterance[]=[];
  const local = {lang:'zh-CN',localService:true} as SpeechSynthesisVoice;
  const port = {getVoices:()=>[{lang:'en-US'} as SpeechSynthesisVoice,{lang:'zh-CN',localService:false} as SpeechSynthesisVoice,local],speak:vi.fn((u:SpeechSynthesisUtterance)=>{said.push(u);}),cancel:vi.fn()};
  const speech = new CommentarySpeech(engine,port,text=>({text} as SpeechSynthesisUtterance));speech.connect();
  const dispose = ()=>{speech.dispose();engine.dispose();game.disconnectEngine();};
  return {game,engine,speech,port,said,local,dispose};
};
afterEach(()=>vi.useRealTimers());
test('explicit activation reads intro, then new dialogue exactly once with a local Chinese voice',()=>{
  const s=setup();expect(s.said).toHaveLength(0);s.speech.toggle();
  expect(s.said[0].voice).toBe(s.local);expect(s.said[0].text).toContain('下盘好棋');
  s.game.resign();expect(s.said).toHaveLength(2);expect(s.said[1].text).toContain('我赢了');
  s.engine.configure({...s.engine.getSnapshot().settings,frequency:'quiet'});expect(s.said).toHaveLength(2);
  s.dispose();
});
for(const action of ['mute','new','undo','character','off','dispose'] as const) test(`${action} stops old speech and ignores its delayed errors`,()=>{
  const s=setup();s.speech.toggle();s.game.resign();const old=s.said.at(-1)!,late=old.onerror!;
  const count=s.port.cancel.mock.calls.length;
  if(action==='mute') s.engine.configure({...s.engine.getSnapshot().settings,muted:true});
  if(action==='new') s.game.newGame();
  if(action==='undo') s.game.undo();
  if(action==='character') s.engine.configure({...s.engine.getSnapshot().settings,character:'professor'});
  if(action==='off') s.speech.toggle();
  if(action==='dispose') s.speech.dispose();
  expect(s.port.cancel.mock.calls.length).toBeGreaterThan(count);
  late.call(old,{} as SpeechSynthesisErrorEvent);expect(s.speech.getSnapshot().error).toBe('');s.dispose();
});
test('speech errors and silent startup timeouts degrade to text without altering game',()=>{
  vi.useFakeTimers();const s=setup(),fen=s.game.getSnapshot().fen;s.speech.toggle();
  vi.advanceTimersByTime(10001);expect(s.speech.getSnapshot().enabled).toBe(false);expect(s.speech.getSnapshot().error).toContain('朗读未成功');
  s.speech.toggle();s.said.at(-1)!.onerror!.call(s.said.at(-1)!,{} as SpeechSynthesisErrorEvent);
  expect(s.speech.getSnapshot().enabled).toBe(false);expect(s.game.getSnapshot().fen).toBe(fen);s.dispose();
});
test('unsupported browsers stay silent, and reconnect does not replay history',()=>{
  const s=setup();const unavailable=new CommentarySpeech(s.engine,null);unavailable.toggle();expect(unavailable.getSnapshot().supported).toBe(false);
  s.speech.toggle();s.speech.dispose();s.speech.connect();expect(s.said).toHaveLength(1);s.dispose();
});
