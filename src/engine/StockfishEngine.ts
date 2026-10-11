import type { ChessEngine, SearchOptions } from './ChessEngine';
import { parseInfo, stableEvaluation } from './AnalysisEngine';
import type { AnalysisEngine, Evaluation } from './AnalysisEngine';

export interface EngineWorker {
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
  postMessage(message: string): void;
  terminate(): void;
}
const aborted = () => new DOMException('搜索已取消', 'AbortError');

/** One UCI conversation at a time. Cancellation destroys the conversation entirely. */
export class StockfishEngine implements ChessEngine, AnalysisEngine {
  private worker: EngineWorker | null = null;
  private ready: Promise<void> | null = null;
  private closed = false;
  private skill = 8;
  private queue: Promise<unknown> = Promise.resolve();
  private waiter: { match: (line: string) => boolean; resolve: (line: string) => void; reject: (error: Error) => void } | null = null;

  constructor(private readonly createWorker: () => EngineWorker = () => new Worker(
    `${import.meta.env.BASE_URL}engine/stockfish-19-lite-single.js`,
  ), private readonly timeoutMs = 20000) {}

  private reset(error: Error) {
    const worker = this.worker;
    this.worker = null;
    this.ready = null;
    if (worker) {
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      worker.terminate();
    }
    this.waiter?.reject(error);
    this.waiter = null;
  }

  private command(command: string, match: (line: string) => boolean, timeout = this.timeoutMs) {
    return new Promise<string>((resolve, reject) => {
      if (!this.worker || this.closed) { reject(new Error('引擎已关闭')); return; }
      const finish = (error?: Error, line = '') => {
        clearTimeout(timer);
        this.waiter = null;
        if (error) reject(error); else resolve(line);
      };
      const timer = setTimeout(() => this.reset(new Error('引擎响应超时，请重试')), timeout);
      this.waiter = { match, resolve: line => finish(undefined, line), reject: error => finish(error) };
      try { this.worker.postMessage(command); }
      catch { this.reset(new Error('无法向引擎发送指令')); }
    });
  }

  initialize(): Promise<void> {
    if (this.closed) return Promise.reject(new Error('引擎已关闭'));
    if (this.ready) return this.ready;
    try {
      const worker = this.createWorker();
      this.worker = worker;
      worker.onmessage = event => {
        if (this.worker !== worker || typeof event.data !== 'string') return;
        for (const line of event.data.split(/\r?\n/)) {
          if (this.waiter?.match(line.trim())) this.waiter.resolve(line.trim());
        }
      };
      worker.onerror = () => { if (this.worker === worker) this.reset(new Error('Stockfish 加载失败，请检查浏览器是否支持 WebAssembly')); };
      worker.onmessageerror = () => { if (this.worker === worker) this.reset(new Error('引擎通信失败，请重试')); };
      this.ready = (async () => {
        await this.command('uci', line => line === 'uciok');
        if (this.worker !== worker) throw aborted();
        worker.postMessage('setoption name Hash value 16');
        await this.command('isready', line => line === 'readyok');
      })();
      return this.ready;
    } catch {
      this.reset(new Error('无法启动 Stockfish Worker'));
      return Promise.reject(new Error('无法启动 Stockfish Worker'));
    }
  }

  async setDifficulty(level: number) {
    if (!Number.isInteger(level) || level < 0 || level > 20) throw new Error('无效的 AI 难度');
    this.skill = level;
  }

  getBestMove(fen: string, options: SearchOptions): Promise<string> {
    return this.search(fen, options, this.skill).then(result => result.move);
  }

  analyze(fen: string, options: SearchOptions): Promise<Evaluation | null> {
    return this.search(fen, options, 20, true).then(result => result.evaluation);
  }

  private search(fen: string, options: SearchOptions, skill: number, analysis = false) {
    const search = async () => {
      const { signal } = options;
      if (signal?.aborted) throw aborted();
      if (this.closed) throw new Error('引擎已关闭');
      const cancel = () => this.reset(aborted());
      signal?.addEventListener('abort', cancel, { once: true });
      try {
        await this.initialize();
        if (signal?.aborted) throw aborted();
        this.worker!.postMessage(`setoption name Skill Level value ${skill}`);
        const position = options.initialFen ?? fen;
        const moves = options.initialFen && options.moves?.length ? ` moves ${options.moves.join(' ')}` : '';
        this.worker!.postMessage(`position fen ${position}${moves}`);
        const samples: Omit<Evaluation, 'stable'>[] = [];
        const line = await this.command(`go movetime ${options.movetimeMs}${analysis ? ' depth 16' : ''}`, text => {
          if (analysis) {
            const info = parseInfo(text);
            if (info) {
              if (samples.at(-1)?.depth === info.depth) samples.pop();
              samples.push(info);
            }
          }
          return text.startsWith('bestmove ');
        }, this.timeoutMs + options.movetimeMs);
        if (signal?.aborted) throw aborted();
        const move = line.split(/\s+/)[1];
        if (!(analysis && ['(none)', '0000'].includes(move)) && !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)) throw new Error('引擎返回了无效走法');
        return { move, evaluation: stableEvaluation(samples) };
      } finally {
        signal?.removeEventListener('abort', cancel);
      }
    };
    const result = this.queue.then(search);
    // A failed request never poisons the queue for the next request.
    this.queue = result.catch(() => undefined);
    return result;
  }

  dispose() { this.closed = true; this.reset(aborted()); }
}
