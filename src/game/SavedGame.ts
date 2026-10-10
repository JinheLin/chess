import type { Color, Square } from 'chess.js';
import type { GameSettings } from './GameState';
export interface SavedGame {
  version: 1;
  initialFen: string;
  moves: string[];
  settings: GameSettings;
  resignedColor: Color | null;
  promotion: { from: Square; to: Square } | null;
  startedAt: string;
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export function validateSavedGame(value: unknown): SavedGame {
  if (!object(value) || value.version !== 1 || typeof value.initialFen !== 'string' || value.initialFen.length > 200 ||
      !Array.isArray(value.moves) || value.moves.length > 10000 || !value.moves.every(move => typeof move === 'string' && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)) ||
      !object(value.settings) || !['local','ai'].includes(value.settings.mode as string) || !['w','b'].includes(value.settings.playerColor as string) || ![0,1,2].includes(value.settings.difficulty as number) ||
      ![null,'w','b'].includes(value.resignedColor as Color | null) || typeof value.startedAt !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(value.startedAt) || !Number.isFinite(Date.parse(value.startedAt))) {
    throw new Error('无效存档');
  }
  if (value.promotion !== null && (!object(value.promotion) || (typeof value.promotion.from !== 'string' || !/^[a-h][1-8]$/.test(value.promotion.from)) || (typeof value.promotion.to !== 'string' || !/^[a-h][1-8]$/.test(value.promotion.to)))) throw new Error('无效升变存档');
  return structuredClone(value) as unknown as SavedGame;
}
