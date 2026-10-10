import { copyFileSync, mkdirSync } from 'node:fs';
const destination = new URL('../public/engine/', import.meta.url);
mkdirSync(destination, { recursive: true });
for (const file of ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm']) {
  copyFileSync(new URL(`../node_modules/stockfish/bin/${file}`, import.meta.url), new URL(file, destination));
}
copyFileSync(new URL('../node_modules/stockfish/Copying.txt', import.meta.url), new URL('COPYING.txt', destination));
