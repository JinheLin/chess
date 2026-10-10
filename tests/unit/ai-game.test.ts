import { expect, test } from 'vitest';
import { GameController } from '../../src/game/GameController';
import type { ChessEngine, SearchOptions } from '../../src/engine/ChessEngine';
import type { GameSettings } from '../../src/game/GameState';
const flush = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); };
class FakeEngine implements ChessEngine {
  disposed = false;
  skill = -1;
  requests: {fen: string; options: SearchOptions; resolve: (move: string)=>void; reject: (error: Error)=>void}[] = [];
  async initialize() {}
  async setDifficulty(level: number) { this.skill = level; }
  getBestMove(fen: string, options: SearchOptions) {
    return new Promise<string>((resolve,reject) => this.requests.push({fen,options,resolve,reject}));
  }
  dispose() { this.disposed = true; }
}
function setup(playerColor: 'w'|'b' = 'w', fen?: string) {
  const engines: FakeEngine[] = [];
  const settings: GameSettings = {mode:'ai', playerColor, difficulty:1};
  const game = new GameController(fen, settings);
  game.connectEngine(() => { const engine = new FakeEngine(); engines.push(engine); return engine; });
  return {game,engines,settings};
}
test('white player moves then AI responds with full history and SAN', async () => {
  const {game,engines} = setup(); await flush(); expect(game.getSnapshot().phase).toBe('PLAYER_TURN');
  game.move('e2','e4'); await flush(); expect(game.getSnapshot().phase).toBe('AI_THINKING');
  expect(game.move('e7','e5')).toBe(false); expect(engines[0].requests[0].options.moves).toEqual(['e2e4']);
  engines[0].requests[0].resolve('e7e5'); await flush();
  expect(game.getSnapshot().history.map(x=>x.san)).toEqual(['e4','e5']); expect(game.getSnapshot().phase).toBe('PLAYER_TURN'); game.disconnectEngine();
});
test('black player starts with AI white and cannot undo its opening', async () => {
  const {game,engines} = setup('b'); await flush(); expect(game.getSnapshot().phase).toBe('AI_THINKING');
  engines[0].requests[0].resolve('e2e4'); await flush(); expect(game.getSnapshot().turn).toBe('b');
  expect(game.getSnapshot().canUndo).toBe(false); game.undo(); expect(game.getSnapshot().history).toHaveLength(1); game.disconnectEngine();
});
test('undo rolls back both plies; undo during search only rolls back the human move', async () => {
  const {game,engines} = setup(); await flush(); game.move('e2','e4'); await flush();
  engines[0].requests[0].resolve('e7e5'); await flush(); game.undo(); await flush(); expect(game.getSnapshot().history).toHaveLength(0);
  game.move('d2','d4'); await flush(); const pending = engines[0].requests[1]; game.undo(); await flush();
  expect(pending.options.signal?.aborted).toBe(true); pending.resolve('d7d5'); await flush();
  expect(game.getSnapshot().history).toHaveLength(0); expect(game.getSnapshot().phase).toBe('PLAYER_TURN'); game.disconnectEngine();
});
test('new game invalidates stale results even if an engine ignores abort', async () => {
  const {game,engines} = setup(); await flush(); game.move('e2','e4'); await flush(); const old = engines[0].requests[0];
  game.newGame(); await flush(); old.resolve('e7e5'); await flush();
  expect(engines[0].disposed).toBe(true); expect(game.getSnapshot().history).toHaveLength(0); game.disconnectEngine();
});
test('side and difficulty change restart safely and configure new engine', async () => {
  const {game,engines,settings} = setup(); await flush(); game.move('e2','e4'); await flush();
  game.newGame({...settings,playerColor:'b',difficulty:2}); await flush(); engines[0].requests[0].resolve('e7e5'); await flush();
  expect(engines[1].skill).toBe(16); expect(game.getSnapshot().history).toHaveLength(0);
  engines[1].requests[0].resolve('d2d4'); await flush(); expect(game.getSnapshot().history.map(x=>x.san)).toEqual(['d4']); game.disconnectEngine();
});
test('illegal AI move preserves board, enters error, and retry recovers', async () => {
  const {game,engines} = setup(); await flush(); game.move('e2','e4'); await flush(); const fen = game.getSnapshot().fen;
  engines[0].requests[0].resolve('e7e4'); await flush(); expect(game.getSnapshot().phase).toBe('ENGINE_ERROR'); expect(game.getSnapshot().fen).toBe(fen);
  game.retryEngine(); await flush(); engines[1].requests[0].resolve('e7e5'); await flush(); expect(game.getSnapshot().phase).toBe('PLAYER_TURN'); game.disconnectEngine();
});
test('engine load failure can retry or switch to local', async () => {
  const game = new GameController(undefined,{mode:'ai',playerColor:'w',difficulty:0});
  const engine = new FakeEngine(); engine.initialize = async () => {throw new Error('failed');};
  game.connectEngine(()=>engine); await flush(); expect(game.getSnapshot().phase).toBe('ENGINE_ERROR');
  game.newGame({mode:'local',playerColor:'w',difficulty:0}); expect(game.move('e2','e4')).toBe(true); game.disconnectEngine();
});
test('unmount and reconnect isolate old callbacks', async () => {
  const {game,engines} = setup('b'); await flush(); game.disconnectEngine(); engines[0].requests[0].resolve('e2e4'); await flush();
  expect(game.getSnapshot().history).toHaveLength(0);
  const fresh = new FakeEngine(); game.connectEngine(()=>fresh); await flush(); fresh.requests[0].resolve('d2d4'); await flush();
  expect(game.getSnapshot().history.map(x=>x.san)).toEqual(['d4']); game.disconnectEngine();
});
test('resigning during search awards win to AI and blocks late results', async () => {
  const {game,engines} = setup('b'); await flush(); game.resign(); engines[0].requests[0].resolve('e2e4'); await flush();
  expect(game.getSnapshot().result).toBe('白方获胜 · 黑方认输'); expect(game.getSnapshot().history).toHaveLength(0); game.disconnectEngine();
});
test('AI promotion and checkmate are validated by rules', async () => {
  const {game,engines} = setup('b','7k/P7/8/8/8/8/8/7K w - - 0 1'); await flush();
  engines[0].requests[0].resolve('a7a8n'); await flush(); expect(game.getSnapshot().history[0].san).toBe('a8=N'); expect(game.getSnapshot().result).toContain('子力不足'); game.disconnectEngine();
});
test('no AI search begins in terminal positions', async () => {
  const {game,engines} = setup('b','7k/8/6K1/8/8/8/8/8 w - - 0 1'); await flush();
  expect(game.getSnapshot().phase).toBe('GAME_OVER'); expect(engines).toHaveLength(0); game.disconnectEngine();
});
test('AI mating move ends game and freezes the board', async () => {
  const {game,engines} = setup('b','7k/5Q2/6K1/8/8/8/8/8 w - - 0 1'); await flush();
  engines[0].requests[0].resolve('f7g7'); await flush();
  expect(game.getSnapshot().result).toBe('白方获胜 · 将死'); expect(game.move('h8','h7')).toBe(false); game.disconnectEngine();
});
test('disconnect during initialization prevents late setup from starting a search', async () => {
  const engine = new FakeEngine(); let finish!: () => void;
  engine.initialize = () => new Promise<void>(resolve => {finish = resolve;});
  const game = new GameController(undefined,{mode:'ai',playerColor:'b',difficulty:1});
  game.connectEngine(()=>engine); game.disconnectEngine(); finish(); await flush();
  expect(engine.disposed).toBe(true); expect(engine.requests).toHaveLength(0);
});
test('restored AI turn sends its full pre-refresh history and produces one reply', async () => {
  const {game,engines} = setup(); await flush(); game.move('e2','e4'); await flush();
  const saved = game.save(); game.disconnectEngine();
  const restored = GameController.restore(saved); const engine = new FakeEngine(); restored.connectEngine(()=>engine); await flush();
  expect(engine.requests).toHaveLength(1); expect(engine.requests[0].options.moves).toEqual(['e2e4']);
  engines[0].requests[0].resolve('e7e5'); await flush(); expect(restored.getSnapshot().history).toHaveLength(1);
  engine.requests[0].resolve('c7c5'); await flush(); expect(restored.getSnapshot().history.map(move=>move.san)).toEqual(['e4','c5']); restored.disconnectEngine();
});
test('cancelling a restored human promotion initializes the engine for further play', async () => {
  const game = new GameController('7k/P7/8/8/8/8/8/7K w - - 0 1',{mode:'ai',playerColor:'w',difficulty:0});
  game.connectEngine(()=>new FakeEngine()); await flush(); game.move('a7','a8'); const restored = GameController.restore(game.save()); game.disconnectEngine();
  const engine = new FakeEngine(); restored.connectEngine(()=>engine); expect(restored.getSnapshot().phase).toBe('PROMOTION_PENDING');
  restored.cancelPromotion(); await flush(); expect(restored.getSnapshot().phase).toBe('PLAYER_TURN');
  restored.move('a7','a8'); restored.promote('q'); await flush(); expect(engine.requests).toHaveLength(1); restored.disconnectEngine();
});
