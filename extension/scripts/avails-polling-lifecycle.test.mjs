import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import {
  availsFeedNeedsAuth,
  pollsForAccount,
  visibleAvailsCommunityIds,
} from '../src/lib/avails-preview.js';

// Exercise the real store without installing the extension's Preact bundle.
// Signals are reduced to the .value interface used by this store.
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};
const cache = await import('../src/lib/cache.js');
const { clearPrivateCommunityCaches } = await import('../src/lib/private-data.js');
const selectedCommunities = { value: [{ id: 'philanthropic-xxi', visibility: 'private' }] };
const caSignedIn = { value: true };
const caSubject = { value: 'member-a' };
let respond;
let timerStopped = false;
let fetchCount = 0;
const source = readFileSync(new URL('../src/store/avails.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace(/^export /gm, '');
function makeStore() {
  const context = vm.createContext({
    AVAILS_URL: 'https://avails.example',
    authHeader: async () => ({ Authorization: 'test' }),
    caSignedIn,
    caSubject,
    selectedCommunities,
    deploymentConfig: { linksRequireSignIn: true },
    availsFeedNeedsAuth,
    pollsForAccount,
    visibleAvailsCommunityIds,
    ...cache,
    signal: (value) => ({ value }),
    computed: (compute) => ({ get value() { return compute(); } }),
    fetch: () => { fetchCount++; return new Promise((resolve) => { respond = resolve; }); },
    setInterval: () => 1,
    clearInterval: () => { timerStopped = true; },
    console,
  });
  vm.runInContext(`${source}\nglobalThis.store = { hydrateAvailsPolls, loadAvailsPolls, startAvailsPolling, stopAvailsPolling, visibleAvailsPolls };`, context);
  return context.store;
}
const { loadAvailsPolls, startAvailsPolling, stopAvailsPolling, visibleAvailsPolls } = makeStore();
async function waitForFetch() {
  respond = undefined;
  for (let attempt = 0; attempt < 4 && !respond; attempt++) await Promise.resolve();
  assert.equal(typeof respond, 'function');
}
function expireCache() {
  const key = 'mc_avails_polls_cache';
  const cached = JSON.parse(storage.get(key));
  cached.timestamp = 0;
  storage.set(key, JSON.stringify(cached));
}

const pending = loadAvailsPolls(['philanthropic-xxi']);
await waitForFetch();
stopAvailsPolling({ preserve: true }); // leave focused feed for the overview
respond({ ok: true, json: async () => ({ polls: [{ community: 'philanthropic-xxi', did: 'did:plc:a', rkey: 'one' }] }) });
await pending;
assert.equal(visibleAvailsPolls.value.length, 1, 'the in-flight response reaches the overview');
assert.equal(fetchCount, 1);

startAvailsPolling(['philanthropic-xxi']);
await Promise.resolve();
assert.equal(fetchCount, 1, 'reopening the feed within five minutes does not fetch again');
assert.equal(visibleAvailsPolls.value.length, 1, 'reopening does not blank the poll card');
stopAvailsPolling({ preserve: true });
assert.equal(timerStopped, true, 'leaving the feed stops its timer');

const reopened = makeStore(); // a new tab, with an empty in-memory store
assert.equal(reopened.hydrateAvailsPolls(['philanthropic-xxi'], { allowStale: true }), true);
assert.equal(reopened.visibleAvailsPolls.value.length, 1, 'a new tab restores the account-scoped snapshot');
await reopened.loadAvailsPolls(['philanthropic-xxi']);
assert.equal(fetchCount, 1, 'a fresh persisted snapshot avoids a redundant request');
caSubject.value = 'member-b';
assert.equal(makeStore().hydrateAvailsPolls(['philanthropic-xxi'], { allowStale: true }), false,
  'another account cannot hydrate the private poll from disk');
caSubject.value = 'member-a';
assert.equal(makeStore().hydrateAvailsPolls(['cibc'], { allowStale: true }), false,
  'a different community selection cannot hydrate the private poll from disk');
expireCache();
const refreshing = reopened.loadAvailsPolls(['philanthropic-xxi']);
await waitForFetch();
assert.equal(reopened.visibleAvailsPolls.value.length, 1, 'an expired snapshot remains visible during refresh');
respond({ status: 503, ok: false });
await refreshing;
assert.equal(reopened.visibleAvailsPolls.value.length, 1, 'a source outage keeps the last snapshot');

const denied = reopened.loadAvailsPolls(['philanthropic-xxi']);
await waitForFetch();
respond({ status: 403, ok: false });
await denied;
assert.equal(reopened.visibleAvailsPolls.value.length, 0, 'revoked membership removes the private poll');
assert.equal(storage.has('mc_avails_polls_cache'), false, 'denied data is not retained on disk');

selectedCommunities.value = [];
assert.equal(visibleAvailsPolls.value.length, 0, 'deselection hides the retained private poll immediately');
selectedCommunities.value = [{ id: 'philanthropic-xxi', visibility: 'private' }];
caSignedIn.value = false;
assert.equal(visibleAvailsPolls.value.length, 0, 'lost membership hides the retained private poll');
caSignedIn.value = true;
caSubject.value = 'member-b';
assert.equal(visibleAvailsPolls.value.length, 0, 'switching accounts hides the retained poll');
caSubject.value = 'member-a';
caSubject.value = null;
stopAvailsPolling({ preserve: caSubject.value === 'member-a' });
cache.setCached('mc_avails_polls_cache', [{ community: 'philanthropic-xxi' }], cache.accountCommunityKey('member-a', ['philanthropic-xxi']));
clearPrivateCommunityCaches();
assert.equal(storage.has('mc_avails_polls_cache'), false, 'sign-out erases persisted private polls');
caSubject.value = 'member-a';
assert.equal(visibleAvailsPolls.value.length, 0, 'sign-out cannot resurface a stale poll after reauthorizing the same account');

startAvailsPolling(['philanthropic-xxi']);
await waitForFetch();
stopAvailsPolling({ preserve: true });
stopAvailsPolling();
respond({ ok: true, json: async () => ({ polls: [{ community: 'philanthropic-xxi', did: 'did:plc:a', rkey: 'late' }] }) });
await Promise.resolve();
await Promise.resolve();
assert.equal(visibleAvailsPolls.value.length, 0, 'full teardown clears and invalidates pending responses');

console.log('Avails poll lifecycle tests passed');
