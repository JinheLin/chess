import { expect, test } from 'vitest';
import { Chess } from 'chess.js';
import type { AnalysisEngine, Evaluation } from '../../src/engine/AnalysisEngine';
import type { SearchOptions } from '../../src/engine/ChessEngine';
import { GameCoach, describeMove, reviewMove } from '../../src/coaching/GameCoach';
import { GameController } from '../../src/game/GameController';
import { validateGameRecords } from '../../src/game/GameRecord';

const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const evaluation = (value = 25, pv = ['e2e4'], stable = true): Evaluation => ({ depth: 16, score: { kind: 'cp', value }, pv, stable });
class Analyzer implements AnalysisEngine {
  requests: { fen: string; options: SearchOptions; resolve: (value: Evaluation | null) => void; reject: (error: Error) => void }[] = [];
  disposed = false;
  analyze(fen: string, options: SearchOptions) { return new Promise<Evaluation | null>((resolve, reject) => this.requests.push({ fen, options, resolve, reject })); }
  dispose() { this.disposed = true; }
}
async function setup(color: 'w' | 'b' = 'w', fen?: string) {
  const game = new GameController(fen, { mode: 'ai', playerColor: color, difficulty: 0, coaching: true });
  let reply: (move: string) => void = () => {};
  game.connectEngine(() => ({ initialize: async () => {}, setDifficulty: async () => {}, getBestMove: () => new Promise<string>(resolve => { reply = resolve; }), dispose: () => {} }));
  const analyzers: Analyzer[] = [];
  const coach = new GameCoach(game, () => { const analyzer = new Analyzer(); analyzers.push(analyzer); return analyzer; });
  coach.connect(); await flush();
  return { game, coach, analyzers, reply: async (move: string) => { await flush(); reply(move); await flush(); }, dispose: () => { coach.dispose(); game.disconnectEngine(); } };
}
test('hints are legal, read only, include history and can be hidden', async () => {
  const { game, coach, analyzers, dispose } = await setup();
  const saved = game.save(); coach.requestHint(); coach.requestHint();
  expect(analyzers).toHaveLength(1);
  expect(analyzers[0].requests[0].options).toMatchObject({ initialFen: saved.initialFen, moves: [] });
  analyzers[0].requests[0].resolve(evaluation()); await flush();
  expect(coach.getSnapshot().hint).toMatchObject({ from: 'e2', to: 'e4' });
  expect(game.save()).toEqual(saved); expect(analyzers[0].disposed).toBe(true);
  coach.hideHint(); expect(coach.getSnapshot().hint).toBeNull(); dispose();
});
test('review waits for the opponent, replays player history and uses opposite score signs', async () => {
  const { game, coach, analyzers, reply, dispose } = await setup();
  game.move('e2', 'e4'); await flush(); expect(analyzers).toHaveLength(0);
  await reply('e7e5'); expect(analyzers).toHaveLength(1);
  const a = analyzers[0];
  expect(a.requests[0].options.moves).toEqual([]);
  a.requests[0].resolve(evaluation(150, ['d2d4'])); await flush();
  expect(a.requests[1].options.moves).toEqual(['e2e4']);
  a.requests[1].resolve(evaluation(150)); await flush();
  expect(coach.getSnapshot().feedback).toContain('较大疏漏');
  expect(coach.getSnapshot().feedback).toContain('d2 → d4');
  expect(game.getSnapshot().history).toHaveLength(2); dispose();
});
for (const action of ['move', 'new', 'local', 'resign', 'dispose', 'reconnect'] as const) {
  test(`${action} invalidates hints even if analysis ignores abort`, async () => {
    const { game, coach, analyzers, dispose } = await setup(); coach.requestHint();
    const request = analyzers[0].requests[0];
    if (action === 'move') game.move('d2', 'd4');
    if (action === 'new') game.newGame();
    if (action === 'local') game.newGame({ mode: 'local', playerColor: 'w', difficulty: 0 });
    if (action === 'resign') game.resign();
    if (action === 'dispose') coach.dispose();
    if (action === 'reconnect') { coach.dispose(); coach.connect(); }
    expect(request.options.signal?.aborted).toBe(true); expect(analyzers[0].disposed).toBe(true);
    request.resolve(evaluation()); await flush(); expect(coach.getSnapshot().hint).toBeNull(); dispose();
  });
}
test('undo cancels review and no stale feedback is published', async () => {
  const { game, coach, analyzers, reply, dispose } = await setup();
  game.move('e2', 'e4'); await reply('e7e5'); const a = analyzers[0];
  a.requests[0].resolve(evaluation()); await flush(); game.undo();
  expect(a.requests[1].options.signal?.aborted).toBe(true);
  a.requests[1].resolve(evaluation(-25)); await flush();
  expect(coach.getSnapshot().feedback).toBeNull(); expect(game.getSnapshot().history).toHaveLength(0); dispose();
});
test('black-side hints include the opening history and reviews use the black move', async () => {
  const { game, coach, analyzers, reply, dispose } = await setup('b');
  coach.requestHint(); expect(analyzers).toHaveLength(0); await reply('e2e4');
  coach.requestHint(); const a = analyzers[0];
  expect(a.requests[0].options.moves).toEqual(['e2e4']); a.requests[0].resolve(evaluation(25, ['e7e5'])); await flush();
  expect(coach.getSnapshot().hint?.from).toBe('e7'); game.move('e7', 'e5'); await reply('g1f3');
  const review = analyzers[1]; expect(review.requests[0].options.moves).toEqual(['e2e4']);
  review.requests[0].resolve(evaluation(25, ['e7e5'])); await flush();
  review.requests[1].resolve(evaluation(-25)); await flush();
  expect(coach.getSnapshot().feedback).toContain('你走了 e5'); expect(coach.getSnapshot().feedback).toContain('推荐一致'); dispose();
});
test('unavailable or illegal hints can retry without blocking play', async () => {
  const { game, coach, analyzers, dispose } = await setup(); const fen = game.getSnapshot().fen;
  coach.requestHint(); analyzers[0].requests[0].resolve(evaluation(25, ['e2e5'])); await flush();
  expect(coach.getSnapshot().error).toContain('暂不可用'); expect(coach.getSnapshot().hint).toBeNull();
  coach.retry(); analyzers[1].requests[0].reject(new Error('offline')); await flush();
  expect(game.getSnapshot().fen).toBe(fen); expect(game.move('e2', 'e4')).toBe(true); dispose();
});
test.each([
  ['r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'e1g1', '王车易位'],
  ['4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1', 'e5d6', '吃过路兵'],
  ['7k/P7/8/8/8/8/8/7K w - - 0 1', 'a7a8n', '升变为马'],
])('special recommendation uses chess.js facts for %s', (fen, lan, expected) => {
  const move = new Chess(fen).moves({ verbose: true }).find(candidate => candidate.lan === lan)!;
  expect(move).toBeDefined(); expect(JSON.stringify(describeMove(move))).toContain(expected);
});
test('promotion and terminal states cancel pending hints', async () => {
  const { game, coach, analyzers, dispose } = await setup('w', '7k/P7/8/8/8/8/8/7K w - - 0 1');
  coach.requestHint(); game.move('a7', 'a8'); expect(game.getSnapshot().phase).toBe('PROMOTION_PENDING');
  analyzers[0].requests[0].resolve(evaluation(1, ['a7a8q'])); await flush();
  expect(coach.getSnapshot().hint).toBeNull(); coach.requestHint(); expect(analyzers).toHaveLength(1);
  game.promote('n'); expect(game.getSnapshot().phase).toBe('GAME_OVER'); coach.requestHint(); expect(analyzers).toHaveLength(1); dispose();
});
test('unstable evaluations avoid grading and mate scores never become centipawn loss', () => {
  const move = new Chess().move('e4');
  expect(reviewMove(move, evaluation(900, ['d2d4'], false), evaluation(900))).toContain('暂不判断');
  expect(reviewMove(move, evaluation(150, ['d2d4']), evaluation(-150))).toContain('没有明显损失');
  expect(reviewMove(move, evaluation(150, ['d2d4']), { ...evaluation(), score: { kind: 'mate', value: 2 } })).toContain('王的安全');
});
test('coaching survives save, records, PGN and new games; legacy saves stay ordinary', () => {
  const game = new GameController(undefined, { mode: 'ai', playerColor: 'w', difficulty: 0, coaching: true });
  const saved = game.save(); const restored = GameController.restore(saved);
  expect(restored.getSnapshot().settings.coaching).toBe(true); expect(restored.exportPgn()).toContain('[Mode "Coaching"]');
  restored.resign(); expect(validateGameRecords(restored.getSnapshot().records)[0].settings.coaching).toBe(true);
  restored.newGame(); expect(restored.getSnapshot().settings.coaching).toBe(true);
  const legacy = new GameController().save(); expect(GameController.restore(legacy).getSnapshot().settings.coaching).toBeUndefined();
  for (const settings of [{ ...saved.settings, coaching: 'true' }, { ...saved.settings, mode: 'local' }]) {
    expect(() => GameController.restore({ ...saved, settings })).toThrow('指导棋');
    expect(() => validateGameRecords([{ ...restored.getSnapshot().records[0], settings }])).toThrow('指导棋');
    expect(() => game.newGame(settings as typeof saved.settings)).toThrow('指导棋'); expect(game.save()).toEqual(saved);
  }
});
test('ordinary and local games never run coach analysis', async () => {
  for (const mode of ['local', 'ai'] as const) {
    const game = new GameController(undefined, { mode, playerColor: 'w', difficulty: 0 }); let calls = 0;
    const coach = new GameCoach(game, () => { calls++; return new Analyzer(); }); coach.connect(); coach.requestHint();
    game.move('e2', 'e4'); await flush(); expect(calls).toBe(0); coach.dispose();
  }
});
