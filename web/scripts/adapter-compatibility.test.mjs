const { normalizeDashboardPreferences, preferencesMatch } = await import('../../extension/src/lib/dashboard-preferences.js');
const { latestUnsavedPreference } = await import('../../extension/src/lib/preference-write-queue.js');
const { configurePlatform, oauthClientIdForSession } = await import('../../extension/src/lib/platform.js');

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
configurePlatform({ oauthClientId: 'https://web.example/client-metadata.json' });
assert(oauthClientIdForSession({ clientId: 'https://original.example/client-metadata.json' }) === 'https://original.example/client-metadata.json', 'token refresh keeps the client id that created the session');
assert(oauthClientIdForSession({}) === 'https://web.example/client-metadata.json', 'older sessions fall back to the active platform client id');
const changedDuringSave = { ...local, selectedCommunityIds: ['sen'] };
assert(latestUnsavedPreference(changedDuringSave, local) === changedDuringSave, 'a preference change made during a save remains queued');
assert(latestUnsavedPreference(local, local) === null, 'a completed save does not queue an identical snapshot');

console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
