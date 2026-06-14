import { signal, computed } from '@preact/signals';
import { getDB } from './db';
import { generateId } from '../lib/id';
import { activeCollectionId, archiveCollection, touchCollection } from './collections';
import { tabSort } from './sort';

export const allTabs = signal([]);

export const activeTabs = computed(() => {
  const filtered = allTabs.value.filter((t) => t.collectionId === activeCollectionId.value);
  const mode = tabSort.value;
  if (mode === 'name') return [...filtered].sort((a, b) => a.title.localeCompare(b.title));
  if (mode === 'created') return [...filtered].sort((a, b) => b.createdAt - a.createdAt);
  return filtered.sort((a, b) => a.order - b.order); // manual
});

export async function loadTabs() {
  const db = getDB();
  const all = await db.getAll('tabs');
  allTabs.value = all;
}

export async function addTab(collectionId, title, url, favicon) {
  const db = getDB();
  const existing = allTabs.value.filter((t) => t.collectionId === collectionId);
  const maxOrder = existing.reduce((max, t) => Math.max(max, t.order), -1);
  const tab = {
    id: generateId(),
    collectionId,
    title,
    url,
    favicon: favicon || '',
    order: maxOrder + 1,
    createdAt: Date.now(),
  };
  await db.put('tabs', tab);
  allTabs.value = [...allTabs.value, tab];
  return tab;
}

export async function addTabs(collectionId, tabsData) {
  const db = getDB();
  const existing = allTabs.value.filter((t) => t.collectionId === collectionId);
  const maxOrder = existing.reduce((max, t) => Math.max(max, t.order), -1);
  const tx = db.transaction('tabs', 'readwrite');
  const newTabs = tabsData.map((t, i) => ({
    id: generateId(),
    collectionId,
    title: t.title,
    url: t.url,
    favicon: t.favicon || '',
    order: maxOrder + 1 + i,
    createdAt: t.createdAt ?? Date.now(),
  }));
  for (const tab of newTabs) {
    await tx.store.put(tab);
  }
  await tx.done;
  allTabs.value = [...allTabs.value, ...newTabs];
  return newTabs;
}

export async function removeTab(id) {
  const tab = allTabs.value.find((t) => t.id === id);
  const db = getDB();
  await db.delete('tabs', id);
  allTabs.value = allTabs.value.filter((t) => t.id !== id);
  if (tab) await touchCollection(tab.collectionId);
}

export async function moveTab(tabId, targetCollectionId, newOrder) {
  const db = getDB();
  const tab = allTabs.value.find((t) => t.id === tabId);
  if (!tab) return;

  const sourceCollectionId = tab.collectionId;
  const updated = {
    ...tab,
    collectionId: targetCollectionId,
    order: newOrder,
  };
  await db.put('tabs', updated);
  allTabs.value = allTabs.value.map((t) => (t.id === tabId ? updated : t));
  await touchCollection(targetCollectionId);
  if (sourceCollectionId !== targetCollectionId) {
    await touchCollection(sourceCollectionId);
  }
}

export async function archiveTab(tabId) {
  const archive = archiveCollection.value;
  if (!archive) return;
  const existing = allTabs.value.filter((t) => t.collectionId === archive.id);
  const maxOrder = existing.reduce((max, t) => Math.max(max, t.order), -1);
  await moveTab(tabId, archive.id, maxOrder + 1);
}

export async function reorderTabs(collectionId, orderedIds) {
  const db = getDB();
  const tx = db.transaction('tabs', 'readwrite');
  const updatedTabs = [];
  for (let i = 0; i < orderedIds.length; i++) {
    const tab = allTabs.value.find((t) => t.id === orderedIds[i]);
    if (tab) {
      const updated = { ...tab, collectionId, order: i };
      await tx.store.put(updated);
      updatedTabs.push(updated);
    }
  }
  await tx.done;
  const updatedIds = new Set(orderedIds);
  allTabs.value = [
    ...allTabs.value.filter((t) => !updatedIds.has(t.id)),
    ...updatedTabs,
  ];
}
