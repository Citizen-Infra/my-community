import {
  createDeploymentConfig,
  deploymentCommunityIds,
  deploymentFeedVisible,
  deploymentSyncPreferences,
  parseBooleanFlag,
} from '../../extension/src/lib/deployment-config.js';

let failures = 0;
const assert = (condition, message) => {
  if (condition) console.log('ok:', message);
  else { console.error('FAIL:', message); failures += 1; }
};
const rejects = (fn, message) => {
  try { fn(); assert(false, message); } catch { assert(true, message); }
};

const defaults = createDeploymentConfig();
assert(defaults.blueskyEnabled, 'ordinary deployments keep Bluesky enabled');
assert(defaults.pinnedCommunityId === null, 'ordinary deployments keep the community picker');
assert(defaults.linksApiBase === 'https://scenius-digest.vercel.app', 'ordinary deployments keep the shared links API');
assert(!defaults.linksRequireSignIn, 'ordinary links retain their existing public/private behavior');
assert(defaults.decisionApiBase === null, 'ordinary deployments do not expose a decision reader');

const pxxi = createDeploymentConfig({
  VITE_PINNED_COMMUNITY_ID: 'philanthropic-xxi',
  VITE_BLUESKY_ENABLED: 'false',
  VITE_LINKS_API_BASE: 'https://crapotkin.example/',
});
assert(pxxi.pinnedCommunityId === 'philanthropic-xxi', 'a deployment can pin one community');
assert(!pxxi.blueskyEnabled, 'a deployment can disable Bluesky');
assert(pxxi.linksApiBase === 'https://crapotkin.example', 'the private links API is normalized to its origin');
assert(pxxi.linksRequireSignIn, 'a configured links service is treated as private');
assert(pxxi.decisionApiBase === 'https://crapotkin.example', 'PXXI reuses its Crapotkin origin for decisions by default');
assert(JSON.stringify(deploymentCommunityIds(['cibc'], pxxi)) === '["philanthropic-xxi"]', 'the pin overrides stored community choices');
assert(!deploymentFeedVisible('network', true, pxxi), 'Network cannot be restored from stored preferences');

const baseline = {
  selectedCommunityIds: ['cibc'],
  visibleFeedKeys: ['network', 'digest'],
  network: { source: 'following', timeWindow: '7d', showReposts: true, ranking: 'most-liked' },
};
const syncable = deploymentSyncPreferences({
  selectedCommunityIds: ['philanthropic-xxi'],
  visibleFeedKeys: ['digest', 'participation'],
  network: { source: 'discover', timeWindow: '24h', showReposts: false, ranking: 'most-discussed' },
}, baseline, pxxi);
assert(syncable.selectedCommunityIds === baseline.selectedCommunityIds, 'the pinned deployment does not overwrite account-wide community choices');
assert(syncable.visibleFeedKeys.includes('network'), 'the Bluesky-off deployment preserves account-wide Network visibility');
assert(syncable.network === baseline.network, 'hidden Network settings remain untouched during preference sync');

const firstSync = deploymentSyncPreferences({
  selectedCommunityIds: ['philanthropic-xxi'],
  visibleFeedKeys: ['digest', 'participation', 'communityInput'],
  network: { source: 'hidden-deployment-value', timeWindow: '7d', showReposts: false, ranking: 'most-discussed' },
}, null, pxxi);
assert(firstSync.selectedCommunityIds.length === 0, 'a first sync does not make the deployment pin an account-wide choice');
assert(firstSync.visibleFeedKeys.includes('network'), 'a first sync preserves ordinary Network visibility');
assert(firstSync.network.source === 'timeline', 'a first sync uses ordinary Network defaults instead of hidden deployment state');

rejects(() => parseBooleanFlag('off'), 'ambiguous boolean values fail closed');
rejects(() => createDeploymentConfig({ VITE_PINNED_COMMUNITY_ID: 'Philanthropic XXI' }), 'invalid community pins fail closed');
rejects(() => createDeploymentConfig({ VITE_LINKS_API_BASE: '/api' }), 'relative links API bases fail closed');
rejects(() => createDeploymentConfig({ VITE_LINKS_API_BASE: 'https://example.com/path' }), 'links API bases cannot smuggle a path');
rejects(() => createDeploymentConfig({ VITE_LINKS_API_BASE: 'http://example.com' }), 'non-local links APIs require HTTPS');
assert(createDeploymentConfig({ VITE_DECISIONS_API_BASE: 'https://decisions.example/' }).decisionApiBase === 'https://decisions.example', 'an explicit decisions API origin is normalized');
rejects(() => createDeploymentConfig({ VITE_DECISIONS_API_BASE: 'https://example.com/private' }), 'decision API bases cannot smuggle a path');

console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
