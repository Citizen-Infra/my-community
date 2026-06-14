import { signal, computed } from '@preact/signals';
import { allTabs } from './tabs';
import { collections } from './collections';

export const searchQuery = signal('');

export const searchResults = computed(() => {
  const q = searchQuery.value.toLowerCase().trim();
  if (!q) return [];

  const matched = allTabs.value.filter(
    (t) =>
      t.title.toLowerCase().includes(q) || t.url.toLowerCase().includes(q)
  );

  // Group by collection
  const grouped = {};
  for (const tab of matched) {
    if (!grouped[tab.collectionId]) {
      const col = collections.value.find((c) => c.id === tab.collectionId);
      grouped[tab.collectionId] = {
        collection: col,
        tabs: [],
      };
    }
    grouped[tab.collectionId].tabs.push(tab);
  }

  return Object.values(grouped);
});
