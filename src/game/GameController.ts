import { beginnerMove } from '../engine/BeginnerPolicy';
import { Chess } from 'chess.js';
import type { Color, Square } from 'chess.js';
import { colorName, resultOf } from './ChessRules';
import type { GameSettings, GameState, Promotion } from './GameState';
import { DIFFICULTIES } from '../engine/ChessEngine';
import type { ChessEngine } from '../engine/ChessEngine';
import { validateSavedGame } from './SavedGame';
import type { SavedGame } from './SavedGame';
import { MAX_GAME_RECORDS } from './GameRecord';
import type { GameRecord } from './GameRecord';
import { mergePlayUsage, playLimit } from './PlayLimit';
import type { PlayUsage, PlayUsageStore } from './PlayLimit';

export class GameController {
  private chess: Chess;
  private initialFen: string;
  private promotion: GameState['promotion'] = null;
  private resignation: Color | null = null;
  private startedAt = new Date().toISOString();
  private id: string = crypto.randomUUID();
  private endedAt: string | null = null;
  private timingEstimated = false;
  private records: GameRecord[] = [];
  private playStartedAt: string | null = null;
  private playUsage: PlayUsage[];
  private usageStore: PlayUsageStore | null = null;
  private listeners = new Set<() => void>();
  private state: GameState;
  private settings: GameSettings;
  private engine: ChessEngine | null = null;
  private abort: AbortController | null = null;
  private revision = 0;
  private loading = false;
  private engineError: string | null = null;
  private engineFactory: (() => ChessEngine) | null = null;

  constructor(fen?: string, settings: GameSettings = { mode: 'local', playerColor: 'w', difficulty: 0 }, usage: readonly PlayUsage[] = []) {
    this.playUsage = mergePlayUsage([], usage);
    this.chess = new Chess(fen);
    this.initialFen = this.chess.fen();
    this.settings = { ...settings };
    this.syncRecord();
    this.state = this.snapshot();
  }
  static restore(value: unknown, records: readonly GameRecord[] = [], usage: readonly PlayUsage[] = []): GameController {
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
    game.id = saved.id;
    game.endedAt = saved.endedAt;
    game.timingEstimated = saved.timingEstimated ?? (!!game.gameResult() && !saved.endedAt);
    if (game.endedAt && !game.gameResult()) throw new Error('未结束对局含结束时间');
    game.records = structuredClone(records) as GameRecord[];
    game.playStartedAt = saved.playStartedAt ?? (saved.moves.length || saved.resignedColor || saved.promotion ? saved.startedAt : null);
    // Migrate existing games as well as the new independently persisted ledger.
    game.playUsage = mergePlayUsage(usage, [
      ...records.map(record => ({ id: record.id, startedAt: record.playStartedAt ?? record.startedAt })),
      ...(game.playStartedAt ? [{ id: game.id, startedAt: game.playStartedAt }] : []),
    ]);
    game.syncRecord();
    game.state = game.snapshot();
    return game;
  }
  save(): SavedGame {
    return {
      version: 1, initialFen: this.initialFen,
      moves: this.chess.history({ verbose: true }).map(move => `${move.from}${move.to}${move.promotion ?? ''}`),
      settings: { ...this.settings }, resignedColor: this.resignation,
      promotion: this.promotion ? { ...this.promotion } : null, startedAt: this.startedAt,
      id: this.id, endedAt: this.endedAt,
      playStartedAt: this.playStartedAt,
      ...(this.timingEstimated ? { timingEstimated: true } : {}),
    };
  }
  exportPgn(): string {
    // Export on a replayed copy: PGN headers must not mutate the active game.
    const copy = new Chess(this.initialFen);
    for (const move of this.chess.history({ verbose: true })) copy.move({ from: move.from, to: move.to, promotion: move.promotion });
    const loser = this.resignation ?? (this.chess.isCheckmate() ? this.chess.turn() : null);
    const result = loser ? loser === 'w' ? '0-1' : '1-0' : resultOf(this.chess) ? '1/2-1/2' : '*';
    const player = (color: Color) => this.settings.mode === 'local' ? `Local ${color === 'w' ? 'White' : 'Black'}` : color === this.settings.playerColor ? 'Human' : `Stockfish 19 (Skill ${DIFFICULTIES[this.settings.difficulty].skill}${this.settings.difficulty === 3 ? ', Beginner policy' : ''})`;
    const start = new Date(this.startedAt).toISOString();
    const headers: Record<string, string> = { Event: 'Chess Lab', Site: 'Local', Date: start.slice(0, 10).replaceAll('-', '.'), Round: '-', White: player('w'), Black: player('b'), Result: result, UTCDate: start.slice(0, 10).replaceAll('-', '.'), UTCTime: start.slice(11, 19), StartTime: start };
    if (this.endedAt) { headers.EndTime = this.endedAt; headers.Duration = `${Math.floor((Date.parse(this.endedAt) - Date.parse(this.startedAt)) / 1000)}s`; }
    if (this.timingEstimated) headers.TimeComment = 'End time estimated at first restore';
    for (const [key, value] of Object.entries(headers)) copy.setHeader(key, value);
    return copy.pgn({ maxWidth: 80 }) + '\n';
  }
  getSnapshot = () => this.state;
  connectPlayUsageStore(store: PlayUsageStore) { this.usageStore = store; this.refreshPlayLimit(); }
  private readPlayUsage() {
    try { if (this.usageStore) this.playUsage = mergePlayUsage(this.playUsage, this.usageStore.read()); }
    catch { /* Retain the in-memory limit when storage is unavailable. */ }
  }
  persistPlayUsage(store = this.usageStore): boolean {
    if (!store) return true;
    try { this.playUsage = mergePlayUsage(this.playUsage, store.read()); store.write(this.playUsage); return true; }
    catch { return false; }
  }
  refreshPlayLimit = () => {
    this.readPlayUsage();
    const next = this.snapshot();
    if (JSON.stringify(next.playLimit) !== JSON.stringify(this.state.playLimit) || JSON.stringify(next.playUsage) !== JSON.stringify(this.state.playUsage)) {
      const wasBlocked = this.state.phase === 'PLAY_LIMIT';
      if (next.playLimit.blocked && !this.gameResult()) this.cancelSearch();
      this.publish();
      if (wasBlocked && !next.playLimit.blocked) this.resume();
    }
  };
  private beginPlay(): boolean {
    this.readPlayUsage();
    if (this.playStartedAt) return true;
    if (playLimit(this.playUsage, false).reached) { this.publish(); return false; }
    this.playStartedAt = new Date(Math.max(Date.now(), Date.parse(this.startedAt))).toISOString();
    this.playUsage = mergePlayUsage(this.playUsage, [{ id: this.id, startedAt: this.playStartedAt }]);
    this.persistPlayUsage();
    return true;
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private gameResult() {
    return this.resignation ? `${colorName(this.resignation === 'w' ? 'b' : 'w')}获胜 · ${colorName(this.resignation)}认输` : resultOf(this.chess);
  }
  private archive(result: string) {
    this.endedAt ??= new Date(Math.max(Date.now(), Date.parse(this.startedAt))).toISOString();
    const record: GameRecord = {
      id: this.id, startedAt: this.startedAt, endedAt: this.endedAt,
      durationMs: Date.parse(this.endedAt) - Date.parse(this.startedAt), result,
      settings: { ...this.settings }, plyCount: this.chess.history().length, pgn: this.exportPgn(),
      ...(this.timingEstimated ? { timingEstimated: true } : {}),
      ...(this.playStartedAt ? { playStartedAt: this.playStartedAt } : {}),
    };
    this.records = [record, ...this.records.filter(record => record.id !== this.id)].slice(0, MAX_GAME_RECORDS);
  }
  private syncRecord() {
    const result = this.gameResult();
    if (result) {
      this.archive(result);
    } else {
      this.endedAt = null;
      this.timingEstimated = false;
      if (this.records.some(record => record.id === this.id)) this.records = this.records.filter(record => record.id !== this.id);
    }
  }
  private snapshot(): GameState {
    const result = this.gameResult();
    const history = this.chess.history({ verbose: true });
    const king = this.chess.board().flat().find(p => p?.type === 'k' && p.color === this.chess.turn());
    const aiTurn = this.settings.mode === 'ai' && this.chess.turn() !== this.settings.playerColor;
    const limit = playLimit(this.playUsage, !!this.playStartedAt && !result);
    return {
      fen: this.chess.fen(), turn: this.chess.turn(),
      phase: result ? 'GAME_OVER' : limit.blocked ? 'PLAY_LIMIT' : this.promotion ? 'PROMOTION_PENDING' : this.engineError ? 'ENGINE_ERROR' :
        this.settings.mode === 'ai' && (this.loading || !this.engine) ? 'ENGINE_LOADING' : aiTurn ? 'AI_THINKING' : 'PLAYER_TURN',
      history, result, inCheck: this.chess.isCheck(),
      checkedKing: this.chess.isCheck() ? king?.square : undefined,
      promotion: this.promotion, settings: { ...this.settings }, engineError: this.engineError,
      canUndo: !limit.blocked && (!!this.promotion || !!this.resignation || (this.settings.mode === 'local' ? history.length > 0 : history.some(move => move.color === this.settings.playerColor))),
      records: this.records,
      playUsage: this.playUsage, playLimit: limit,
    };
  }
  private publish() {
    this.syncRecord();
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
    this.readPlayUsage();
    if (playLimit(this.playUsage, !!this.playStartedAt && !this.gameResult()).blocked) { this.publish(); return; }
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
        let uci = await engine.getBestMove(this.chess.fen(), {
          movetimeMs: difficulty.movetimeMs, maxDepth:this.settings.difficulty === 3 ? 3 : undefined, signal: abort.signal, initialFen: this.initialFen,
          moves: this.chess.history({ verbose: true }).map(move => `${move.from}${move.to}${move.promotion ?? ''}`),
        });
        if (revision !== this.revision || abort.signal.aborted) return;
        if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) throw new Error('AI 返回无效走法，请重试');
        if (this.settings.difficulty === 3) uci = beginnerMove(uci,this.chess.moves({verbose:true}).map(move=>`${move.from}${move.to}${move.promotion ?? ''}`));
        if (!this.chess.moves({ verbose: true }).some(move => `${move.from}${move.to}${move.promotion ?? ''}` === uci)) throw new Error('AI 返回非法走法，棋局已保留，请重试');
        if (!this.beginPlay()) return;
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
    this.refreshPlayLimit();
    if (this.state.phase !== 'PLAYER_TURN') return false;
    const candidates = this.legalMoves(from).filter(move => move.to === to);
    if (!candidates.length) return false;
    if (!this.beginPlay()) return false;
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
    if (!this.beginPlay()) return;
    this.chess.move({ ...this.promotion, promotion: piece });
    this.promotion = null;
    this.resume();
  }
  cancelPromotion() { this.promotion = null; this.resume(); }
  undo() {
    this.refreshPlayLimit();
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
    this.refreshPlayLimit();
    if (playLimit(this.playUsage, false).reached) return false;
    if (!this.gameResult() && this.chess.history().length) this.archive('未完成 · 开始新局');
    this.disconnectEngine();
    this.settings = { ...settings };
    this.chess.reset();
    this.startedAt = new Date().toISOString();
    this.id = crypto.randomUUID();
    this.playStartedAt = null;
    this.endedAt = null;
    this.timingEstimated = false;
    this.initialFen = this.chess.fen();
    this.promotion = null;
    this.resignation = null;
    this.engineError = null;
    this.resume();
    return true;
  }
  resign() {
    this.refreshPlayLimit();
    if (this.state.result || this.promotion) return;
    if (!this.beginPlay()) return;
    this.cancelSearch();
    const color = this.settings.mode === 'ai' ? this.settings.playerColor : this.chess.turn();
    this.resignation = color;
    this.publish();
  }
}
