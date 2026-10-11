import { afterEach, describe, expect, test, vi } from 'vitest';
import { StockfishEngine } from '../../src/engine/StockfishEngine';
import type { EngineWorker } from '../../src/engine/StockfishEngine';
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
class WorkerMock implements EngineWorker {
  onmessage: EngineWorker['onmessage'] = null;
  onerror: EngineWorker['onerror'] = null;
  onmessageerror: EngineWorker['onmessageerror'] = null;
  commands: string[] = [];
  terminated = false;
  handshake = true;
  postMessage(command: string) {
    this.commands.push(command);
    if (this.handshake && command === 'uci') queueMicrotask(() => this.emit('uciok'));
    if (this.handshake && command === 'isready') queueMicrotask(() => this.emit('readyok'));
  }
  emit(data: string) { this.onmessage?.({ data } as MessageEvent); }
  terminate() { this.terminated = true; }
}
function setup(timeout = 20000) {
  const workers: WorkerMock[] = [];
  const engine = new StockfishEngine(() => { const worker = new WorkerMock(); workers.push(worker); return worker; }, timeout);
  return { engine, workers };
}
afterEach(() => vi.useRealTimers());
describe('Stockfish UCI adapter', () => {
  test('handshake, skill, complete history and bestmove parsing', async () => {
    const { engine, workers } = setup();
    await engine.setDifficulty(0);
    const pending = engine.getBestMove('current fen', {movetimeMs:300, initialFen:'initial fen', moves:['e2e4','e7e5']});
    await flush();
    expect(workers[0].commands).toEqual(['uci','setoption name Hash value 16','isready','setoption name Skill Level value 0','position fen initial fen moves e2e4 e7e5','go movetime 300']);
    workers[0].emit('info depth 2\nbestmove g1f3 ponder b8c6');
    await expect(pending).resolves.toBe('g1f3'); engine.dispose();
  });
  test('searches serialize and snapshot their difficulty', async () => {
    const {engine,workers} = setup();
    const a = engine.getBestMove('a', {movetimeMs:1});
    await engine.setDifficulty(16);
    const b = engine.getBestMove('b', {movetimeMs:2});
    await flush(); expect(workers[0].commands.filter(x=>x.startsWith('go'))).toHaveLength(1);
    workers[0].emit('bestmove e2e4'); await a; await flush();
    expect(workers[0].commands).toContain('setoption name Skill Level value 16');
    expect(workers[0].commands.filter(x=>x.startsWith('go'))).toHaveLength(2);
    workers[0].emit('bestmove d2d4'); await expect(b).resolves.toBe('d2d4'); engine.dispose();
  });
  test('abort destroys worker; even a late callback cannot satisfy the next search', async () => {
    const {engine,workers} = setup(); const signal = new AbortController();
    const a = engine.getBestMove('a', {movetimeMs:1,signal:signal.signal});
    const rejected = expect(a).rejects.toMatchObject({name:'AbortError'});
    await flush(); const staleCallback = workers[0].onmessage!; const staleError = workers[0].onerror!;
    signal.abort(); await rejected; expect(workers[0].terminated).toBe(true);
    const b = engine.getBestMove('b', {movetimeMs:1}); await flush();
    staleCallback({data:'bestmove a2a3'} as MessageEvent); staleError({} as ErrorEvent);
    expect(workers[1].terminated).toBe(false);
    workers[1].emit('bestmove e7e5'); await expect(b).resolves.toBe('e7e5'); engine.dispose();
  });
  test('already aborted queued request never starts', async () => {
    const {engine,workers} = setup(); const signal = new AbortController(); signal.abort();
    await expect(engine.getBestMove('a',{movetimeMs:1,signal:signal.signal})).rejects.toMatchObject({name:'AbortError'});
    expect(workers).toHaveLength(0); engine.dispose();
  });
  test('abort while loading rejects without leaking a waiter', async () => {
    const worker = new WorkerMock(); worker.handshake = false;
    const engine = new StockfishEngine(()=>worker); const signal = new AbortController();
    const a = engine.getBestMove('a',{movetimeMs:1,signal:signal.signal});
    const rejected = expect(a).rejects.toMatchObject({name:'AbortError'});
    await flush(); signal.abort(); await rejected; expect(worker.terminated).toBe(true); engine.dispose();
  });
  test('worker errors reject pending work and allow a fresh worker', async () => {
    const {engine,workers} = setup(); const a = engine.getBestMove('a',{movetimeMs:1});
    const rejected = expect(a).rejects.toThrow('加载失败');
    await flush(); workers[0].onerror?.({} as ErrorEvent); await rejected;
    const b = engine.getBestMove('b',{movetimeMs:1}); await flush(); workers[1].emit('bestmove a7a8n');
    await expect(b).resolves.toBe('a7a8n'); engine.dispose();
  });
  test('handshake and search timeouts terminate workers', async () => {
    vi.useFakeTimers();
    const worker = new WorkerMock(); worker.handshake = false;
    const engine = new StockfishEngine(()=>worker,10);
    const loading = expect(engine.initialize()).rejects.toThrow('超时');
    await vi.advanceTimersByTimeAsync(11); await loading; expect(worker.terminated).toBe(true); engine.dispose();
    const next = setup(10); const pending = expect(next.engine.getBestMove('a',{movetimeMs:1})).rejects.toThrow('超时');
    await vi.advanceTimersByTimeAsync(25); await pending; expect(next.workers[0].terminated).toBe(true); next.engine.dispose();
  });
  test('dispose rejects running and queued work', async () => {
    const {engine,workers} = setup();
    const a = expect(engine.getBestMove('a',{movetimeMs:1})).rejects.toMatchObject({name:'AbortError'});
    const b = expect(engine.getBestMove('b',{movetimeMs:1})).rejects.toThrow('关闭');
    await flush(); engine.dispose(); await a; await b; expect(workers[0].terminated).toBe(true);
  });
  test('invalid bestmove is rejected', async () => {
    const {engine,workers} = setup(); const pending = expect(engine.getBestMove('a',{movetimeMs:1})).rejects.toThrow('无效走法');
    await flush(); workers[0].emit('bestmove (none)'); await pending; engine.dispose();
  });
});
test('aborting a queued request does not kill the active search', async () => {
  const {engine,workers} = setup();
  const active = engine.getBestMove('a',{movetimeMs:1}); const abort = new AbortController();
  const queued = expect(engine.getBestMove('b',{movetimeMs:1,signal:abort.signal})).rejects.toMatchObject({name:'AbortError'});
  await flush(); abort.abort(); expect(workers[0].terminated).toBe(false);
  workers[0].emit('bestmove e2e4'); await expect(active).resolves.toBe('e2e4'); await queued;
  expect(workers[0].commands.filter(command=>command.startsWith('go'))).toHaveLength(1); engine.dispose();
});
test('message decoding errors reject current work and terminate the worker', async () => {
  const {engine,workers} = setup(); const pending = expect(engine.getBestMove('a',{movetimeMs:1})).rejects.toThrow('通信失败');
  await flush(); workers[0].onmessageerror?.({} as MessageEvent); await pending; expect(workers[0].terminated).toBe(true); engine.dispose();
});
test('worker construction failure is recoverable on the next initialization', async () => {
  const worker = new WorkerMock(); let attempts = 0;
  const engine = new StockfishEngine(()=>{ if (++attempts === 1) throw new Error('unavailable'); return worker; });
  await expect(engine.initialize()).rejects.toThrow('无法启动'); await expect(engine.initialize()).resolves.toBeUndefined(); engine.dispose();
});

test('analysis uses full strength, separates mate from cp and ignores bound / secondary scores', async () => {
  const {engine,workers} = setup(); await engine.setDifficulty(0);
  const pending = engine.analyze('fen',{movetimeMs:700,initialFen:'start',moves:['e2e4']});
  await flush();
  expect(workers[0].commands).toContain('setoption name Skill Level value 20');
  expect(workers[0].commands).toContain('go movetime 700 depth 16');
  workers[0].emit('info depth 10 multipv 1 score mate -3 pv a7a6\ninfo depth 11 multipv 1 score mate -3 pv a7a6\ninfo depth 12 score cp 900 lowerbound pv a7a6\ninfo depth 12 multipv 2 score cp 800 pv a7a6\nbestmove a7a6');
  await expect(pending).resolves.toMatchObject({score:{kind:'mate',value:-3},stable:true,depth:11});
  const playing = engine.getBestMove('fen',{movetimeMs:1}); await flush();
  expect(workers[0].commands).toContain('setoption name Skill Level value 0');
  workers[0].emit('bestmove e2e4'); await playing; engine.dispose();
});
test('cancelled analysis ignores stale scores and next analysis starts fresh', async () => {
  const {engine,workers} = setup();const abort = new AbortController();
  const pending = expect(engine.analyze('fen',{movetimeMs:1,signal:abort.signal})).rejects.toMatchObject({name:'AbortError'});
  await flush();const stale = workers[0].onmessage!;abort.abort();await pending;
  const fresh = engine.analyze('fen',{movetimeMs:1});await flush();
  stale({data:'info depth 20 score cp 999 pv e2e4\nbestmove e2e4'} as MessageEvent);
  workers[1].emit('info depth 2 score cp 12 pv d2d4\nbestmove d2d4');
  await expect(fresh).resolves.toMatchObject({stable:false,score:{value:12}});engine.dispose();
});
