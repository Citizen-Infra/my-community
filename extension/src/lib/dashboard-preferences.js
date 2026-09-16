export const DASHBOARD_PREFERENCE_SCHEMA_VERSION = 1;
export const DASHBOARD_FEED_KEYS = ['network', 'digest', 'participation', 'communityInput'];
export const SUPPORTING_TILE_KEYS = ['featured', 'openCollective', 'stewardship', 'jam'];

const WINDOWS = new Set(['24h', '7d', '30d']);
const RANKINGS = new Set(['most-liked', 'most-discussed']);

function uniqueAllowed(values, allowed) {
  const result = [];
  for (const value of Array.isArray(values) ? values : []) {
    if (allowed.includes(value) && !result.includes(value)) result.push(value);
  }
  return result;
}

function normalizeSource(value) {
  if (value === 'timeline') return value;
  if (typeof value === 'string' && value.length <= 500 && /^at:\/\/[^\s/]+\/[^\s/]+\/[^\s/]+$/.test(value)) return value;
  return 'timeline';
}

export function normalizeDashboardPreferences(value = {}) {
  const feedOrder = uniqueAllowed(value.feedOrder, DASHBOARD_FEED_KEYS);
  for (const key of DASHBOARD_FEED_KEYS) if (!feedOrder.includes(key)) feedOrder.push(key);
  const previewDepths = Object.fromEntries(DASHBOARD_FEED_KEYS.map((key) => {
    const depth = value.previewDepths?.[key];
    return [key, depth === 'auto' || (Number.isInteger(depth) && depth >= 1 && depth <= 20) ? depth : 'auto'];
  }));
  const selectedCommunityIds = [...new Set((Array.isArray(value.selectedCommunityIds) ? value.selectedCommunityIds : [])
    .filter((id) => typeof id === 'string' && /^[a-z0-9][a-z0-9-]{0,99}$/.test(id)))]
    .slice(0, 50);

  return {
    schemaVersion: DASHBOARD_PREFERENCE_SCHEMA_VERSION,
    revision: Number.isInteger(value.revision) && value.revision > 0 ? value.revision : null,
    selectedCommunityIds,
    visibleFeedKeys: uniqueAllowed(value.visibleFeedKeys ?? DASHBOARD_FEED_KEYS, DASHBOARD_FEED_KEYS),
    feedOrder,
    previewDepths,
    network: {
      source: normalizeSource(value.network?.source),
      timeWindow: WINDOWS.has(value.network?.timeWindow) ? value.network.timeWindow : '24h',
      showReposts: value.network?.showReposts !== false,
      ranking: RANKINGS.has(value.network?.ranking) ? value.network.ranking : 'most-liked',
    },
    visibleSupportingTileKeys: uniqueAllowed(
      value.visibleSupportingTileKeys ?? SUPPORTING_TILE_KEYS,
      SUPPORTING_TILE_KEYS,
    ),
    activeSkin: value.activeSkin ?? null,
  };
}

export function comparablePreferences(value) {
  const normalized = normalizeDashboardPreferences(value);
  delete normalized.revision;
  return JSON.stringify(normalized);
}

export function preferencesMatch(a, b) {
  return comparablePreferences(a) === comparablePreferences(b);
}
