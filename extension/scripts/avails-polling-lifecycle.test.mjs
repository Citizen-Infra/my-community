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
const selectedCommunities = { value: [{ id: 'philanthropic-xxi', visibility: 'private' }] };
const caSignedIn = { value: true };
const caSubject = { value: 'member-a' };
let respond;
let timerStopped = false;
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
  signal: (value) => ({ value }),
  computed: (compute) => ({ get value() { return compute(); } }),
  fetch: () => new Promise((resolve) => { respond = resolve; }),
  setInterval: () => 1,
  clearInterval: () => { timerStopped = true; },
  console,
});
const source = readFileSync(new URL('../src/store/avails.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace(/^export /gm, '');
vm.runInContext(`${source}\nglobalThis.store = { loadAvailsPolls, startAvailsPolling, stopAvailsPolling, visibleAvailsPolls };`, context);
const { loadAvailsPolls, startAvailsPolling, stopAvailsPolling, visibleAvailsPolls } = context.store;
async function waitForFetch() {
  respond = undefined;
  for (let attempt = 0; attempt < 4 && !respond; attempt++) await Promise.resolve();
  assert.equal(typeof respond, 'function');
}

const pending = loadAvailsPolls(['philanthropic-xxi']);
await waitForFetch();
stopAvailsPolling({ preserve: true }); // leave focused feed for the overview
respond({ ok: true, json: async () => ({ polls: [{ community: 'philanthropic-xxi', did: 'did:plc:a', rkey: 'one' }] }) });
await pending;
assert.equal(visibleAvailsPolls.value.length, 1, 'the in-flight response reaches the overview');

selectedCommunities.value = [];
assert.equal(visibleAvailsPolls.value.length, 0, 'deselection hides the retained private poll immediately');
selectedCommunities.value = [{ id: 'philanthropic-xxi', visibility: 'private' }];
caSignedIn.value = false;
assert.equal(visibleAvailsPolls.value.length, 0, 'lost membership hides the retained private poll');
caSignedIn.value = true;
caSubject.value = 'member-b';
assert.equal(visibleAvailsPolls.value.length, 0, 'switching accounts hides the retained poll');
caSubject.value = 'member-a';

startAvailsPolling(['philanthropic-xxi']);
await waitForFetch();
stopAvailsPolling({ preserve: true });
assert.equal(timerStopped, true, 'the feed polling timer stops on overview');
stopAvailsPolling();
respond({ ok: true, json: async () => ({ polls: [{ community: 'philanthropic-xxi', did: 'did:plc:a', rkey: 'late' }] }) });
await Promise.resolve();
await Promise.resolve();
assert.equal(visibleAvailsPolls.value.length, 0, 'full teardown clears and invalidates pending responses');

console.log('Avails poll lifecycle tests passed');
