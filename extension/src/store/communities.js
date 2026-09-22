import { signal, computed } from '@preact/signals';
import { authHeader, caSubject } from './caAuth';
import { accountCommunityKey, getCached, setCached } from '../lib/cache';
import { deploymentCommunityIds, deploymentConfig } from '../lib/deployment-config';

const GROUPS_API = 'https://scenius-digest.vercel.app/api/groups';
const CACHE_KEY = 'mc_communities_cache';
const CACHE_TTL = 60 * 60 * 1000; // 1h — the community list changes rarely

export const allCommunities = signal([]);
export const communitiesStatus = signal('loading'); // 'loading' | 'ready' | 'error'

// Persisted: array of community keys (e.g. ["scenius", "cibc"])
const stored = JSON.parse(localStorage.getItem('mc_communities') || '[]');
export const selectedCommunityIds = signal(deploymentCommunityIds(stored));

export const communitiesConfigured = computed(() => selectedCommunityIds.value.length > 0);

export const selectedCommunities = computed(() =>
  allCommunities.value.filter((c) => selectedCommunityIds.value.includes(c.id))
);

export async function loadCommunities({ force = false } = {}) {
  // The structured selector also invalidates legacy unscoped snapshots, which
  // could otherwise retain a private community list after sign-out.
  const selector = accountCommunityKey(caSubject.value, []);
  const cached = force ? null : getCached(CACHE_KEY, CACHE_TTL, selector);
  if (cached) {
    allCommunities.value = cached;
    communitiesStatus.value = 'ready';
    return;
  }
  communitiesStatus.value = 'loading';
  try {
    const res = await fetch(GROUPS_API, { headers: await authHeader() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    // Transform { scenius: { name: ... }, cibc: { name: ... } } → array
    const groups = Object.entries(data.groups || data).map(([key, val]) => ({
      ...val,
      id: key,
      name: val.name,
      topics: val.topics ? (Array.isArray(val.topics) ? val.topics : Object.keys(val.topics)) : [],
      city: val.city || null,
      event_topics: val.event_topics || [],
      event_apis: val.event_apis || [],
      hasDigest: !!(val.topics && (Array.isArray(val.topics) ? val.topics.length > 0 : Object.keys(val.topics).length > 0)),
      hasEvents: !!(val.event_apis && val.event_apis.length > 0) || !!(val.event_topics && val.event_topics.length > 0),
    }));
    allCommunities.value = groups;
    setCached(CACHE_KEY, groups, selector);
    communitiesStatus.value = 'ready';
  } catch (err) {
    console.error('Failed to load communities:', err);
    communitiesStatus.value = 'error';
  }
}

export function toggleCommunity(id) {
  if (deploymentConfig.pinnedCommunityId) {
    const pinned = deploymentCommunityIds([]);
    selectedCommunityIds.value = pinned;
    localStorage.setItem('mc_communities', JSON.stringify(pinned));
    return;
  }
  const current = selectedCommunityIds.value;
  const next = current.includes(id)
    ? current.filter((c) => c !== id)
    : [...current, id];
  selectedCommunityIds.value = next;
  localStorage.setItem('mc_communities', JSON.stringify(next));
}
