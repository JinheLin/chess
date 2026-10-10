// Implemented in M2. UI must never communicate directly with a Worker.
export interface ChessEngine {
  initialize(): Promise<void>;
  setDifficulty(level: number): Promise<void>;
  getBestMove(fen: string, options: { movetimeMs: number; signal?: AbortSignal }): Promise<string>;
  dispose(): void;
}
