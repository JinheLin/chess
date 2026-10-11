import { afterEach, expect, test, vi } from 'vitest';
import { boardEffect, MoveSound, moveSound } from '../../src/audio/MoveSound';
import { GameController } from '../../src/game/GameController';
afterEach(()=>vi.unstubAllGlobals());
test('only newly committed moves produce sound, not undo, restore, selection or status updates', () => {
  const game = new GameController(); const a = game.getSnapshot();
  expect(moveSound(a,a)).toBeNull(); game.move('e2','e4'); const b = game.getSnapshot();
  expect(moveSound(a,b)).toBe('move'); expect(moveSound(b,GameController.restore(game.save()).getSnapshot())).toBeNull();
  game.undo(); expect(moveSound(b,game.getSnapshot())).toBeNull();
});
test('capture, check and checkmate have distinct cues', () => {
  const game = new GameController(); game.move('e2','e4'); game.move('d7','d5'); const before = game.getSnapshot(); game.move('e4','d5');
  const captured = game.getSnapshot();
  expect(moveSound(before,captured)).toBe('capture'); expect(boardEffect(captured)).toEqual({kind:'capture',square:'d5'});
  const check = new GameController('k7/8/8/8/8/8/6K1/r6R w - - 0 1'); const c = check.getSnapshot(); check.move('h1','a1');
  const checked = check.getSnapshot();
  expect(moveSound(c,checked)).toBe('check'); expect(boardEffect(checked)?.kind).toBe('check');
  const mate = new GameController('7k/5Q2/6K1/8/8/8/8/8 w - - 0 1'); const d = mate.getSnapshot(); mate.move('f7','g7');
  expect(moveSound(d,mate.getSnapshot())).toBe('mate'); expect(boardEffect(mate.getSnapshot())?.kind).toBe('mate');
  const takingMate = new GameController('6k1/6p1/6K1/8/8/8/8/Q7 w - - 0 1'); const e = takingMate.getSnapshot(); takingMate.move('a1','g7');
  expect(moveSound(e,takingMate.getSnapshot())).toBe('mate');
});
test('audio remains optional if browser blocks or lacks Web Audio', () => {
  vi.stubGlobal('AudioContext',undefined); const sound = new MoveSound();
  expect(()=>{sound.unlock();sound.play('move');sound.dispose();}).not.toThrow();
});
const mockAudio = (resume = vi.fn(async () => {}), state = 'running') => {
  const start = vi.fn(); const close = vi.fn(async () => {}); const prime = vi.fn();
  class Context {
    state = state; currentTime = 0; destination = {}; sampleRate = 44100; resume = resume; close = close;
    createBuffer() { return {}; }
    createBufferSource() { return {buffer:null, connect:vi.fn(), start:prime}; }
    createOscillator() { return {type:'sine',frequency:{value:0},connect:vi.fn(),disconnect:vi.fn(),start,stop:vi.fn(),onended:null}; }
    createGain() { return {gain:{setValueAtTime:vi.fn(),linearRampToValueAtTime:vi.fn(),exponentialRampToValueAtTime:()=>{ throw new Error('exponential ramp'); }},connect:vi.fn(),disconnect:vi.fn()}; }
  }
  return {Context, start, close, prime};
};
test('audio needs user unlock and releases context on disposal', () => {
  const resume = vi.fn(async () => {}); const {Context, start, close, prime} = mockAudio(resume);
  vi.stubGlobal('AudioContext', Context); const sound = new MoveSound(); sound.play('move'); expect(start).not.toHaveBeenCalled();
  sound.unlock(); expect(prime).toHaveBeenCalledTimes(1); sound.play('capture'); expect(start).toHaveBeenCalledTimes(2); expect(resume).toHaveBeenCalled(); sound.dispose(); expect(close).toHaveBeenCalled();
});
test('older Android WebViews fall back to webkitAudioContext', () => {
  const {Context, start} = mockAudio();
  vi.stubGlobal('AudioContext', undefined); vi.stubGlobal('webkitAudioContext', Context);
  const sound = new MoveSound(); sound.unlock(); sound.play('move'); expect(start).toHaveBeenCalledTimes(1); sound.dispose();
});
test('a suspended Android context plays once resume resolves', async () => {
  const start = vi.fn(); let state = 'suspended';
  class Context {
    get state() { return state; }
    currentTime = 0; destination = {}; sampleRate = 44100;
    resume = () => Promise.resolve().then(() => { state = 'running'; });
    close = async () => {};
    createBuffer() { return {}; }
    createBufferSource() { return {buffer:null, connect:vi.fn(), start:vi.fn()}; }
    createOscillator() { return {type:'sine',frequency:{value:0},connect:vi.fn(),disconnect:vi.fn(),start,stop:vi.fn(),onended:null}; }
    createGain() { return {gain:{setValueAtTime:vi.fn(),linearRampToValueAtTime:vi.fn()},connect:vi.fn(),disconnect:vi.fn()}; }
  }
  vi.stubGlobal('AudioContext', Context);
  const sound = new MoveSound(); sound.unlock(); sound.play('move'); expect(start).not.toHaveBeenCalled();
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(start).toHaveBeenCalledTimes(1); sound.dispose();
});
