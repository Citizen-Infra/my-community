// One-off test (no framework in this repo). Run: node scripts/cache.test.mjs
// Shims localStorage so the pure cache helper runs under node (package.json type:module).
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { getCached, setCached, clearCached, communityKey } = await import('../src/lib/cache.js');

let failures = 0;
const assert = (cond, msg) => {
  if (cond) console.log('ok:', msg);
  else { console.error('FAIL:', msg); failures++; }
};

assert(getCached('k', 1000) === null, 'miss returns null');

setCached('k', { a: 1 });
assert(JSON.stringify(getCached('k', 1000)) === JSON.stringify({ a: 1 }), 'fresh get returns value');

setCached('k2', 42);
assert(getCached('k2', -1) === null, 'expired (age >= ttl) returns null');

setCached('k3', 'x', 'cibc');
assert(getCached('k3', 1000, 'scenius') === null, 'selector mismatch returns null');
assert(getCached('k3', 1000, 'cibc') === 'x', 'selector match returns value');

setCached('k4', 1);
clearCached('k4');
assert(getCached('k4', 1000) === null, 'clearCached removes the entry');

const ids = ['b', 'a'];
assert(communityKey(ids) === 'a,b', 'communityKey sorts');
assert(ids[0] === 'b', 'communityKey does not mutate input');

globalThis.localStorage.setItem('k5', '{not json');
assert(getCached('k5', 1000) === null, 'corrupt JSON returns null');

console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
