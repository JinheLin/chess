import { afterEach, expect, test, vi } from 'vitest';
import { MoveSound, moveSound } from '../../src/audio/MoveSound';
import { GameController } from '../../src/game/GameController';
afterEach(()=>vi.unstubAllGlobals());
test('only newly committed moves produce sound, not undo, restore, selection or status updates', () => {
  const game = new GameController(); const a = game.getSnapshot();
  expect(moveSound(a,a)).toBeNull(); game.move('e2','e4'); const b = game.getSnapshot();
  expect(moveSound(a,b)).toBe('move'); expect(moveSound(b,GameController.restore(game.save()).getSnapshot())).toBeNull();
  game.undo(); expect(moveSound(b,game.getSnapshot())).toBeNull();
});
test('capture, check and terminal moves have distinct cues', () => {
  const game = new GameController(); game.move('e2','e4'); game.move('d7','d5'); const before = game.getSnapshot(); game.move('e4','d5');
  expect(moveSound(before,game.getSnapshot())).toBe('capture');
  const check = new GameController('7k/8/8/8/8/8/6K1/R7 w - - 0 1'); const c = check.getSnapshot(); check.move('a1','a8'); expect(moveSound(c,check.getSnapshot())).toBe('check');
  const mate = new GameController('7k/5Q2/6K1/8/8/8/8/8 w - - 0 1'); const d = mate.getSnapshot(); mate.move('f7','g7'); expect(moveSound(d,mate.getSnapshot())).toBe('end');
});
test('audio remains optional if browser blocks or lacks Web Audio', () => {
  vi.stubGlobal('AudioContext',undefined); const sound = new MoveSound();
  expect(()=>{sound.unlock();sound.play('move');sound.dispose();}).not.toThrow();
});
test('audio needs user unlock and releases context on disposal', () => {
  const start = vi.fn(); const close = vi.fn(async()=>{}); const resume = vi.fn(async()=>{});
  class Context {
    state = 'running'; currentTime = 0; destination = {}; resume = resume; close = close;
    createOscillator() { return {type:'sine',frequency:{value:0},connect:vi.fn(),disconnect:vi.fn(),start,stop:vi.fn(),onended:null}; }
    createGain() { return {gain:{setValueAtTime:vi.fn(),linearRampToValueAtTime:vi.fn(),exponentialRampToValueAtTime:vi.fn()},connect:vi.fn(),disconnect:vi.fn()}; }
  }
  vi.stubGlobal('AudioContext',Context); const sound = new MoveSound(); sound.play('move'); expect(start).not.toHaveBeenCalled();
  sound.unlock(); sound.play('capture'); expect(start).toHaveBeenCalledTimes(2); expect(resume).toHaveBeenCalled(); sound.dispose(); expect(close).toHaveBeenCalled();
});
