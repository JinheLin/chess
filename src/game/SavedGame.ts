import type { Color, Square } from 'chess.js';
import type { GameSettings } from './GameState';
import { validateCoaching } from './GameState';
import { validateBeginnerSettings } from '../engine/BeginnerPolicy';
export interface SavedGame {
  version: 1;
  initialFen: string;
  moves: string[];
  settings: GameSettings;
  resignedColor: Color | null;
  promotion: { from: Square; to: Square } | null;
  startedAt: string;
  id: string;
  endedAt: string | null;
  timingEstimated?: boolean;
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export function validateSavedGame(value: unknown): SavedGame {
  if (!object(value) || value.version !== 1 || typeof value.initialFen !== 'string' || value.initialFen.length > 200 ||
      !Array.isArray(value.moves) || value.moves.length > 10000 || !value.moves.every(move => typeof move === 'string' && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)) ||
      !object(value.settings) || !['local','ai'].includes(value.settings.mode as string) || !['w','b'].includes(value.settings.playerColor as string) || ![0,1,2,3].includes(value.settings.difficulty as number) ||
      ![null,'w','b'].includes(value.resignedColor as Color | null) || typeof value.startedAt !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(value.startedAt) || !Number.isFinite(Date.parse(value.startedAt))) {
    throw new Error('无效存档');
  }
  if (value.promotion !== null && (!object(value.promotion) || (typeof value.promotion.from !== 'string' || !/^[a-h][1-8]$/.test(value.promotion.from)) || (typeof value.promotion.to !== 'string' || !/^[a-h][1-8]$/.test(value.promotion.to)))) throw new Error('无效升变存档');
  validateBeginnerSettings(value.settings);
  validateCoaching(value.settings);
  // Version 1 sessions predating the record list have neither field.
  if (value.id !== undefined && (typeof value.id !== 'string' || !value.id || value.id.length > 100)) throw new Error('无效对局编号');
  if (value.endedAt !== undefined && value.endedAt !== null && (typeof value.endedAt !== 'string' || !Number.isFinite(Date.parse(value.endedAt)) || Date.parse(value.endedAt) < Date.parse(value.startedAt))) throw new Error('无效结束时间');
  if (value.timingEstimated !== undefined && typeof value.timingEstimated !== 'boolean') throw new Error('无效计时状态');
  return { ...structuredClone(value), id: value.id ?? crypto.randomUUID(), endedAt: value.endedAt ?? null } as unknown as SavedGame;
}
