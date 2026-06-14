// Open the tab-hoarder IndexedDB directly (no build deps)
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('tab-hoarder', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('collections')) {
        const cs = db.createObjectStore('collections', { keyPath: 'id' });
        cs.createIndex('by-order', 'order');
      }
      if (!db.objectStoreNames.contains('tabs')) {
        const ts = db.createObjectStore('tabs', { keyPath: 'id' });
        ts.createIndex('by-collection', 'collectionId');
        ts.createIndex('by-collection-order', ['collectionId', 'order']);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// If IndexedDB is empty (e.g. the browser cleared site storage), rehydrate it
// from the chrome.storage.local backup BEFORE we save into it. Without this, a
// toolbar/Alt+S save against a freshly-wiped DB would create a 1-tab DB and then
// mirror that over the good backup, destroying it.
async function restoreIfEmpty(db) {
  const cols = await getAllFromStore(db, 'collections');
  const tabs = await getAllFromStore(db, 'tabs');
  if (cols.length > 0 || tabs.length > 0) return false;
  const stored = await chrome.storage.local.get('tab-hoarder-backup');
  const data = stored['tab-hoarder-backup'];
  if (!data || !(data.collections || []).length) return false;
  await new Promise((resolve, reject) => {
    const tx = db.transaction(['collections', 'tabs'], 'readwrite');
    for (const c of data.collections) tx.objectStore('collections').put(c);
    for (const t of (data.tabs || [])) tx.objectStore('tabs').put(t);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return true;
}

function getSavedTabsCollection(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('collections', 'readonly');
    const req = tx.objectStore('collections').getAll();
    req.onsuccess = () => {
      const found = req.result.find(c => c.name === 'Saved Tabs' && !c.isArchive);
      resolve(found || null);
    };
    req.onerror = () => reject(req.error);
  });
}

function getRecentCollection(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('collections', 'readonly');
    const req = tx.objectStore('collections').getAll();
    req.onsuccess = () => {
      const regular = req.result.filter(c => !c.isArchive);
      if (regular.length === 0) return resolve(null);
      regular.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      resolve(regular[0]);
    };
    req.onerror = () => reject(req.error);
  });
}

function createDefaultCollection(db) {
  return new Promise((resolve, reject) => {
    const col = {
      id: crypto.randomUUID(),
      name: 'Saved Tabs',
      order: 0,
      color: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const tx = db.transaction('collections', 'readwrite');
    tx.objectStore('collections').put(col);
    tx.oncomplete = () => resolve(col);
    tx.onerror = () => reject(tx.error);
  });
}

function getMaxTabOrder(db, collectionId) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tabs', 'readonly');
    const index = tx.objectStore('tabs').index('by-collection-order');
    const range = IDBKeyRange.bound([collectionId, -Infinity], [collectionId, Infinity]);
    const req = index.openCursor(range, 'prev');
    req.onsuccess = () => resolve(req.result ? req.result.value.order : -1);
    req.onerror = () => reject(req.error);
  });
}

function saveTab(db, collectionId, title, url, favicon, order) {
  return new Promise((resolve, reject) => {
    const tab = {
      id: crypto.randomUUID(),
      collectionId,
      title,
      url,
      favicon,
      order,
      createdAt: Date.now(),
    };
    const tx = db.transaction('tabs', 'readwrite');
    tx.objectStore('tabs').put(tab);
    tx.oncomplete = () => resolve(tab);
    tx.onerror = () => reject(tx.error);
  });
}

// Save tab to a collection, close it, sync backup, and notify
async function saveAndCloseTab(tab, collection) {
  const db = await openDB();
  if (!collection) {
    collection = await createDefaultCollection(db);
  }

  const maxOrder = await getMaxTabOrder(db, collection.id);
  const hostname = new URL(tab.url).hostname.replace(/^www\./, '');
  const favicon = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;

  await saveTab(db, collection.id, tab.title, tab.url, favicon, maxOrder + 1);

  // Update collection's updatedAt (equivalent of touchCollection in app context)
  const updated = { ...collection, updatedAt: Date.now() };
  await new Promise((resolve, reject) => {
    const tx = db.transaction('collections', 'readwrite');
    tx.objectStore('collections').put(updated);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  // Mirror to chrome.storage.local
  const allCollections = await getAllFromStore(db, 'collections');
  const allTabs = await getAllFromStore(db, 'tabs');
  db.close();
  chrome.storage.local.set({
    'tab-hoarder-backup': { collections: allCollections, tabs: allTabs },
  });

  // Brief badge confirmation
  chrome.action.setBadgeBackgroundColor({ color: '#3d8c40' });
  chrome.action.setBadgeText({ text: '✓' });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 1500);

  chrome.tabs.remove(tab.id);

  // Notify open new tab pages to refresh
  chrome.runtime.sendMessage({ type: 'DATA_CHANGED' }).catch(() => {});
}

// Toolbar icon click: save based on setting (default: "Saved Tabs")
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) return;
  try {
    const settings = await chrome.storage.local.get('tab-hoarder-toolbar-target');
    const target = settings['tab-hoarder-toolbar-target'] || 'saved-tabs';
    const db = await openDB();
    await restoreIfEmpty(db);
    const collection = target === 'most-recent'
      ? await getRecentCollection(db)
      : await getSavedTabsCollection(db);
    db.close();
    await saveAndCloseTab(tab, collection);
  } catch (err) {
    console.error('Tab Hoarder: failed to save tab', err);
  }
});

// Alt+S shortcut: save based on setting (default: most recent collection)
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'save-to-recent') return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) return;
    const settings = await chrome.storage.local.get('tab-hoarder-shortcut-target');
    const target = settings['tab-hoarder-shortcut-target'] || 'most-recent';
    const db = await openDB();
    await restoreIfEmpty(db);
    const collection = target === 'saved-tabs'
      ? await getSavedTabsCollection(db)
      : await getRecentCollection(db);
    db.close();
    await saveAndCloseTab(tab, collection);
  } catch (err) {
    console.error('Tab Hoarder: failed to save tab via shortcut', err);
  }
});

// --- Daily backup ---

function getAllFromStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getBrowserName() {
  if (navigator.brave) return 'brave';
  return 'chrome';
}

async function runBackup() {
  try {
    const settings = await chrome.storage.local.get('tab-hoarder-daily-backup');
    if (settings['tab-hoarder-daily-backup'] === false) return;

    const db = await openDB();
    await restoreIfEmpty(db); // if the browser cleared site storage, rehydrate before backing up
    const collections = await getAllFromStore(db, 'collections');
    const tabs = await getAllFromStore(db, 'tabs');
    db.close();

    if (collections.length === 0 && tabs.length === 0) return;

    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      browser: getBrowserName(),
      collections,
      tabs,
    };

    const json = JSON.stringify(data, null, 2);
    const dataUrl = 'data:application/json;base64,' + btoa(unescape(encodeURIComponent(json)));

    // Date-stamped filename -> one file per day, building a rolling history
    // automatically (same-day runs overwrite). saveAs:false keeps it silent; if
    // the browser still prompts, turn off "Ask where to save each file before
    // downloading" in browser settings.
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    chrome.downloads.download({
      url: dataUrl,
      filename: `TabHoarder/tab-hoarder-backup-${getBrowserName()}-${date}.json`,
      conflictAction: 'overwrite',
      saveAs: false,
    });
  } catch (err) {
    console.error('Tab Hoarder: backup failed', err);
  }
}

// Set up daily backup alarm
chrome.runtime.onInstalled.addListener(async () => {
  const settings = await chrome.storage.local.get('tab-hoarder-backup-interval');
  const minutes = parseInt(settings['tab-hoarder-backup-interval']) || 1440;
  chrome.alarms.create('daily-backup', { periodInMinutes: minutes });
  runBackup();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'daily-backup') {
    runBackup();
  }
});

// Update alarm when backup interval setting changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes['tab-hoarder-backup-interval']) {
    const minutes = parseInt(changes['tab-hoarder-backup-interval'].newValue) || 1440;
    chrome.alarms.create('daily-backup', { periodInMinutes: minutes });
  }
});

// Message handler for the newtab page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_CURRENT_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse({ tab: tabs[0] || null });
    });
    return true;
  }

  if (message.type === 'GET_ALL_TABS') {
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      sendResponse({ tabs });
    });
    return true;
  }
});
