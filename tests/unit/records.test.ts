import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { GameController } from '../../src/game/GameController';
import { MAX_GAME_RECORDS, validateGameRecords } from '../../src/game/GameRecord';
import { loadSession, saveSession, SESSION_KEY } from '../../src/storage/session';
import type { StoragePort } from '../../src/storage/session';

const start = '2026-10-12T01:00:00.000Z';
const play = (game: GameController, moves: string[]) => moves.forEach(move => expect(game.move(move.slice(0, 2) as Square, move.slice(2, 4) as Square)).toBe(true));
class MemoryStorage implements StoragePort {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(start); });
afterEach(() => vi.useRealTimers());

test('checkmate saves start, fixed duration, result and replayable PGN', () => {
  const game = new GameController();
  play(game, ['f2f3', 'e7e5', 'g2g4']);
  vi.setSystemTime('2026-10-12T01:01:33.000Z');
  play(game, ['d8h4']);
  const [record] = game.getSnapshot().records;
  expect(record).toMatchObject({ startedAt: start, endedAt: '2026-10-12T01:01:33.000Z', durationMs: 93000, result: '黑方获胜 · 将死', plyCount: 4 });
  const chess = new Chess(); chess.loadPgn(record.pgn);
  expect(chess.isCheckmate()).toBe(true);
  expect(chess.getHeaders()).toMatchObject({ Result: '0-1', StartTime: start, EndTime: record.endedAt, Duration: '93s', UTCTime: '01:00:00' });
  vi.setSystemTime('2026-10-12T02:00:00.000Z');
  game.connectEngine(() => { throw new Error('local game must not create an engine'); });
  expect(game.getSnapshot().records).toEqual([record]);
  expect(game.save().endedAt).toBe(record.endedAt);
});

test('refresh keeps finished duration and identity without duplicate records', () => {
  const game = new GameController();
  vi.setSystemTime('2026-10-12T01:02:00.000Z'); game.resign();
  const storage = new MemoryStorage(); saveSession(game, { flipped: false, sound: true }, () => storage);
  vi.setSystemTime('2026-10-13T01:00:00.000Z');
  const restored = loadSession(() => storage).controller;
  expect(restored.getSnapshot().records).toEqual(game.getSnapshot().records);
  expect(restored.save().id).toBe(game.save().id);
  restored.newGame();
  expect(restored.getSnapshot().records).toHaveLength(1);
  expect(restored.save().endedAt).toBeNull();
  saveSession(restored, { flipped: false, sound: true }, () => storage);
  expect(loadSession(() => storage).controller.getSnapshot().records).toEqual(game.getSnapshot().records);
});

test('refresh of an ongoing game retains its original start and counts time away', () => {
  const game = new GameController(); play(game, ['e2e4']);
  vi.setSystemTime('2026-10-12T01:05:00.000Z');
  const restored = GameController.restore(game.save());
  expect(restored.getSnapshot().records).toHaveLength(0);
  vi.setSystemTime('2026-10-12T01:10:00.000Z'); restored.resign();
  expect(restored.getSnapshot().records[0]).toMatchObject({ startedAt: start, durationMs: 600000, result: '白方获胜 · 黑方认输' });
});

test.each(['mate', 'resign', 'repetition'] as const)('undoing %s withdraws its record and finishing again replaces it', kind => {
  const game = new GameController();
  if (kind === 'mate') play(game, ['f2f3', 'e7e5', 'g2g4', 'd8h4']);
  else if (kind === 'repetition') play(game, ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8']);
  else game.resign();
  const [original] = game.getSnapshot().records;
  game.undo();
  expect(game.getSnapshot().records).toHaveLength(0);
  expect(game.save().endedAt).toBeNull();
  const restored = GameController.restore(game.save(), game.getSnapshot().records);
  vi.setSystemTime('2026-10-12T01:01:00.000Z');
  if (kind === 'mate') play(restored, ['d8h4']);
  else if (kind === 'repetition') play(restored, ['f6g8']);
  else restored.resign();
  expect(restored.getSnapshot().records).toHaveLength(1);
  expect(restored.getSnapshot().records[0]).toMatchObject({ id: original.id, result: original.result, durationMs: 60000 });
});

test('new game and changed settings archive unfinished moves using the old settings', () => {
  const game = new GameController(); play(game, ['e2e4', 'e7e5']);
  vi.setSystemTime('2026-10-12T01:03:00.000Z');
  game.newGame({ mode: 'ai', playerColor: 'b', difficulty: 3 });
  const [record] = game.getSnapshot().records;
  expect(record).toMatchObject({ startedAt: start, durationMs: 180000, result: '未完成 · 开始新局', settings: { mode: 'local' }, plyCount: 2 });
  const chess = new Chess(); chess.loadPgn(record.pgn);
  expect(chess.history()).toEqual(['e4', 'e5']); expect(chess.getHeaders().Result).toBe('*');
  expect(game.save().id).not.toBe(record.id);
  expect(game.save().startedAt).toBe(record.endedAt);
  expect(game.getSnapshot().history).toHaveLength(0);
  game.newGame(); expect(game.getSnapshot().records).toHaveLength(1);
});

test('promotion only archives after it completes and the rules report a draw', () => {
  const game = new GameController('7k/P7/8/8/8/8/8/7K w - - 0 1');
  game.move('a7', 'a8'); expect(game.getSnapshot().records).toHaveLength(0);
  vi.setSystemTime('2026-10-12T01:00:30.000Z'); game.promote('n');
  expect(game.getSnapshot().records[0]).toMatchObject({ result: '和棋 · 子力不足', durationMs: 30000 });
  expect(game.getSnapshot().records[0].pgn).toContain('[Result "1/2-1/2"]');
});

test('empty new games are omitted, records are newest first, and only 100 are retained', () => {
  const game = new GameController(); game.newGame(); expect(game.getSnapshot().records).toHaveLength(0);
  let newestId = '';
  for (let i = 0; i <= MAX_GAME_RECORDS; i++) {
    vi.setSystemTime(Date.parse(start) + i * 24 * 60 * 60 * 1000); game.resign(); newestId = game.save().id; game.newGame();
  }
  const records = game.getSnapshot().records;
  expect(records).toHaveLength(MAX_GAME_RECORDS); expect(records[0].id).toBe(newestId);
  expect(new Set(records.map(record => record.id)).size).toBe(MAX_GAME_RECORDS);
  expect(records.at(-1)?.endedAt).toBe('2026-10-13T01:00:00.000Z');
  expect(validateGameRecords(records)).toEqual(records);
});

test('a backward clock adjustment never records negative duration', () => {
  const game = new GameController(); vi.setSystemTime('2026-10-12T00:59:00.000Z'); game.resign();
  expect(game.getSnapshot().records[0]).toMatchObject({ durationMs: 0, endedAt: start });
});

test('legacy sessions retain their game and start without needing new metadata', () => {
  const game = new GameController(); play(game, ['e2e4']);
  const saved: Partial<ReturnType<GameController['save']>> = game.save(); delete saved.id; delete saved.endedAt;
  const storage = new MemoryStorage(); storage.setItem(SESSION_KEY, JSON.stringify({ version: 1, game: saved, preferences: { flipped: true, sound: false } }));
  const session = loadSession(() => storage);
  expect(session.notice).toContain('已恢复'); expect(session.controller.save().startedAt).toBe(start);
  expect(session.controller.getSnapshot().history[0].san).toBe('e4'); expect(session.controller.getSnapshot().records).toHaveLength(0);
  expect(session.preferences).toEqual({ flipped: true, sound: false });
});

test('invalid record metadata or PGN does not discard the active game', () => {
  const game = new GameController(); game.resign(); const [record] = game.getSnapshot().records;
  for (const patch of [{ durationMs: -1 }, { pgn: '1. e5 *' }, { settings: { ...record.settings, difficulty: 8 } }, { plyCount: 2 }]) {
    expect(() => validateGameRecords([{ ...record, ...patch }])).toThrow();
  }
  expect(() => validateGameRecords([record, record])).toThrow();
  game.newGame(); play(game, ['e2e4']);
  const storage = new MemoryStorage(); saveSession(game, { flipped: false, sound: true }, () => storage);
  const data = JSON.parse(storage.getItem(SESSION_KEY)!); data.records[0].durationMs = -1;
  storage.setItem(SESSION_KEY, JSON.stringify(data));
  const restored = loadSession(() => storage);
  expect(restored.notice).toContain('历史对弈记录无法读取');
  expect(restored.controller.getSnapshot().history[0].san).toBe('e4');
});

test('legacy terminal duration is explicitly estimated and remains fixed across later restores', () => {
  const game = new GameController(); game.resign();
  const saved: Partial<ReturnType<GameController['save']>> = game.save(); delete saved.id; delete saved.endedAt;
  vi.setSystemTime('2026-10-12T01:05:00.000Z');
  const restored = GameController.restore(saved);
  expect(restored.getSnapshot().records[0]).toMatchObject({ durationMs: 300000, timingEstimated: true });
  expect(restored.exportPgn()).toContain('[TimeComment "End time estimated at first restore"]');
  vi.setSystemTime('2026-10-12T02:00:00.000Z');
  const again = GameController.restore(restored.save(), restored.getSnapshot().records);
  expect(again.getSnapshot().records).toEqual(restored.getSnapshot().records);
  again.undo(); again.resign();
  expect(again.getSnapshot().records[0].timingEstimated).toBeUndefined();
});

test('an unfinished session cannot claim a finished timestamp', () => {
  const game = new GameController();
  expect(() => GameController.restore({ ...game.save(), endedAt: start })).toThrow();
  game.resign();
  expect(() => GameController.restore({ ...game.save(), endedAt: '2026-10-11T00:00:00Z' })).toThrow();
});
