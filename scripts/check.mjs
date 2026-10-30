import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = name => readFileSync(resolve(root, name), 'utf8');
const bases = ['https://example.test/', 'https://example.test/colindantes/'];
let resourceChecks = 0;
function resource(ref, page, base) {
  if (!ref || ref.startsWith('#') || /^(?:https?:|data:|blob:|mailto:)/.test(ref)) return;
  const url = new URL(ref, new URL(page, base));
  assert.equal(url.origin, new URL(base).origin);
  assert(url.pathname.startsWith(new URL(base).pathname), 'Ruta fuera del repositorio: ' + ref);
  const local = decodeURIComponent(url.pathname.slice(new URL(base).pathname.length)) || 'index.html';
  assert(existsSync(resolve(root, local)), 'Falta el recurso: ' + local);
  resourceChecks++;
}

for (const file of readdirSync(root).filter(x => /\.(mjs|js)$/.test(x))) {
  execFileSync(process.execPath, ['--check', resolve(root, file)], { stdio: 'pipe' });
  const text = read(file);
  assert(!text.includes('location.origin+'), 'Ruta dependiente de la raíz: ' + file);
  for (const match of text.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)) {
    for (const base of bases) resource(match[1], file, base);
  }
}
for (const base of bases) {
  for (const file of ['index.html', 'coordenadas.html']) {
    for (const match of read(file).matchAll(/(?:href|src)="([^"]+)"/g)) resource(match[1], file, base);
  }
  const manifest = JSON.parse(read('manifest.webmanifest'));
  for (const key of ['id', 'start_url', 'scope']) resource(manifest[key], 'manifest.webmanifest', base);
  for (const icon of manifest.icons) resource(icon.src, 'manifest.webmanifest', base);
  for (const shortcut of manifest.shortcuts) {
    resource(shortcut.url, 'manifest.webmanifest', base);
    for (const icon of shortcut.icons || []) resource(icon.src, 'manifest.webmanifest', base);
  }

  // Execute the actual OCR loader with a worker stub and check its requested files.
  let options;
  const imaging = read('imaging.mjs').replaceAll('export ', '').replaceAll('import.meta.url', JSON.stringify(new URL('imaging.mjs', base).href));
  const ocrContext = vm.createContext({
    URL,
    window: { Tesseract: { createWorker: async (_lang, _mode, opts) => { options = opts; return {}; } } }
  });
  await vm.runInContext(imaging + '\ncreateOCRWorker(() => {});', ocrContext);
  for (const url of [options.workerPath, options.corePath.replace(/\/$/, '') + '/tesseract-core-lstm.wasm.js', options.langPath.replace(/\/$/, '') + '/spa.traineddata.gz']) {
    assert(url.startsWith(base), 'OCR fuera del repositorio: ' + url);
    resource(url.slice(base.length), 'index.html', base);
  }

  // Register the PWA script and confirm that the scope stays inside this repository.
  let registration;
  const pwa = read('pwa.mjs').replaceAll('import.meta.url', JSON.stringify(new URL('pwa.mjs', base).href));
  const loadEvents = {};
  const pwaContext = vm.createContext({
    URL, document: { getElementById: () => null },
    window: { navigator: {}, matchMedia: () => ({ matches: false }), addEventListener: (name, fn) => { loadEvents[name] = fn; } },
    navigator: { serviceWorker: { register: async (url, opts) => { registration = { url: String(url), ...opts }; } } }
  });
  vm.runInContext(pwa, pwaContext);
  loadEvents.load();
  assert.equal(registration.url, new URL('sw.js', base).href);
  assert.equal(registration.scope, base);

  // Exercise install, activation, requests and offline fallback with two app caches.
  const prefix = 'colindantes:' + new URL(base).pathname + ':';
  const other = 'colindantes:/another-repo/:v1';
  const stores = new Map([[prefix + 'old', new Map()], [other, new Map()], ['unrelated-app', new Map()]]);
  const handlers = {};
  let offline = false;
  const key = request => typeof request === 'string' ? request : request.url;
  const caches = {
    keys: async () => [...stores.keys()],
    delete: async name => stores.delete(name),
    open: async name => {
      if (!stores.has(name)) stores.set(name, new Map());
      const values = stores.get(name);
      return { put: async (req, res) => values.set(key(req), res), match: async req => values.get(key(req)) };
    }
  };
  const context = vm.createContext({
    URL, Set, caches,
    self: {
      location: new URL('sw.js', base),
      addEventListener: (name, fn) => { handlers[name] = fn; },
      skipWaiting: async () => {},
      clients: { claim: async () => {} }
    },
    fetch: async request => {
      if (offline) throw new Error('offline');
      const url = key(request);
      assert(url.startsWith(base), 'Solicitud fuera del repositorio: ' + url);
      resource(url.slice(base.length), 'index.html', base);
      return new Response('cached resource', { status: 200 });
    }
  });
  vm.runInContext(read('sw.js'), context);
  for (const name of ['install', 'activate']) {
    let completion;
    handlers[name]({ waitUntil: promise => { completion = promise; } });
    await completion;
  }
  assert(!stores.has(prefix + 'old'));
  assert(stores.has(other) && stores.has('unrelated-app'), 'Se borró la caché de otra aplicación');
  async function request(path) {
    let response;
    handlers.fetch({ request: { method: 'GET', url: new URL(path, base).href }, respondWith: value => { response = value; } });
    return response === undefined ? undefined : await response;
  }
  assert.equal((await request('assets/worker.min.js')).status, 200);
  offline = true;
  assert.equal((await request('index.html')).status, 200);
  assert.equal((await request('assets/worker.min.js')).status, 200);
  assert.equal(await request('/unrelated-file'), undefined);
}
console.log('OK: sintaxis, ' + resourceChecks + ' recursos/rutas, carga del OCR, PWA y caché probados en raíz y subcarpeta.');
