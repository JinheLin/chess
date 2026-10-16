import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, test, vi } from 'vitest';

const source = readFileSync(new URL('../../scripts/offline-worker.mjs', import.meta.url), 'utf8').replace('export function', 'function');
const root = 'https://example.com/chess/';
interface WorkerEvent {
  request?: Request;
  data?: { type: string };
  waitUntil: (promise: Promise<unknown>) => void;
  respondWith: (promise: Promise<unknown>) => void;
}
function setup(failedInstall = false) {
  const handlers: Record<string, (event: WorkerEvent) => void> = {};
  const storage = new Map([['chess-lab:/chess/:old', new Map<string, string>()], ['chess-lab:/other/:old', new Map<string, string>()]]);
  const addAll = vi.fn(async (requests: Request[]) => {
    if (failedInstall) throw new Error('Download failed');
    for (const request of requests) storage.get('chess-lab:/chess/:new')!.set(request.url, `cached:${request.url}`);
  });
  const caches = {
    open: vi.fn(async (name: string) => {
      if (!storage.has(name)) storage.set(name, new Map());
      return { addAll, match: async (url: string) => storage.get(name)!.get(url) };
    }),
    keys: async () => [...storage.keys()],
    delete: vi.fn(async (name: string) => storage.delete(name)),
  };
  const claim = vi.fn(async () => {}), skipWaiting = vi.fn(async () => {}), fetch = vi.fn(async () => 'network');
  const self = { location: { href: root + 'sw.js' }, clients: { claim }, skipWaiting, addEventListener: (type: string, handler: (event: WorkerEvent) => void) => { handlers[type] = handler; } };
  runInNewContext(`${source}\nofflineWorker('new', ['index.html', 'engine/stockfish.wasm', 'assets/app.js']);`, { self, caches, Request, URL, fetch });
  const dispatch = (type: string, values: Partial<WorkerEvent> = {}) => {
    const waitUntil = vi.fn(), respondWith = vi.fn();
    handlers[type]({ waitUntil, respondWith, ...values });
    return { waitUntil, respondWith, done: waitUntil.mock.calls[0]?.[0] as Promise<unknown> | undefined };
  };
  return { storage, caches, addAll, claim, skipWaiting, fetch, dispatch };
}

test('offline install revalidates every resource and waits for an explicit update', async () => {
  const worker = setup();
  await worker.dispatch('install').done;
  expect(worker.addAll.mock.calls[0][0].map(request => [request.url, request.cache])).toEqual([
    [root + 'index.html', 'no-cache'], [root + 'engine/stockfish.wasm', 'no-cache'], [root + 'assets/app.js', 'no-cache'],
  ]);
  expect(worker.skipWaiting).not.toHaveBeenCalled();
  await worker.dispatch('message', { data: { type: 'ACTIVATE_UPDATE' } }).done;
  expect(worker.skipWaiting).toHaveBeenCalledOnce();
});

test('a failed install leaves the previously working offline version intact', async () => {
  const worker = setup(true);
  await expect(worker.dispatch('install').done).rejects.toThrow('Download failed');
  expect(worker.storage.has('chess-lab:/chess/:old')).toBe(true);
  expect(worker.caches.delete).not.toHaveBeenCalled();
  expect(worker.claim).not.toHaveBeenCalled();
});

test('activation only removes old caches belonging to this app scope', async () => {
  const worker = setup();
  await worker.dispatch('install').done;
  await worker.dispatch('activate').done;
  expect([...worker.storage.keys()]).toEqual(['chess-lab:/other/:old', 'chess-lab:/chess/:new']);
  expect(worker.claim).toHaveBeenCalledOnce();
});

test('the page, versioned worker assets and WASM are served without a network wait', async () => {
  const worker = setup();
  await worker.dispatch('install').done;
  for (const [path, cached] of [['?from=home', 'index.html'], ['assets/app.js?v=3', 'assets/app.js'], ['engine/stockfish.wasm', 'engine/stockfish.wasm']]) {
    const event = worker.dispatch('fetch', { request: new Request(root + path) });
    await expect(event.respondWith.mock.calls[0][0]).resolves.toBe('cached:' + root + cached);
  }
  expect(worker.fetch).not.toHaveBeenCalled();
});

test('cache handling preserves missing-file responses, other apps and non-GET requests', async () => {
  const worker = setup();
  for (const request of [new Request(root + 'missing.wasm'), new Request('https://example.com/other/index.html'), new Request('https://other.com/chess/index.html'), new Request(root, { method: 'POST' })]) {
    expect(worker.dispatch('fetch', { request }).respondWith).not.toHaveBeenCalled();
  }
  const event = worker.dispatch('fetch', { request: new Request(root + 'assets/app.js') });
  await expect(event.respondWith.mock.calls[0][0]).resolves.toBe('network');
});
