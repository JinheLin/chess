import type { SearchOptions } from './ChessEngine';
export type Score = { kind: 'cp' | 'mate'; value: number };
export interface Evaluation { depth: number; score: Score; pv: readonly string[]; stable: boolean }
export interface AnalysisEngine {
  analyze(fen: string, options: SearchOptions): Promise<Evaluation | null>;
  dispose(): void;
}
/** UCI score is relative to the root side to move. Bounds and secondary PVs aren't verdicts. */
export function parseInfo(line: string): Omit<Evaluation, 'stable'> | null {
  if (!line.startsWith('info ') || /\b(?:lowerbound|upperbound)\b/.test(line)) return null;
  const depth = /\bdepth (\d+)\b/.exec(line), score = /\bscore (cp|mate) (-?\d+)\b/.exec(line);
  const multipv = /\bmultipv (\d+)\b/.exec(line), pv = /\bpv (.+)$/.exec(line);
  if (!depth || !score || !pv || (multipv && multipv[1] !== '1')) return null;
  const moves = pv[1].trim().split(/\s+/);
  if (!moves.every(move => /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move))) return null;
  return {depth:Number(depth[1]), score:{kind:score[1] as Score['kind'],value:Number(score[2])},pv:moves};
}
export function stableEvaluation(samples: readonly Omit<Evaluation,'stable'>[]): Evaluation | null {
  const last = samples.at(-1), previous = samples.at(-2);
  if (!last) return null;
  const stable = !!previous && previous.depth >= 10 && last.depth > previous.depth && last.score.kind === previous.score.kind &&
    (last.score.kind === 'cp' ? Math.abs(last.score.value - previous.score.value) <= 60 : last.score.value === previous.score.value);
  return {...last,stable};
}
