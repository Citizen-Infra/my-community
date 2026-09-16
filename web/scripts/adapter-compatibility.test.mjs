const { normalizeDashboardPreferences, preferencesMatch } = await import('../../extension/src/lib/dashboard-preferences.js');

let failures = 0;
const assert = (condition, message) => {
  if (condition) console.log('ok:', message);
  else { console.error('FAIL:', message); failures += 1; }
};

const local = {
  selectedCommunityIds: ['cibc'],
  visibleFeedKeys: ['digest', 'participation'],
  feedOrder: ['digest', 'network', 'participation', 'communityInput'],
  previewDepths: { digest: 3, network: 'auto', participation: 5, communityInput: 'auto' },
  network: { source: 'timeline', timeWindow: '7d', showReposts: false, ranking: 'most-discussed' },
  visibleSupportingTileKeys: ['stewardship'],
  activeSkin: null,
};
const extensionAdapter = normalizeDashboardPreferences(local);
const webAdapter = normalizeDashboardPreferences(JSON.parse(JSON.stringify(local)));
assert(preferencesMatch(extensionAdapter, webAdapter), 'web and extension adapters consume the same schema');
assert(extensionAdapter.schemaVersion === webAdapter.schemaVersion, 'both adapters pin the same schema version');

console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
