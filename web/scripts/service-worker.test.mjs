import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(resolve(root, 'public/service-worker.js'), 'utf8');
const handlers = {};
const writes = [];
let matchResult = null;
let fetchResult = null;

vm.runInNewContext(source, {
  URL,
  self: {
    location: { origin: 'https://my.citizeninfra.org' },
    addEventListener: (name, handler) => { handlers[name] = handler; },
    skipWaiting: () => Promise.resolve(),
    clients: { claim: () => Promise.resolve() },
  },
  caches: {
    open: async () => ({
      addAll: async () => {},
      put: async (key, response) => { writes.push([key, response]); },
    }),
    keys: async () => [],
    delete: async () => true,
    match: async () => matchResult,
  },
  fetch: async () => {
    if (fetchResult instanceof Error) throw fetchResult;
    return fetchResult;
  },
});

const request = {
  method: 'GET',
  url: 'https://my.citizeninfra.org/participation',
  mode: 'navigate',
  destination: 'document',
  headers: { has: () => false },
};

async function dispatchFetch(activeRequest = request) {
  const waits = [];
  let responsePromise;
  handlers.fetch({
    request: activeRequest,
    respondWith: (value) => { responsePromise = Promise.resolve(value); },
    waitUntil: (value) => { waits.push(Promise.resolve(value)); },
  });
  const response = await responsePromise;
  await Promise.all(waits);
  return response;
}

let failures = 0;
const assert = (condition, message) => {
  if (condition) console.log('ok:', message);
  else { console.error('FAIL:', message); failures += 1; }
};

const shellCopy = { version: 'current' };
fetchResult = { ok: true, type: 'basic', headers: { get: () => 'text/html; charset=utf-8' }, clone: () => shellCopy };
await dispatchFetch();
assert(writes.some(([key, value]) => key === '/' && value === shellCopy), 'successful navigation refreshes the offline shell');

writes.length = 0;
fetchResult = { ok: true, type: 'basic', headers: { get: () => 'application/manifest+json' }, clone: () => ({ version: 'not-html' }) };
await dispatchFetch({ ...request, url: 'https://my.citizeninfra.org/manifest.webmanifest' });
assert(writes.length === 0, 'non-HTML navigation cannot replace the offline shell');

matchResult = { version: 'cached' };
fetchResult = new Error('offline');
assert((await dispatchFetch()) === matchResult, 'offline navigation falls back to the refreshed shell');

console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
