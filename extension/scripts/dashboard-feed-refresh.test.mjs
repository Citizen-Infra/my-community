import assert from 'node:assert/strict';
import { refreshInactiveDashboardFeeds } from '../src/lib/dashboard-feed-refresh.js';

async function run(overrides = {}) {
  const calls = [];
  await refreshInactiveDashboardFeeds({
    tabs: ['digest', 'participation', 'network', 'communityInput'],
    activeTab: 'communityInput',
    isCancelled: () => false,
    isConnected: () => true,
    isLoading: () => false,
    refresh: async (tab) => { calls.push(tab); },
    ...overrides,
  });
  return calls;
}

assert.deepEqual(
  await run(),
  ['digest', 'participation', 'network'],
  'inactive data tiles revalidate even when a stale snapshot was hydrated'
);

assert.deepEqual(
  await run({ activeTab: 'digest' }),
  ['participation', 'network'],
  'the focused feed remains owned by the focused-feed loader'
);

assert.deepEqual(
  await run({ isConnected: () => false }),
  ['digest', 'participation'],
  'Network stays idle while disconnected'
);

assert.deepEqual(
  await run({ isLoading: (tab) => tab === 'participation' }),
  ['digest', 'network'],
  'a feed with an in-flight refresh is not started twice'
);

const cancelledCalls = [];
let cancelled = false;
await refreshInactiveDashboardFeeds({
  tabs: ['digest', 'participation'],
  activeTab: 'network',
  isCancelled: () => cancelled,
  isConnected: () => true,
  isLoading: () => false,
  refresh: async (tab) => {
    cancelledCalls.push(tab);
    cancelled = true;
  },
});
assert.deepEqual(cancelledCalls, ['digest'], 'cancellation stops later refreshes');

console.log('dashboard feed refresh tests passed');
