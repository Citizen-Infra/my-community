import { signal, computed } from '@preact/signals';

const GROUPS_API = 'https://scenius-digest.vercel.app/api/groups';

export const allCommunities = signal([]);
export const communitiesLoading = signal(false);

// Persisted: array of community keys (e.g. ["scenius", "cibc"])
const stored = JSON.parse(localStorage.getItem('mc_communities') || '[]');
export const selectedCommunityIds = signal(stored);

export const communitiesConfigured = computed(() => selectedCommunityIds.value.length > 0);

export const selectedCommunities = computed(() =>
  allCommunities.value.filter((c) => selectedCommunityIds.value.includes(c.id))
);

export async function loadCommunities() {
  communitiesLoading.value = true;
  try {
    const res = await fetch(GROUPS_API);
    const data = await res.json();
    // Transform { scenius: { name: ... }, cibc: { name: ... } } → array
    const groups = Object.entries(data.groups || data).map(([key, val]) => ({
      id: key,
      name: val.name,
      topics: val.topics ? (Array.isArray(val.topics) ? val.topics : Object.keys(val.topics)) : [],
      luma_url: val.luma_url || null,
    }));
    allCommunities.value = groups;
  } catch (err) {
    console.error('Failed to load communities:', err);
  }
  communitiesLoading.value = false;
}

export function toggleCommunity(id) {
  const current = selectedCommunityIds.value;
  const next = current.includes(id)
    ? current.filter((c) => c !== id)
    : [...current, id];
  selectedCommunityIds.value = next;
  localStorage.setItem('mc_communities', JSON.stringify(next));
}
