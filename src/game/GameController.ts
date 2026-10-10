import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { colorName, resultOf } from './ChessRules';
import type { GameState, Promotion } from './GameState';

export class GameController {
  private chess: Chess;
  private promotion: GameState['promotion'] = null;
  private resignation: string | null = null;
  private listeners = new Set<() => void>();
  private state: GameState;

  constructor(fen?: string) {
    this.chess = new Chess(fen);
    this.state = this.snapshot();
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private snapshot(): GameState {
    const result = this.resignation ?? resultOf(this.chess);
    const king = this.chess.board().flat().find(p => p?.type === 'k' && p.color === this.chess.turn());
    return {
      fen: this.chess.fen(), turn: this.chess.turn(),
      phase: result ? 'GAME_OVER' : this.promotion ? 'PROMOTION_PENDING' : 'PLAYER_TURN',
      history: this.chess.history({ verbose: true }), result,
      inCheck: this.chess.isCheck(), checkedKing: this.chess.isCheck() ? king?.square : undefined,
      promotion: this.promotion,
    };
  }
  private publish() {
    this.state = this.snapshot();
    this.listeners.forEach(listener => listener());
  }
  legalMoves(square: Square) {
    return this.state.phase === 'PLAYER_TURN' ? this.chess.moves({ square, verbose: true }) : [];
  }
  canSelect(square: Square) {
    return this.state.phase === 'PLAYER_TURN' && this.chess.get(square)?.color === this.chess.turn();
  }
  move(from: Square, to: Square): boolean {
    if (this.state.phase !== 'PLAYER_TURN') return false;
    const candidates = this.legalMoves(from).filter(move => move.to === to);
    if (!candidates.length) return false;
    if (candidates.some(move => move.promotion)) {
      this.promotion = { from, to };
      this.publish();
      return false;
    }
    this.chess.move({ from, to });
    this.publish();
    return true;
  }
  promote(piece: Promotion) {
    if (!this.promotion || !['q','r','b','n'].includes(piece)) return;
    this.chess.move({ ...this.promotion, promotion: piece });
    this.promotion = null;
    this.publish();
  }
  cancelPromotion() { this.promotion = null; this.publish(); }
  undo() {
    if (this.promotion) this.promotion = null;
    else if (this.resignation) this.resignation = null;
    else this.chess.undo();
    this.publish();
  }
  newGame() {
    this.chess.reset(); this.promotion = null; this.resignation = null; this.publish();
  }
  resign() {
    if (this.state.phase !== 'PLAYER_TURN') return;
    this.resignation = `${colorName(this.chess.turn() === 'w' ? 'b' : 'w')}获胜 · ${colorName(this.chess.turn())}认输`;
    this.publish();
  }
}
