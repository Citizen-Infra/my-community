import { openDB } from 'idb';

let db;

export async function initDB() {
  db = await openDB('tab-hoarder', 1, {
    upgrade(db) {
      const collections = db.createObjectStore('collections', { keyPath: 'id' });
      collections.createIndex('by-order', 'order');

      const tabs = db.createObjectStore('tabs', { keyPath: 'id' });
      tabs.createIndex('by-collection', 'collectionId');
      tabs.createIndex('by-collection-order', ['collectionId', 'order']);
    },
  });
  return db;
}

export function getDB() {
  return db;
}

export async function clearAllData() {
  const tx = db.transaction(['collections', 'tabs'], 'readwrite');
  await tx.objectStore('collections').clear();
  await tx.objectStore('tabs').clear();
  await tx.done;
  await chrome.storage.local.remove('tab-hoarder-backup');
}
