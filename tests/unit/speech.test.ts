import { afterEach, expect, test, vi } from 'vitest';
import { GameController } from '../../src/game/GameController';
import { PersonalityEngine } from '../../src/personality/PersonalityEngine';
import { CommentarySpeech } from '../../src/audio/CommentarySpeech';
const setup = ()=>{
  const game = new GameController(undefined,{mode:'ai',playerColor:'w',difficulty:0});
  const engine = new PersonalityEngine(game,()=>{throw new Error('unused');},{character:'alex',frequency:'normal',muted:false});engine.connect();
  const said:SpeechSynthesisUtterance[]=[];
  const local = {lang:'zh-CN',localService:true} as SpeechSynthesisVoice;
  const port = {getVoices:()=>[{lang:'en-US'} as SpeechSynthesisVoice,{lang:'zh-CN',localService:false} as SpeechSynthesisVoice,local],speak:vi.fn((u:SpeechSynthesisUtterance)=>{said.push(u);}),cancel:vi.fn(),resume:vi.fn()};
  const speech = new CommentarySpeech(engine,port,text=>({text} as SpeechSynthesisUtterance));speech.connect();
  const dispose = ()=>{speech.dispose();engine.dispose();game.disconnectEngine();};
  return {game,engine,speech,port,said,local,dispose};
};
afterEach(()=>vi.useRealTimers());
test('explicit activation reads intro, then new dialogue exactly once with a local Chinese voice',()=>{
  vi.useFakeTimers();const s=setup();expect(s.said).toHaveLength(0);s.speech.activate();
  expect(s.said[0].voice).toBe(s.local);expect(s.said[0].text).toContain('下盘好棋');expect(s.port.resume).toHaveBeenCalled();
  s.game.resign();vi.advanceTimersByTime(100);expect(s.said).toHaveLength(2);expect(s.said[1].text).toContain('我赢了');
  s.engine.configure({...s.engine.getSnapshot().settings,frequency:'quiet'});expect(s.said).toHaveLength(2);
  s.dispose();
});
for(const action of ['mute','new','undo','character','off','dispose'] as const) test(`${action} stops old speech and ignores its delayed errors`,()=>{
  vi.useFakeTimers();const s=setup();s.speech.activate();s.game.resign();vi.advanceTimersByTime(100);const old=s.said.at(-1)!,late=old.onerror!;
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
  vi.useFakeTimers();const s=setup(),fen=s.game.getSnapshot().fen;s.speech.activate();
  vi.advanceTimersByTime(10001);expect(s.speech.getSnapshot().enabled).toBe(false);expect(s.speech.getSnapshot().error).toContain('朗读未成功');
  s.speech.toggle();s.said.at(-1)!.onerror!.call(s.said.at(-1)!,{} as SpeechSynthesisErrorEvent);
  expect(s.speech.getSnapshot().enabled).toBe(false);expect(s.game.getSnapshot().fen).toBe(fen);s.dispose();
});
test('unsupported browsers stay silent, and reconnect does not replay history',()=>{
  const s=setup();const unavailable=new CommentarySpeech(s.engine,null);unavailable.toggle();expect(unavailable.getSnapshot().supported).toBe(false);
  s.speech.activate();s.speech.dispose();s.speech.connect();expect(s.said).toHaveLength(1);s.dispose();
});
test('android keeps a chinese voice when getVoices is empty again at speak time',()=>{
  const game = new GameController(undefined,{mode:'ai',playerColor:'w',difficulty:0});
  const engine = new PersonalityEngine(game,()=>{throw new Error('unused');},{character:'alex',frequency:'normal',muted:false});engine.connect();
  const local = {lang:'cmn-Hans-CN',localService:true} as SpeechSynthesisVoice;
  let live:SpeechSynthesisVoice[] = []; const listeners = new Set<EventListener>(); const said:SpeechSynthesisUtterance[] = [];
  const port = {getVoices:()=>live,speak:(utterance:SpeechSynthesisUtterance)=>{said.push(utterance);},cancel:()=>undefined,
    addEventListener:(_type:string,listener:EventListener)=>{listeners.add(listener);},removeEventListener:(_type:string,listener:EventListener)=>{listeners.delete(listener);}};
  const speech = new CommentarySpeech(engine,port,text=>({text} as SpeechSynthesisUtterance));speech.connect();
  live = [local]; listeners.forEach(listener=>listener({} as Event)); live = [];
  speech.activate(); expect(said[0]?.voice).toBe(local); expect(said[0]?.lang).toBe('cmn-Hans-CN');
  speech.dispose(); expect(listeners.size).toBe(0); engine.dispose(); game.disconnectEngine();
});
test('android cancel, interrupted and missing-language errors do not look like a desktop failure',()=>{
  vi.useFakeTimers();const s=setup();s.speech.activate();const spoken=s.said[0]!;
  spoken.onerror!.call(spoken,{error:'interrupted'} as SpeechSynthesisErrorEvent);
  spoken.onerror!.call(spoken,{error:'canceled'} as SpeechSynthesisErrorEvent);
  expect(s.speech.getSnapshot().enabled).toBe(true);expect(s.speech.getSnapshot().error).toBe('');
  s.game.resign();expect(s.port.speak).toHaveBeenCalledTimes(1);vi.advanceTimersByTime(100);expect(s.port.speak).toHaveBeenCalledTimes(2);
  s.said.at(-1)!.onerror!.call(s.said.at(-1)!,{error:'language-unavailable'} as SpeechSynthesisErrorEvent);
  expect(s.speech.getSnapshot().enabled).toBe(false);expect(s.speech.getSnapshot().error).toContain('文字转语音');s.dispose();
});
test('default voice waits for a gesture, activation is once, and switching off stays off',()=>{
  const s=setup();expect(s.speech.getSnapshot().enabled).toBe(true);expect(s.said).toHaveLength(0);
  s.speech.toggle();s.speech.activate();expect(s.said).toHaveLength(0);
  s.speech.toggle();expect(s.said).toHaveLength(1);s.speech.activate();expect(s.said).toHaveLength(1);
  s.dispose();
});
