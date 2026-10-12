import { Chess } from 'chess.js';
import type { GameSettings } from './GameState';

export const MAX_GAME_RECORDS = 100;
export interface GameRecord {
  id: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  result: string;
  settings: GameSettings;
  plyCount: number;
  pgn: string;
  timingEstimated?: boolean;
  playStartedAt?: string;
}

export function validateGameRecords(value: unknown): GameRecord[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_GAME_RECORDS) throw new Error('无效对弈记录');
  const ids = new Set<string>();
  for (const record of value) {
    if (!record || typeof record.id !== 'string' || !record.id || record.id.length > 100 || ids.has(record.id) ||
        typeof record.startedAt !== 'string' || !Number.isFinite(Date.parse(record.startedAt)) ||
        typeof record.endedAt !== 'string' || !Number.isFinite(Date.parse(record.endedAt)) ||
        record.durationMs !== Date.parse(record.endedAt) - Date.parse(record.startedAt) || record.durationMs < 0 ||
        typeof record.result !== 'string' || !record.result || record.result.length > 100 ||
        !record.settings || !['ai', 'local'].includes(record.settings.mode) || !['w', 'b'].includes(record.settings.playerColor) || ![0, 1, 2, 3].includes(record.settings.difficulty) ||
        !Number.isInteger(record.plyCount) || record.plyCount < 0 || record.plyCount > 10000 ||
        typeof record.pgn !== 'string' || record.pgn.length > 200000 ||
        (record.playStartedAt !== undefined && (typeof record.playStartedAt !== 'string' || !Number.isFinite(Date.parse(record.playStartedAt)))) ||
        (record.timingEstimated !== undefined && typeof record.timingEstimated !== 'boolean')) throw new Error('无效对弈记录');
    const chess = new Chess();
    chess.loadPgn(record.pgn);
    if (chess.history().length !== record.plyCount) throw new Error('无效记录棋谱');
    ids.add(record.id);
  }
  return structuredClone(value) as GameRecord[];
}
