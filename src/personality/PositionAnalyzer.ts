import type { Color, Move } from 'chess.js';
import type { Evaluation, Score } from '../engine/AnalysisEngine';
export type EventKind = 'move' | 'check' | 'capture' | 'promotion' | 'brilliant' | 'mistake' | 'blunder' | 'reversal' | 'balanced' | 'mate' | 'end';
export interface ChessEvent {
  kind: EventKind; ply: number; actor: 'player' | 'ai'; important: boolean;
  /** Only observed facts; no candidate variation is sent to the dialogue generator. */
  fact: string;
  playerAdvantage?: number;
}
export const uci = (move: Move) => `${move.from}${move.to}${move.promotion ?? ''}`;
export function relativeScore(evaluation: Evaluation, turn: Color, player: Color): Score {
  return {...evaluation.score, value:evaluation.score.value * (turn === player ? 1 : -1)};
}
export function moveEvents(move: Move, ply: number, player: Color, before?: Evaluation | null, after?: Evaluation | null): ChessEvent[] {
  const actor = move.color === player ? 'player' : 'ai';
  const event = (kind: EventKind, fact: string, important = false): ChessEvent => ({kind,ply,actor,important,fact});
  const events: ChessEvent[] = [];
  if (move.san.includes('+')) events.push(event('check',`${move.san}：${actor === 'player' ? '玩家' : '电脑'}将军`,true));
  if (move.captured) events.push(event('capture',`${move.san}：吃子已发生，未据此判断得失`));
  if (move.promotion) events.push(event('promotion',`${move.san}：兵已升变`,true));
  if (!before?.stable || !after?.stable) return events;
  const a = relativeScore(before,move.color,player), b = relativeScore(after,move.color === 'w' ? 'b' : 'w',player);
  if (b.kind === 'mate' && b.value !== 0) events.push({...event('mate','稳定搜索发现将杀信号；不展示路线',true),playerAdvantage:Math.sign(b.value)});
  if (a.kind !== 'cp' || b.kind !== 'cp' || Math.abs(a.value) > 2000 || Math.abs(b.value) > 2000) return events;
  // Stockfish normalized cp are evaluation units, not a count of material lost.
  const loss = (a.value - b.value) * (actor === 'player' ? 1 : -1);
  if (loss >= 120) events.push(event(loss >= 250 ? 'blunder' : 'mistake','稳定的前后局面评价表明走法损失',loss >= 250));
  else if (loss >= -25 && loss <= 25 && before.pv[0] === uci(move) && (move.san.includes('+') || move.promotion || (move.captured && move.captured !== 'p'))) {
    events.push(event('brilliant','带将军、重要吃子或升变的走法接近分析首选',true));
  }
  if (Math.abs(a.value) >= 150 && Math.abs(b.value) >= 150 && Math.sign(a.value) !== Math.sign(b.value)) events.push({...event('reversal','稳定评价的优势方发生变化',true),playerAdvantage:b.value});
  if (Math.abs(b.value) <= 40) events.push(event('balanced','稳定评价接近均势'));
  return events;
}

/** A neutral factual reply is always available, even with no engine evaluation. */
export function stepEvent(move: Move, ply: number, player: Color): ChessEvent {
  const names = {p:'兵',n:'马',b:'象',r:'车',q:'后',k:'王'};
  const subject = move.color === player ? '你' : '我';
  const fact = move.isKingsideCastle() || move.isQueensideCastle()
    ? `${subject}完成了${move.isKingsideCastle() ? '王翼' : '后翼'}易位`
    : `${subject}的${names[move.piece]}从 ${move.from} 走到 ${move.to}${move.captured ? `，吃掉了${names[move.captured]}` : ''}${move.promotion ? `，升变为${names[move.promotion]}` : ''}${move.san.includes('+') ? '，形成将军' : ''}`;
  return {kind:'move',ply,actor:move.color === player ? 'player' : 'ai',important:false,fact};
}
