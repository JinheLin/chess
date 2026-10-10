export interface SearchOptions {
  movetimeMs: number;
  signal?: AbortSignal;
  /** Replay from the original position so repetition history reaches the engine. */
  initialFen?: string;
  moves?: readonly string[];
}
export interface ChessEngine {
  initialize(): Promise<void>;
  setDifficulty(level: number): Promise<void>;
  getBestMove(fen: string, options: SearchOptions): Promise<string>;
  dispose(): void;
}
export const DIFFICULTIES = [
  { label: '初级', skill: 0, movetimeMs: 300 },
  { label: '中级', skill: 8, movetimeMs: 650 },
  { label: '高级', skill: 16, movetimeMs: 1200 },
] as const;
