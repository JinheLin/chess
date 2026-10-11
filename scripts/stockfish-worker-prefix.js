/* Streaming compile stays the fast path: the download and compilation overlap.
 * A failed download is reported immediately. If streaming rejects, as it does
 * for WebKit's rebuilt progress Response, compile from the bytes instead. */
(() => {
  const native = WebAssembly.instantiateStreaming.bind(WebAssembly);
  const compile = WebAssembly.instantiate.bind(WebAssembly);
  const originalFetch = fetch.bind(self);
  const isWasm = value => {
    const raw = typeof value === 'string' ? value : value && typeof value.url === 'string' ? value.url : '';
    return raw.split(/[?#]/)[0].endsWith('.wasm');
  };
  const report = () => {
    try { postMessage('info string chess-lab-engine-failed'); } catch { /* worker is closing */ }
  };
  const wasmUrl = () => {
    const url = new URL(location.href);
    url.hash = '';
    url.search = '';
    url.pathname = url.pathname.replace(/\.js$/i, '.wasm');
    return url.href;
  };
  self.fetch = (input, init) => Promise.resolve(originalFetch(input, init)).then(response => {
    if (isWasm(input) && !response.ok) report();
    return response;
  }, error => {
    if (isWasm(input)) report();
    throw error;
  });
  WebAssembly.instantiateStreaming = (source, imports) => Promise.resolve(source).then(response => native(response, imports).catch(() => {
    const buffered = response.bodyUsed ? originalFetch(wasmUrl()).then(reply => reply.arrayBuffer()) : response.arrayBuffer();
    return buffered.then(bytes => compile(bytes, imports)).catch(error => { report(); throw error; });
  }));
})();
