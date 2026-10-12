import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { GameController } from '../../src/game/GameController';
import { FOUR_HOURS_MS, mergePlayUsage, playLimit, validatePlayUsage } from '../../src/game/PlayLimit';
import type { PlayUsage } from '../../src/game/PlayLimit';
import { loadSession, saveSession, SESSION_KEY } from '../../src/storage/session';
import type { StoragePort } from '../../src/storage/session';
import { PLAY_USAGE_KEY, playUsageStore } from '../../src/storage/playUsage';
import type { ChessEngine } from '../../src/engine/ChessEngine';

const start = new Date(2026, 9, 12, 8).getTime();
const entries = (times: number[]): PlayUsage[] => times.map((time, i) => ({ id: `game-${i}`, startedAt: new Date(time).toISOString() }));
const flush = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); };
class MemoryStorage implements StoragePort {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(start); });
afterEach(() => vi.useRealTimers());

test('three games block the fourth; a rolling window frees a slot at exactly four hours', () => {
  const usage = entries([start, start + 60000, start + 120000]);
  expect(playLimit(usage, false, start + FOUR_HOURS_MS - 1)).toMatchObject({ fourHourCount: 3, reached: true, blocked: true, nextAllowedAt: start + FOUR_HOURS_MS });
  expect(playLimit(usage, false, start + FOUR_HOURS_MS)).toMatchObject({ fourHourCount: 2, reached: false, blocked: false });
  expect(playLimit(usage, true, start + 120000)).toMatchObject({ reached: true, blocked: false });
});

test('daily maximum remains in effect after the four-hour window expires and clears at local midnight', () => {
  const midnight = new Date(2026, 9, 12).getTime();
  const usage = entries([0, 4, 8].flatMap(hour => [0, 1, 2].map(minute => midnight + hour * 3600000 + minute * 60000)));
  const tomorrow = new Date(2026, 9, 13).getTime();
  expect(playLimit(usage, false, midnight + 16 * 3600000)).toMatchObject({ dailyCount: 9, fourHourCount: 0, blocked: true, nextAllowedAt: tomorrow });
  expect(playLimit(usage, false, tomorrow)).toMatchObject({ dailyCount: 0, blocked: false });
});

test('midnight does not bypass a still-full rolling window, and the stricter deadline wins', () => {
  const midnight = new Date(2026, 9, 12).getTime();
  const tomorrow = new Date(2026, 9, 13).getTime();
  const usage = entries([0, 5, 10, 11, 15, 16, 23, 23, 23].map(hour => midnight + hour * 3600000));
  expect(playLimit(usage, false, tomorrow - 1)).toMatchObject({ dailyCount: 9, blocked: true, nextAllowedAt: tomorrow + 3 * 3600000 });
  expect(playLimit(usage, false, tomorrow)).toMatchObject({ dailyCount: 0, fourHourCount: 3, blocked: true });
  expect(playLimit(usage, false, tomorrow + 3 * 3600000).blocked).toBe(false);
});

test('empty resets and illegal moves are free; first legal action admits one game and undo never refunds it', () => {
  const game = new GameController();
  game.newGame(); game.newGame(); game.move('e2', 'e5');
  expect(game.getSnapshot().playUsage).toHaveLength(0);
  game.move('e2', 'e4'); game.move('e7', 'e5'); game.undo(); game.undo();
  expect(game.getSnapshot().history).toHaveLength(0);
  expect(game.getSnapshot().playUsage).toHaveLength(1);
  game.move('d2', 'd4'); expect(game.getSnapshot().playUsage).toHaveLength(1);
  game.newGame(); game.resign(); expect(game.getSnapshot().playUsage).toHaveLength(2);
});

test('the third game can finish, but restarting, switching modes and reopening its terminal position are denied', () => {
  const game = new GameController();
  for (let i = 0; i < 2; i++) { game.move('e2', 'e4'); expect(game.newGame()).toBe(true); }
  game.move('e2', 'e4'); expect(game.getSnapshot().playLimit).toMatchObject({ reached: true, blocked: false });
  const before = game.getSnapshot().fen;
  expect(game.newGame({ mode: 'ai', playerColor: 'b', difficulty: 2 })).toBe(false);
  expect(game.getSnapshot().fen).toBe(before); expect(game.getSnapshot().settings.mode).toBe('local');
  expect(game.move('e7', 'e5')).toBe(true); game.undo(); expect(game.getSnapshot().history).toHaveLength(1);
  game.resign(); const terminal = game.getSnapshot().fen;
  expect(game.getSnapshot().playLimit.blocked).toBe(true); expect(game.getSnapshot().canUndo).toBe(false);
  game.undo(); expect(game.getSnapshot().result).toContain('认输');
  expect(game.move('e7', 'e5')).toBe(false); expect(game.newGame()).toBe(false);
  expect(game.getSnapshot().fen).toBe(terminal); expect(game.getSnapshot().playUsage).toHaveLength(3);
});

test('nine games across three four-hour windows exhaust the day', () => {
  const game = new GameController();
  for (let batch = 0; batch < 3; batch++) {
    vi.setSystemTime(start + batch * FOUR_HOURS_MS);
    for (let i = 0; i < 3; i++) {
      if (batch || i) expect(game.newGame()).toBe(true);
      game.resign();
    }
  }
  expect(game.getSnapshot().playLimit).toMatchObject({ dailyCount: 9, blocked: true });
  vi.setSystemTime(start + 3 * FOUR_HOURS_MS); game.refreshPlayLimit();
  expect(game.getSnapshot().playLimit).toMatchObject({ fourHourCount: 0, dailyCount: 9, blocked: true });
  expect(game.newGame()).toBe(false);
  vi.setSystemTime(new Date(2026, 9, 13)); game.refreshPlayLimit();
  expect(game.newGame()).toBe(true); game.resign(); expect(game.getSnapshot().playLimit.dailyCount).toBe(1);
});

test('refresh and a corrupt current session retain the independent ledger', () => {
  const storage = new MemoryStorage(); const game = new GameController(); game.connectPlayUsageStore(playUsageStore(() => storage));
  for (let i = 0; i < 3; i++) { if (i) game.newGame(); game.resign(); }
  saveSession(game, { flipped: false, sound: false }, () => storage);
  const restored = loadSession(() => storage).controller;
  expect(restored.getSnapshot().playUsage).toHaveLength(3); expect(restored.newGame()).toBe(false);
  storage.setItem(SESSION_KEY, 'broken');
  const fresh = loadSession(() => storage).controller;
  expect(fresh.getSnapshot().phase).toBe('PLAY_LIMIT'); expect(fresh.move('e2', 'e4')).toBe(false);
  fresh.resign(); expect(fresh.getSnapshot().result).toBeNull();
});

test('refreshing an admitted unfinished game does not consume another slot', () => {
  const game = new GameController(); game.move('e2', 'e4');
  const restored = GameController.restore(game.save(), [], game.getSnapshot().playUsage);
  expect(restored.move('e7', 'e5')).toBe(true); expect(restored.getSnapshot().playUsage).toHaveLength(1);
});

test('old records migrate into quota counts, including an ongoing saved game', () => {
  const game = new GameController();
  game.move('e2', 'e4'); game.newGame(); game.move('d2', 'd4'); game.newGame(); game.move('c2', 'c4');
  const legacy = { ...game.save() }; delete legacy.playStartedAt;
  const restored = GameController.restore(legacy, game.getSnapshot().records);
  expect(restored.getSnapshot().playUsage).toHaveLength(3);
  expect(restored.getSnapshot().playLimit).toMatchObject({ reached: true, blocked: false });
  restored.resign(); expect(restored.getSnapshot().playLimit.blocked).toBe(true);
});

test('another tab adding the third game prevents a stale empty controller from starting', () => {
  const storage = new MemoryStorage(); const store = playUsageStore(() => storage);
  const a = new GameController(); const b = new GameController(); a.connectPlayUsageStore(store); b.connectPlayUsageStore(store);
  a.resign(); a.newGame(); a.resign(); a.newGame(); a.resign();
  expect(b.move('e2', 'e4')).toBe(false); expect(b.getSnapshot().phase).toBe('PLAY_LIMIT');
  expect(b.getSnapshot().playUsage).toHaveLength(3);
  expect(b.newGame()).toBe(false);
});

test('blocked black-side AI never starts a Worker; expiry initializes it and admits one opening', async () => {
  const best = vi.fn(async () => 'e2e4');
  const engine: ChessEngine = { initialize: async () => {}, setDifficulty: async () => {}, getBestMove: best, dispose: () => {} };
  const factory = vi.fn(() => engine);
  const game = new GameController(undefined, { mode: 'ai', playerColor: 'b', difficulty: 0 }, entries([start, start, start]));
  game.connectEngine(factory); await flush(); expect(factory).not.toHaveBeenCalled();
  expect(game.getSnapshot().phase).toBe('PLAY_LIMIT');
  vi.setSystemTime(start + FOUR_HOURS_MS); game.refreshPlayLimit(); await flush();
  expect(best).toHaveBeenCalledTimes(1); expect(game.getSnapshot().history[0].san).toBe('e4');
  expect(game.getSnapshot().playLimit.fourHourCount).toBe(1); game.disconnectEngine();
});

test('an AI opening returned after another tab fills the quota is rejected without changing the board', async () => {
  const storage = new MemoryStorage(); const store = playUsageStore(() => storage);
  let resolve!: (move: string) => void;
  const engine: ChessEngine = { initialize: async () => {}, setDifficulty: async () => {}, getBestMove: () => new Promise<string>(done => { resolve = done; }), dispose: () => {} };
  const game = new GameController(undefined, { mode: 'ai', playerColor: 'b', difficulty: 0 }); game.connectPlayUsageStore(store);
  game.connectEngine(() => engine); await flush(); store.write(entries([start, start, start]));
  resolve('e2e4'); await flush();
  expect(game.getSnapshot().history).toHaveLength(0); expect(game.getSnapshot().phase).toBe('PLAY_LIMIT'); game.disconnectEngine();
});

test('pending promotion reserves only one game even after cancel, undo and restore', () => {
  const game = new GameController('7k/P7/8/8/8/8/8/7K w - - 0 1'); game.move('a7', 'a8');
  expect(game.getSnapshot().playUsage).toHaveLength(1); game.cancelPromotion();
  game.move('a7', 'a8'); const restored = GameController.restore(game.save(), [], game.getSnapshot().playUsage);
  restored.promote('n'); expect(restored.getSnapshot().playUsage).toHaveLength(1);
});

test('ledger validation rejects duplicate ids, invalid times and invalid versions', () => {
  const usage = entries([start]); expect(validatePlayUsage(usage)).toEqual(usage);
  for (const value of [null, [usage[0], usage[0]], [{ id: 'x', startedAt: 'broken' }]]) expect(() => validatePlayUsage(value)).toThrow();
  const storage = new MemoryStorage(); storage.setItem(PLAY_USAGE_KEY, JSON.stringify({ version: 2, usage }));
  expect(() => playUsageStore(() => storage).read()).toThrow();
});

test('merge keeps midnight games and deduplicates usage without changing their admission time', () => {
  const midnight = new Date(2026, 9, 12).getTime();
  const usage = entries([midnight]);
  expect(mergePlayUsage(usage, usage, start)).toEqual(usage);
  expect(playLimit(mergePlayUsage(usage, [], start), false, start).dailyCount).toBe(1);
});
