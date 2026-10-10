import { Chess } from 'chess.js';
import type { Color, Square } from 'chess.js';
import { colorName, resultOf } from './ChessRules';
import type { GameSettings, GameState, Promotion } from './GameState';
import { DIFFICULTIES } from '../engine/ChessEngine';
import type { ChessEngine } from '../engine/ChessEngine';
import { validateSavedGame } from './SavedGame';
import type { SavedGame } from './SavedGame';

export class GameController {
  private chess: Chess;
  private initialFen: string;
  private promotion: GameState['promotion'] = null;
  private resignation: Color | null = null;
  private startedAt = new Date().toISOString();
  private listeners = new Set<() => void>();
  private state: GameState;
  private settings: GameSettings;
  private engine: ChessEngine | null = null;
  private abort: AbortController | null = null;
  private revision = 0;
  private loading = false;
  private engineError: string | null = null;
  private engineFactory: (() => ChessEngine) | null = null;

  constructor(fen?: string, settings: GameSettings = { mode: 'local', playerColor: 'w', difficulty: 1 }) {
    this.chess = new Chess(fen);
    this.initialFen = this.chess.fen();
    this.settings = { ...settings };
    this.state = this.snapshot();
  }
  static restore(value: unknown): GameController {
    const saved = validateSavedGame(value);
    const game = new GameController(saved.initialFen, saved.settings);
    for (const uci of saved.moves) {
      if (resultOf(game.chess)) throw new Error('终局之后仍有走棋');
      game.chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    }
    if (saved.resignedColor && (resultOf(game.chess) || saved.promotion || saved.resignedColor !== (saved.settings.mode === 'ai' ? saved.settings.playerColor : game.chess.turn()))) throw new Error('无效认输状态');
    if (saved.promotion) {
      const legal = game.chess.moves({ square: saved.promotion.from, verbose: true }).some(move => move.to === saved.promotion!.to && move.promotion);
      if (!legal || resultOf(game.chess) || (saved.settings.mode === 'ai' && game.chess.turn() !== saved.settings.playerColor)) throw new Error('无效待升变状态');
    }
    game.promotion = saved.promotion;
    game.resignation = saved.resignedColor;
    game.startedAt = saved.startedAt;
    game.state = game.snapshot();
    return game;
  }
  save(): SavedGame {
    return {
      version: 1, initialFen: this.initialFen,
      moves: this.chess.history({ verbose: true }).map(move => `${move.from}${move.to}${move.promotion ?? ''}`),
      settings: { ...this.settings }, resignedColor: this.resignation,
      promotion: this.promotion ? { ...this.promotion } : null, startedAt: this.startedAt,
    };
  }
  exportPgn(): string {
    // Export on a replayed copy: PGN headers must not mutate the active game.
    const copy = new Chess(this.initialFen);
    for (const move of this.chess.history({ verbose: true })) copy.move({ from: move.from, to: move.to, promotion: move.promotion });
    const loser = this.resignation ?? (this.chess.isCheckmate() ? this.chess.turn() : null);
    const result = loser ? loser === 'w' ? '0-1' : '1-0' : resultOf(this.chess) ? '1/2-1/2' : '*';
    const player = (color: Color) => this.settings.mode === 'local' ? `Local ${color === 'w' ? 'White' : 'Black'}` : color === this.settings.playerColor ? 'Human' : `Stockfish 19 (Skill ${DIFFICULTIES[this.settings.difficulty].skill})`;
    for (const [key, value] of Object.entries({ Event: 'Chess Lab', Site: 'Local', Date: this.startedAt.slice(0, 10).replaceAll('-', '.'), Round: '-', White: player('w'), Black: player('b'), Result: result })) copy.setHeader(key, value);
    return copy.pgn({ maxWidth: 80 }) + '\n';
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private snapshot(): GameState {
    const result = this.resignation ? `${colorName(this.resignation === 'w' ? 'b' : 'w')}获胜 · ${colorName(this.resignation)}认输` : resultOf(this.chess);
    const history = this.chess.history({ verbose: true });
    const king = this.chess.board().flat().find(p => p?.type === 'k' && p.color === this.chess.turn());
    const aiTurn = this.settings.mode === 'ai' && this.chess.turn() !== this.settings.playerColor;
    return {
      fen: this.chess.fen(), turn: this.chess.turn(),
      phase: result ? 'GAME_OVER' : this.promotion ? 'PROMOTION_PENDING' : this.engineError ? 'ENGINE_ERROR' :
        this.settings.mode === 'ai' && (this.loading || !this.engine) ? 'ENGINE_LOADING' : aiTurn ? 'AI_THINKING' : 'PLAYER_TURN',
      history, result, inCheck: this.chess.isCheck(),
      checkedKing: this.chess.isCheck() ? king?.square : undefined,
      promotion: this.promotion, settings: { ...this.settings }, engineError: this.engineError,
      canUndo: !!this.promotion || !!this.resignation || (this.settings.mode === 'local' ? history.length > 0 : history.some(move => move.color === this.settings.playerColor)),
    };
  }
  private publish() {
    this.state = this.snapshot();
    this.listeners.forEach(listener => listener());
  }
  private cancelSearch() {
    ++this.revision;
    this.abort?.abort();
    this.abort = null;
  }
  /** Safe to reconnect after React StrictMode's setup/cleanup cycle. */
  connectEngine(factory: () => ChessEngine) {
    this.engineFactory = factory;
    this.resume();
  }
  disconnectEngine() {
    this.cancelSearch();
    this.engine?.dispose();
    this.engine = null;
    this.loading = false;
  }
  private resume() {
    this.cancelSearch();
    if (this.settings.mode !== 'ai' || this.resignation || resultOf(this.chess) || this.promotion) { this.publish(); return; }
    if (!this.engineFactory) { this.publish(); return; }
    const revision = this.revision;
    const abort = new AbortController();
    this.abort = abort;
    this.engineError = null;
    this.loading = true;
    this.publish();
    void (async () => {
      try {
        this.engine ??= this.engineFactory!();
        const engine = this.engine;
        await engine.initialize();
        if (revision !== this.revision) return;
        const difficulty = DIFFICULTIES[this.settings.difficulty];
        await engine.setDifficulty(difficulty.skill);
        if (revision !== this.revision) return;
        this.loading = false;
        this.publish();
        if (this.chess.turn() === this.settings.playerColor) return;
        const uci = await engine.getBestMove(this.chess.fen(), {
          movetimeMs: difficulty.movetimeMs, signal: abort.signal, initialFen: this.initialFen,
          moves: this.chess.history({ verbose: true }).map(move => `${move.from}${move.to}${move.promotion ?? ''}`),
        });
        if (revision !== this.revision || abort.signal.aborted) return;
        if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) throw new Error('AI 返回无效走法，请重试');
        try { this.chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }); }
        catch { throw new Error('AI 返回非法走法，棋局已保留，请重试'); }
        this.publish();
      } catch (error) {
        if (revision !== this.revision || abort.signal.aborted) return;
        this.loading = false;
        this.engineError = error instanceof Error ? error.message : '引擎异常，请重试';
        this.engine?.dispose();
        this.engine = null;
        this.publish();
      }
    })();
  }
  retryEngine() { this.resume(); }
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
    this.resume();
    return true;
  }
  promote(piece: Promotion) {
    if (!this.promotion || !['q','r','b','n'].includes(piece)) return;
    this.chess.move({ ...this.promotion, promotion: piece });
    this.promotion = null;
    this.resume();
  }
  cancelPromotion() { this.promotion = null; this.resume(); }
  undo() {
    if (!this.state.canUndo) return;
    this.cancelSearch();
    if (this.promotion) this.promotion = null;
    else if (this.resignation) this.resignation = null;
    else {
      this.chess.undo();
      if (this.settings.mode === 'ai' && this.chess.turn() !== this.settings.playerColor) this.chess.undo();
    }
    this.resume();
  }
  newGame(settings: GameSettings = this.settings) {
    this.disconnectEngine();
    this.settings = { ...settings };
    this.chess.reset();
    this.startedAt = new Date().toISOString();
    this.initialFen = this.chess.fen();
    this.promotion = null;
    this.resignation = null;
    this.engineError = null;
    this.resume();
  }
  resign() {
    if (this.state.result || this.promotion) return;
    this.cancelSearch();
    const color = this.settings.mode === 'ai' ? this.settings.playerColor : this.chess.turn();
    this.resignation = color;
    this.publish();
  }
}
