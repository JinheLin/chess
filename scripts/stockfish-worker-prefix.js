/* Runs before Stockfish. WebKit hangs or rejects instantiateStreaming on the
 * progress-wrapped Response, and that failure often never becomes worker.onerror.
 * Compile from the downloaded bytes instead, and report download progress so a
 * slow phone is not abandoned mid-transfer. */
(() => {
  let wasmBytes = null;
  let reported = false;
  const report = () => {
    if (reported) return;
    reported = true;
    try { postMessage('info string chess-lab-engine-failed'); } catch { /* worker is closing */ }
  };
  const note = loaded => {
    try { postMessage(`info string chess-lab-engine-progress ${loaded}`); } catch { /* worker is closing */ }
  };
  const originalFetch = fetch.bind(self);
  const isWasm = value => {
    const raw = typeof value === 'string' ? value : value && typeof value.url === 'string' ? value.url : '';
    return raw.split(/[?#]/)[0].endsWith('.wasm');
  };
  const compile = WebAssembly.instantiate.bind(WebAssembly);
  const instantiate = (bytes, imports) => compile(bytes, imports).catch(error => { report(); throw error; });
  self.fetch = (input, init) => Promise.resolve()
    .then(() => originalFetch(input, init))
    .then(async response => {
      if (!isWasm(input) && !isWasm(response.url)) return response;
      if (!response.ok) { report(); return response; }
      if (!response.body) {
        const buffered = await response.arrayBuffer();
        wasmBytes = buffered;
        note(buffered.byteLength);
        return new Response(buffered.slice(0), { status: response.status, statusText: response.statusText, headers: { 'Content-Type': 'application/wasm' } });
      }
      const reader = response.body.getReader();
      const chunks = [];
      let received = 0;
      let reportedAt = 0;
      let step = await reader.read();
      while (!step.done) {
        chunks.push(step.value);
        received += step.value.byteLength;
        const now = Date.now();
        if (now - reportedAt >= 400) { reportedAt = now; note(received); }
        step = await reader.read();
      }
      const bytes = new Uint8Array(received);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      wasmBytes = bytes.buffer;
      note(received);
      return new Response(bytes.slice(), { status: response.status, statusText: response.statusText, headers: { 'Content-Type': 'application/wasm' } });
    })
    .catch(error => { if (isWasm(input)) report(); throw error; });
  WebAssembly.instantiateStreaming = (source, imports) => wasmBytes
    ? instantiate(wasmBytes, imports)
    : Promise.resolve(source).then(response => response.arrayBuffer()).then(bytes => instantiate(bytes, imports));
})();
