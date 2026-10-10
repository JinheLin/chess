import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { expect, test } from 'vitest';
import { GameController } from '../../src/game/GameController';
import { loadSession, saveSession, SESSION_KEY } from '../../src/storage/session';
import type { StoragePort } from '../../src/storage/session';
const play = (game: GameController, moves: string[]) => moves.forEach(move => expect(game.move(move.slice(0,2) as Square,move.slice(2,4) as Square)).toBe(true));
class MemoryStorage implements StoragePort {
  values = new Map<string,string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string,value: string) { this.values.set(key,value); }
}
test('session roundtrip preserves FEN, SAN, settings, orientation and sound', () => {
  const game = new GameController(); play(game,['e2e4','d7d5','e4d5']);
  const storage = new MemoryStorage(); expect(saveSession(game,{flipped:true,sound:false},()=>storage)).toBe(true);
  const restored = loadSession(()=>storage);
  expect(restored.preferences).toEqual({flipped:true,sound:false});
  expect(restored.controller.getSnapshot().fen).toBe(game.getSnapshot().fen);
  expect(restored.controller.getSnapshot().history.map(move=>move.san)).toEqual(['e4','d5','exd5']);
  expect(restored.controller.getSnapshot().settings).toEqual(game.getSnapshot().settings);
  restored.controller.undo(); expect(restored.controller.getSnapshot().history).toHaveLength(2);
});
test('full replay preserves repetition before and after automatic draw', () => {
  const game = new GameController(); play(game,['g1f3','g8f6','f3g1','f6g8','g1f3','g8f6','f3g1']);
  const restored = GameController.restore(game.save()); play(restored,['f6g8']);
  expect(restored.getSnapshot().result).toContain('三次重复');
  const terminal = GameController.restore(restored.save()); expect(terminal.getSnapshot().result).toContain('三次重复');
  terminal.undo(); expect(terminal.getSnapshot().result).toBeNull();
});
test('restore retains en passant rights and captures', () => {
  const game = new GameController(); play(game,['e2e4','a7a6','e4e5','d7d5']);
  const restored = GameController.restore(game.save()); expect(restored.move('e5','d6')).toBe(true);
  expect(restored.getSnapshot().history.at(-1)?.isEnPassant()).toBe(true);
});
test('restore retains lost castling rights even when rook returned home', () => {
  const game = new GameController('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'); play(game,['h1h2','h8h7','h2h1','h7h8']);
  const restored = GameController.restore(game.save()); expect(restored.move('e1','g1')).toBe(false);
});
test.each(['q','r','b','n'] as const)('pending promotion survives reload and permits %s', piece => {
  const game = new GameController('7k/P7/8/8/8/8/8/7K w - - 0 1'); game.move('a7','a8');
  const restored = GameController.restore(game.save()); expect(restored.getSnapshot().phase).toBe('PROMOTION_PENDING');
  restored.promote(piece); expect(restored.getSnapshot().history[0].promotion).toBe(piece);
  expect(GameController.restore(restored.save()).getSnapshot().fen).toBe(restored.getSnapshot().fen);
});
test('resignation survives reload and undo, PGN accurately records the result', () => {
  const game = new GameController(); play(game,['e2e4']); game.resign();
  const restored = GameController.restore(game.save()); expect(restored.getSnapshot().result).toBe('白方获胜 · 黑方认输');
  expect(restored.exportPgn()).toContain('[Result "1-0"]'); expect(restored.exportPgn().trim()).toMatch(/1-0$/);
  restored.undo(); expect(restored.exportPgn()).toContain('[Result "*"]');
});
test('PGN includes SAN, names and final marker without mutating the game', () => {
  const game = new GameController(); play(game,['f2f3','e7e5','g2g4','d8h4']);
  const before = game.getSnapshot(); const pgn = game.exportPgn(); const parsed = new Chess(); parsed.loadPgn(pgn);
  expect(parsed.fen()).toBe(before.fen); expect(parsed.getHeaders().Result).toBe('0-1');
  expect(pgn).toContain('Qh4#'); expect(game.getSnapshot()).toBe(before);
  game.undo(); expect(game.exportPgn().trim()).toMatch(/\*$/);
});
test('custom FEN and draw result are exportable and replayable', () => {
  const game = new GameController('7k/8/6K1/8/8/8/8/8 w - - 0 1');
  const pgn = game.exportPgn(); expect(pgn).toContain('[SetUp "1"]'); expect(pgn).toContain('[Result "1/2-1/2"]');
  const parsed = new Chess(); parsed.loadPgn(pgn); expect(parsed.fen()).toBe(game.getSnapshot().fen);
});
test('corrupt, unsupported and illegal records safely start a fresh game', () => {
  const storage = new MemoryStorage();
  for (const raw of ['{', JSON.stringify({version:2}), JSON.stringify({version:1,preferences:{flipped:false,sound:true},game:{...new GameController().save(),moves:['e2e5']}})]) {
    storage.setItem(SESSION_KEY,raw); const restored = loadSession(()=>storage);
    expect(restored.notice).toContain('无法读取'); expect(restored.controller.getSnapshot().history).toHaveLength(0);
  }
});
test('invalid settings, promotion, resignation and moves after termination are rejected', () => {
  const saved = new GameController().save();
  for (const patch of [{settings:{...saved.settings,difficulty:9}}, {promotion:{from:'e2',to:'e4'}}, {resignedColor:'b'}, {version:9}]) expect(()=>GameController.restore({...saved,...patch})).toThrow();
  expect(()=>GameController.restore({...saved,moves:['g1f3','g8f6','f3g1','f6g8','g1f3','g8f6','f3g1','f6g8','e2e4']})).toThrow();
});
test('storage access and quota failures never break gameplay', () => {
  const unavailable = () => { throw new Error('storage blocked'); };
  const session = loadSession(unavailable); expect(session.notice).toContain('不允许');
  expect(saveSession(session.controller,session.preferences,unavailable)).toBe(false);
  expect(saveSession(new GameController(),{flipped:false,sound:true},()=>({getItem:()=>null,setItem:()=>{throw new Error('quota');}}))).toBe(false);
});
