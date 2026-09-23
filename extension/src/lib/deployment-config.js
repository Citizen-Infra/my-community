const DEFAULT_CONTENT_API_BASE = 'https://scenius-digest.vercel.app';
const DEFAULT_ACCOUNT_NETWORK = Object.freeze({
  source: 'timeline',
  timeWindow: '24h',
  showReposts: true,
  ranking: 'most-liked',
});

function optionalValue(value) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

export function parseBooleanFlag(value, fallback = true) {
  const normalized = optionalValue(value);
  if (normalized === null) return fallback;
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  throw new Error('Boolean deployment flags must be "true" or "false".');
}

function communityId(value) {
  const normalized = optionalValue(value);
  if (normalized !== null && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
    throw new Error('VITE_PINNED_COMMUNITY_ID must be a lowercase community slug.');
  }
  return normalized;
}

function apiBase(value, name = 'VITE_LINKS_API_BASE', fallback = DEFAULT_CONTENT_API_BASE) {
  const normalized = optionalValue(value);
  if (normalized === null) return fallback;
  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(`${name} must be an absolute HTTP(S) origin.`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password
    || parsed.search || parsed.hash || (parsed.pathname !== '/' && parsed.pathname !== '')) {
    throw new Error(`${name} must be an absolute HTTP(S) origin.`);
  }
  if (parsed.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)) {
    throw new Error(`${name} must use HTTPS outside local development.`);
  }
  return parsed.origin;
}

export function createDeploymentConfig(env = {}) {
  const pinnedCommunityId = communityId(env.VITE_PINNED_COMMUNITY_ID);
  const configuredLinksApiBase = optionalValue(env.VITE_LINKS_API_BASE);
  const linksApiBase = apiBase(configuredLinksApiBase);
  const configuredDecisionsApiBase = optionalValue(env.VITE_DECISIONS_API_BASE);
  return Object.freeze({
    blueskyEnabled: parseBooleanFlag(env.VITE_BLUESKY_ENABLED, true),
    decisionApiBase: configuredDecisionsApiBase === null
      ? (pinnedCommunityId === 'philanthropic-xxi' && configuredLinksApiBase !== null ? linksApiBase : null)
      : apiBase(configuredDecisionsApiBase, 'VITE_DECISIONS_API_BASE', null),
    linksApiBase,
    linksRequireSignIn: configuredLinksApiBase !== null,
    pinnedCommunityId,
  });
}

const viteEnv = import.meta.env || {};
export const deploymentConfig = createDeploymentConfig(viteEnv);

export function deploymentCommunityIds(ids, config = deploymentConfig) {
  return config.pinnedCommunityId
    ? [config.pinnedCommunityId]
    : ids;
}

export function deploymentFeedVisible(key, requested = true, config = deploymentConfig) {
  return requested && (key !== 'network' || config.blueskyEnabled);
}

export function deploymentSyncPreferences(snapshot, baseline, config = deploymentConfig) {
  if (!baseline && !config.pinnedCommunityId && config.blueskyEnabled) return snapshot;
  const accountBaseline = baseline || {
    selectedCommunityIds: [],
    visibleFeedKeys: [...new Set(['network', ...snapshot.visibleFeedKeys])],
    network: DEFAULT_ACCOUNT_NETWORK,
  };
  const next = { ...snapshot };
  // These flags describe this deployment, not the member's account-wide choice.
  // Preserve an existing server document so the PXXI site cannot silently pin
  // or hide feeds in the ordinary multi-community deployment.
  if (config.pinnedCommunityId) {
    next.selectedCommunityIds = accountBaseline.selectedCommunityIds;
  }
  if (!config.blueskyEnabled) {
    const visible = new Set(next.visibleFeedKeys);
    if (accountBaseline.visibleFeedKeys.includes('network')) visible.add('network');
    else visible.delete('network');
    next.visibleFeedKeys = [...visible];
    next.network = accountBaseline.network;
  }
  return next;
}
