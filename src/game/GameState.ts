import type { Color, Move, Square } from 'chess.js';
export type Promotion = 'q' | 'r' | 'b' | 'n';
export type GamePhase = 'PLAYER_TURN' | 'PROMOTION_PENDING' | 'GAME_OVER';
export interface GameState {
  fen: string;
  turn: Color;
  phase: GamePhase;
  history: readonly Move[];
  result: string | null;
  inCheck: boolean;
  checkedKing?: Square;
  promotion: { from: Square; to: Square } | null;
}
