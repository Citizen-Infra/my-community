import { signal, computed } from '@preact/signals';
import { getDB } from './db';
import { generateId } from '../lib/id';
import { collectionSort } from './sort';

export const collections = signal([]);
export const activeCollectionId = signal(null);

export const activeCollection = computed(() =>
  collections.value.find((c) => c.id === activeCollectionId.value) || null
);

export const archiveCollection = computed(() =>
  collections.value.find((c) => c.isArchive) || null
);

export const regularCollections = computed(() => {
  const filtered = collections.value.filter((c) => !c.isArchive);
  const mode = collectionSort.value;
  if (mode === 'name') return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  if (mode === 'updated') return [...filtered].sort((a, b) => b.updatedAt - a.updatedAt);
  return filtered; // manual: already sorted by order from DB
});

export async function loadCollections() {
  const db = getDB();
  const all = await db.getAllFromIndex('collections', 'by-order');
  collections.value = all;
  if (all.length > 0 && !activeCollectionId.value) {
    activeCollectionId.value = (all.find((c) => !c.isArchive) || all[0]).id;
  }
}

export async function getOrCreateArchive() {
  const existing = collections.value.find((c) => c.isArchive);
  if (existing) return existing;

  const db = getDB();
  const archive = {
    id: generateId(),
    name: 'Archive',
    order: -1,
    color: null,
    isArchive: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await db.put('collections', archive);
  collections.value = [archive, ...collections.value];
  return archive;
}

export async function createCollection(name, opts = {}) {
  const db = getDB();
  const maxOrder = collections.value.reduce((max, c) => Math.max(max, c.order), -1);
  const now = Date.now();
  const collection = {
    id: generateId(),
    name,
    order: maxOrder + 1,
    color: opts.color ?? null,
    createdAt: opts.createdAt ?? now,
    updatedAt: opts.updatedAt ?? now,
  };
  await db.put('collections', collection);
  collections.value = [...collections.value, collection];
  activeCollectionId.value = collection.id;
  return collection;
}

export async function touchCollection(id) {
  const db = getDB();
  const collection = collections.value.find((c) => c.id === id);
  if (!collection) return;
  const updated = { ...collection, updatedAt: Date.now() };
  await db.put('collections', updated);
  collections.value = collections.value.map((c) => (c.id === id ? updated : c));
}

export async function renameCollection(id, name) {
  const db = getDB();
  const collection = collections.value.find((c) => c.id === id);
  if (!collection || collection.isArchive) return;
  const updated = { ...collection, name, updatedAt: Date.now() };
  await db.put('collections', updated);
  collections.value = collections.value.map((c) => (c.id === id ? updated : c));
}

export async function deleteCollection(id) {
  const collection = collections.value.find((c) => c.id === id);
  if (collection?.isArchive) return;
  const db = getDB();
  // Delete all tabs in collection
  const tx = db.transaction(['collections', 'tabs'], 'readwrite');
  const tabIndex = tx.objectStore('tabs').index('by-collection');
  let cursor = await tabIndex.openCursor(IDBKeyRange.only(id));
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.objectStore('collections').delete(id);
  await tx.done;

  collections.value = collections.value.filter((c) => c.id !== id);
  if (activeCollectionId.value === id) {
    activeCollectionId.value = (collections.value.find((c) => !c.isArchive) || collections.value[0])?.id || null;
  }
}

export async function reorderCollections(orderedIds) {
  const db = getDB();
  const archiveCol = collections.value.find((c) => c.isArchive);
  const regularIds = orderedIds.filter((id) => !collections.value.find((c) => c.id === id)?.isArchive);
  const tx = db.transaction('collections', 'readwrite');
  const updated = regularIds.map((id, index) => {
    const c = collections.value.find((col) => col.id === id);
    return { ...c, order: index, updatedAt: Date.now() };
  });
  for (const c of updated) {
    await tx.store.put(c);
  }
  await tx.done;
  collections.value = [archiveCol, ...updated].filter(Boolean);
}
