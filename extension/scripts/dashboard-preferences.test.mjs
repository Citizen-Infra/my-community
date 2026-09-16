const {
  DASHBOARD_FEED_KEYS,
  normalizeDashboardPreferences,
  preferencesMatch,
} = await import('../src/lib/dashboard-preferences.js');

let failures = 0;
const assert = (condition, message) => {
  if (condition) console.log('ok:', message);
  else { console.error('FAIL:', message); failures += 1; }
};

const normalized = normalizeDashboardPreferences({
  selectedCommunityIds: ['cibc', 'cibc', 'Not Valid'],
  visibleFeedKeys: ['digest', 'unknown'],
  feedOrder: ['participation', 'digest'],
  previewDepths: { digest: 50, participation: 3 },
  network: { source: 'not-a-feed', timeWindow: 'forever', showReposts: false, ranking: 'most-discussed' },
  visibleSupportingTileKeys: ['jam', 'jam', 'unknown'],
});

assert(normalized.schemaVersion === 1, 'uses preference schema version 1');
assert(JSON.stringify(normalized.selectedCommunityIds) === '["cibc"]', 'deduplicates and validates community ids');
assert(normalized.feedOrder.length === DASHBOARD_FEED_KEYS.length && normalized.feedOrder[0] === 'participation', 'preserves valid order and fills missing feeds');
assert(normalized.previewDepths.digest === 'auto' && normalized.previewDepths.participation === 3, 'normalizes preview depths');
assert(normalized.network.source === 'timeline' && normalized.network.timeWindow === '24h', 'normalizes network source and window');
assert(preferencesMatch(normalized, { ...normalized, revision: 99, updatedAt: new Date().toISOString() }), 'revision metadata does not create a layout difference');

console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
