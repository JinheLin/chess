import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const prefix = await readFile('scripts/stockfish-worker-prefix.js');
const originalJs = await readFile('node_modules/stockfish/bin/stockfish-19-lite-single.js');
const shippedJs = await readFile('dist/engine/stockfish-19-lite-single.js');
assert.equal(hash(shippedJs), hash(Buffer.concat([prefix, originalJs])), 'stockfish js changed');
const shippedWasm = await readFile('dist/engine/stockfish-19-lite-single.wasm');
assert.equal(hash(shippedWasm), hash(await readFile('node_modules/stockfish/bin/stockfish-19-lite-single.wasm')), 'stockfish wasm changed');
assert(WebAssembly.validate(shippedWasm), 'Invalid WebAssembly');
assert.deepEqual((await readdir('dist/engine')).sort(),['COPYING.txt','stockfish-19-lite-single.js','stockfish-19-lite-single.wasm']);
assert((await readFile('dist/engine/COPYING.txt','utf8')).includes('GNU GENERAL PUBLIC LICENSE'));
assert((await readFile('dist/THIRD_PARTY_NOTICES.txt','utf8')).includes('54fde71d90c7c403964f6cacef48f7bbec495df1'));
const html = await readFile('dist/index.html','utf8');
for (const [,path] of html.matchAll(/(?:src|href)="(\.\/assets\/[^" ]+)"/g)) assert((await stat('dist/' + path)).isFile());
assert(html.includes('./assets/'),'Expected relative asset URLs');
assert(html.includes('rel="manifest"') && html.includes('./manifest.webmanifest'), 'Missing home screen manifest');
assert(html.includes('rel="preload"') && html.includes('./engine/stockfish-19-lite-single.wasm'), 'Missing early engine download');
const manifest = JSON.parse(await readFile('dist/manifest.webmanifest', 'utf8'));
assert.equal(manifest.start_url, './');
assert.equal(manifest.scope, './');
assert.equal(manifest.display, 'standalone');
for (const icon of manifest.icons) {
  const bytes = await readFile('dist/' + icon.src);
  assert.equal(bytes.readUInt32BE(16), Number(icon.sizes.split('x')[0]));
  assert.equal(bytes.readUInt32BE(20), Number(icon.sizes.split('x')[1]));
}
const worker = await readFile('dist/sw.js', 'utf8');
for (const resource of ['index.html', 'manifest.webmanifest', 'engine/stockfish-19-lite-single.js', 'engine/stockfish-19-lite-single.wasm', 'engine/COPYING.txt', 'THIRD_PARTY_NOTICES.txt']) {
  assert(worker.includes(JSON.stringify(resource)), 'Missing offline resource: ' + resource);
}
process.stdout.write('Production assets, WASM, licenses and relative paths verified.\n');
