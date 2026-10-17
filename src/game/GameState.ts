import type { Color, Move, Square } from 'chess.js';
import type { GameRecord } from './GameRecord';
export type Promotion = 'q' | 'r' | 'b' | 'n';
export type GamePhase = 'PLAYER_TURN' | 'PROMOTION_PENDING' | 'GAME_OVER' | 'AI_THINKING' | 'ENGINE_LOADING' | 'ENGINE_ERROR';
export interface GameSettings {
  mode: 'local' | 'ai'; playerColor: Color; difficulty: 0 | 1 | 2 | 3;
  /** Omitted by older saves; defaults to 20%. Only applies to entry difficulty. */
  beginnerRandomPercent?: number;
  /** Older saves use depth 4 and 220 ms. Only apply to entry difficulty. */
  beginnerMaxDepth?: number;
  beginnerMovetimeMs?: number;
}
export interface GameState {
  fen: string;
  turn: Color;
  phase: GamePhase;
  history: readonly Move[];
  result: string | null;
  inCheck: boolean;
  checkedKing?: Square;
  promotion: { from: Square; to: Square } | null;
  settings: GameSettings;
  engineError: string | null;
  canUndo: boolean;
  records: readonly GameRecord[];
}
