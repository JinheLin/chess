import { spawnSync } from 'node:child_process';
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/proxy/i.test(key)));
for (const [file, args] of [['scripts/prepare-engine.mjs', []], ['node_modules/typescript/bin/tsc', ['--noEmit']], ['node_modules/vite/bin/vite.js', ['build']]]) {
  const result = spawnSync(process.execPath, [file, ...args], { env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
