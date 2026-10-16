import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { offlineWorker } from './offline-worker.mjs';

const root = new URL('../dist/', import.meta.url);
const files = (await readdir(root, { recursive: true, withFileTypes: true }))
  .filter(entry => entry.isFile())
  .map(entry => relative(fileURLToPath(root), resolve(entry.parentPath, entry.name)).split(sep).join('/'))
  .filter(file => file !== 'sw.js' && !file.startsWith('source/'))
  .sort();
const hash = createHash('sha256').update(offlineWorker.toString());
for (const file of files) hash.update(file).update(await readFile(new URL(file, root)));
const version = hash.digest('hex').slice(0, 16);
await writeFile(new URL('sw.js', root), `(${offlineWorker.toString()})(${JSON.stringify(version)}, ${JSON.stringify(files)});\n`);
process.stdout.write(`Offline cache prepared: ${files.length} resources (${version}).\n`);
