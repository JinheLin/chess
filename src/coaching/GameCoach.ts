import { Chess } from 'chess.js';
import type { Move } from 'chess.js';
import type { AnalysisEngine, Evaluation } from '../engine/AnalysisEngine';
import { StockfishEngine } from '../engine/StockfishEngine';
import type { GameController } from '../game/GameController';
import { isCoaching } from '../game/GameState';
import { uci } from '../personality/PositionAnalyzer';

export interface CoachHint { from: string; to: string; text: string; lesson: string }
export interface CoachState {
  busy: 'hint' | 'review' | null;
  hint: CoachHint | null;
  feedback: string | null;
  error: string | null;
}
const empty = (): CoachState => ({ busy: null, hint: null, feedback: null, error: null });
const names = { p: '兵', n: '马', b: '象', r: '车', q: '后', k: '王' } as const;

/** All legality and special-move facts come from chess.js, never from the coach. */
export function describeMove(move: Move): CoachHint {
  const text = `${names[move.piece]} ${move.from} → ${move.to}${move.promotion ? `，升变为${names[move.promotion]}` : ''}（${move.san}）`;
  const lesson = move.san.includes('#') ? '这步可以将死。' : move.isKingsideCastle() || move.isQueensideCastle() ? '王车易位，同时移动王和车。注意王翼的后续安全。' :
    `${move.captured ? `这步吃掉对方的${names[move.captured]}${move.isEnPassant() ? '（吃过路兵）' : ''}。` : move.promotion ? '兵到达底线，可以升变。' : move.piece === 'p' && ['d4','e4','d5','e5'].includes(move.to) ? '这步让兵占据中心格。' : ['n','b'].includes(move.piece) && ['1','8'].includes(move.from[1]) ? '这步把轻子从底线调出。' : '先观察对方的将军、吃子和直接威胁。'}${move.san.includes('+') ? '同时将军，对手必须先应将。' : '落子前也要检查对方能否吃回或制造威胁。'}`;
  return { from: move.from, to: move.to, text, lesson };
}
function recommendation(fen: string, evaluation: Evaluation | null) {
  const first = evaluation?.pv[0];
  return first ? new Chess(fen).moves({ verbose: true }).find(move => uci(move) === first) : undefined;
}
export function reviewMove(move: Move, before: Evaluation | null, after: Evaluation | null): string {
  const prefix = `你走了 ${move.san}。`;
  const best = recommendation(move.before, before);
  if (!best || !before?.stable || !after?.stable) return `${prefix}${describeMove(move).lesson}分析尚不稳定，暂不判断这步的优劣。`;
  if (uci(best) === uci(move)) return `${prefix}与本次分析的推荐一致。${describeMove(move).lesson}`;
  const a = before.score, b = after.score;
  // The two root scores face opposite sides. cp are evaluation units, not lost material.
  const loss = a.kind === 'cp' && b.kind === 'cp' ? a.value + b.value : null;
  let verdict = '这步与推荐不同，可以比较两种走法。';
  if (loss !== null) verdict = loss >= 250 ? '这步可能有较大疏漏，建议悔棋再想一想。' : loss >= 120 ? '这步可能错过了更好的机会。' : '这步没有明显损失，继续留意对方的威胁。';
  else if (b.kind === 'mate' && b.value > 0) verdict = '这步之后，对手有将杀机会，建议悔棋检查王的安全。';
  return `${prefix}${verdict}当时可考虑：${describeMove(best).text}。`;
}

/** Observes the authoritative controller; analysis never changes the live game. */
export class GameCoach {
  private state = empty();
  private listeners = new Set<() => void>();
  private unsubscribe = () => {};
  private key = '';
  private failedKind: 'hint' | 'review' | null = null;
  private revision = 0;
  private connected = false;
  private abort: AbortController | null = null;
  private engine: AnalysisEngine | null = null;
  constructor(private game: GameController, private factory: () => AnalysisEngine = () => new StockfishEngine()) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<CoachState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()); }
  connect() {
    this.cancel(); this.unsubscribe(); this.connected = true; this.key = '';
    this.unsubscribe = this.game.subscribe(() => this.update()); this.update();
  }
  private cancel() {
    ++this.revision; this.abort?.abort(); this.engine?.dispose(); this.abort = null; this.engine = null;
  }
  private update() {
    const state = this.game.getSnapshot(), saved = this.game.save();
    const key = JSON.stringify([saved.id, saved.moves, state.phase, state.result, state.promotion]);
    if (key === this.key) return;
    this.key = key; this.cancel(); this.failedKind = null; this.publish(empty());
    if (!isCoaching(state.settings) || state.result || state.phase !== 'PLAYER_TURN') return;
    const index = state.history.map(move => move.color).lastIndexOf(state.settings.playerColor);
    if (index < 0) return;
    const move = state.history[index];
    this.run('review', async (engine, signal) => {
      const moves = saved.moves.slice(0, index);
      const before = await engine.analyze(move.before, { movetimeMs: 700, signal, initialFen: saved.initialFen, moves });
      if (signal.aborted) return;
      const after = await engine.analyze(move.after, { movetimeMs: 700, signal, initialFen: saved.initialFen, moves: [...moves, uci(move)] });
      if (signal.aborted) return;
      return { feedback: reviewMove(move, before, after) };
    });
  }
  requestHint() {
    const state = this.game.getSnapshot();
    if (!this.connected || !isCoaching(state.settings) || state.phase !== 'PLAYER_TURN' || this.state.busy) return;
    const saved = this.game.save();
    this.run('hint', async (engine, signal) => {
      const evaluation = await engine.analyze(state.fen, { movetimeMs: 1000, signal, initialFen: saved.initialFen, moves: saved.moves });
      if (signal.aborted) return;
      const best = recommendation(state.fen, evaluation);
      if (!best) throw new Error('没有可靠的合法推荐，请重试');
      return { hint: describeMove(best) };
    });
  }
  hideHint() { this.publish({ hint: null }); }
  retry() { if (this.failedKind === 'hint') this.requestHint(); else { this.key = ''; this.update(); } }
  private run(kind: 'hint' | 'review', task: (engine: AnalysisEngine, signal: AbortSignal) => Promise<Partial<CoachState> | undefined>) {
    this.cancel();
    const revision = this.revision, abort = new AbortController();
    this.abort = abort; this.failedKind = null; this.publish({ busy: kind, error: null });
    void (async () => {
      let engine: AnalysisEngine | null = null;
      try {
        engine = this.factory(); this.engine = engine;
        const result = await task(engine, abort.signal);
        if (revision === this.revision && !abort.signal.aborted) this.publish({ ...result, busy: null });
      } catch {
        if (revision === this.revision && !abort.signal.aborted) { this.failedKind = kind; this.publish({ busy: null, error: '指导分析暂不可用，可以重试或继续走棋。' }); }
      } finally {
        engine?.dispose();
        if (revision === this.revision) { this.engine = null; this.abort = null; }
      }
    })();
  }
  dispose() { this.connected = false; this.unsubscribe(); this.cancel(); }
}
