import { collections } from './collections';
import { allTabs } from './tabs';
import { getDB } from './db';

const STORAGE_KEY = 'tab-hoarder-backup';

export async function syncToStorage() {
  try {
    // Never overwrite a good backup with an empty state. An empty in-memory
    // state almost always means a transient failure (e.g. the browser cleared
    // site storage and the load/restore failed), not an intentional wipe.
    // Intentional "clear all data" goes through clearAllData(), which removes
    // the key directly.
    if (collections.value.length === 0 && allTabs.value.length === 0) return;
    await chrome.storage.local.set({
      [STORAGE_KEY]: {
        collections: collections.value,
        tabs: allTabs.value,
      },
    });
  } catch (err) {
    console.error('Tab Hoarder: sync to chrome.storage.local failed', err);
  }
}

export async function restoreFromStorage() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const data = result[STORAGE_KEY];
    if (!data || !data.collections?.length) return false;

    const db = getDB();
    const tx = db.transaction(['collections', 'tabs'], 'readwrite');
    for (const col of data.collections) {
      await tx.objectStore('collections').put(col);
    }
    for (const tab of data.tabs) {
      await tx.objectStore('tabs').put(tab);
    }
    await tx.done;
    return true;
  } catch (err) {
    console.error('Tab Hoarder: restore from chrome.storage.local failed', err);
    return false;
  }
}
