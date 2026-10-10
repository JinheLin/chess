import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
for (const extension of ['js','wasm']) {
  const name = `stockfish-19-lite-single.${extension}`;
  const shipped = await readFile(`dist/engine/${name}`);
  assert.equal(hash(shipped),hash(await readFile(`node_modules/stockfish/bin/${name}`)),`${name} changed`);
  if (extension === 'wasm') assert(WebAssembly.validate(shipped),'Invalid WebAssembly');
}
assert.deepEqual((await readdir('dist/engine')).sort(),['COPYING.txt','stockfish-19-lite-single.js','stockfish-19-lite-single.wasm']);
assert((await readFile('dist/engine/COPYING.txt','utf8')).includes('GNU GENERAL PUBLIC LICENSE'));
assert((await readFile('dist/THIRD_PARTY_NOTICES.txt','utf8')).includes('54fde71d90c7c403964f6cacef48f7bbec495df1'));
const html = await readFile('dist/index.html','utf8');
for (const [,path] of html.matchAll(/(?:src|href)="(\.\/assets\/[^" ]+)"/g)) assert((await stat('dist/' + path)).isFile());
assert(html.includes('./assets/'),'Expected relative asset URLs');
process.stdout.write('Production assets, WASM, licenses and relative paths verified.\n');
