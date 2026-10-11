import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const destination = new URL('../public/engine/', import.meta.url);
mkdirSync(destination, { recursive: true });
const prefix = readFileSync(new URL('./stockfish-worker-prefix.js', import.meta.url));
const original = readFileSync(new URL('../node_modules/stockfish/bin/stockfish-19-lite-single.js', import.meta.url));
writeFileSync(new URL('stockfish-19-lite-single.js', destination), Buffer.concat([prefix, original]));
copyFileSync(new URL('../node_modules/stockfish/bin/stockfish-19-lite-single.wasm', import.meta.url), new URL('stockfish-19-lite-single.wasm', destination));
copyFileSync(new URL('../node_modules/stockfish/Copying.txt', import.meta.url), new URL('COPYING.txt', destination));
