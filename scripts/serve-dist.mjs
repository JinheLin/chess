// A strict static host for release tests: no Vite transforms or SPA fallback.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
const root = resolve('dist');
const mount = process.env.STATIC_MOUNT || '/chess/';
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.wasm':'application/wasm','.txt':'text/plain; charset=utf-8','.json':'application/json','.gz':'application/gzip'};
createServer(async (request,response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url,'http://localhost').pathname);
    if (pathname === mount.slice(0,-1)) { response.writeHead(302,{Location:mount}); response.end(); return; }
    if (!pathname.startsWith(mount)) { response.writeHead(404); response.end(); return; }
    const file = resolve(root,pathname.slice(mount.length) || 'index.html');
    if (!file.startsWith(root + sep) || !(await stat(file)).isFile()) throw new Error('missing');
    const body = await readFile(file);
    response.writeHead(200,{'Content-Type':types[extname(file)] || 'application/octet-stream','Cache-Control':'no-cache'});
    response.end(body);
  } catch { response.writeHead(404); response.end('Not found'); }
}).listen(5174,'127.0.0.1',()=>process.stdout.write('Static release at http://127.0.0.1:5174' + mount + '\n'));
