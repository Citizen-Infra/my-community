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

// --- Suggest to the community wiki (Sub-project C) ---
// Submit the current page to a community's wiki_queue, where it surfaces as a
// knowledge card in the Community Input feed (Sub-project E) and gets voted toward
// the wiki. The worker can't read the page's localStorage, so it uses the CA session
// + community list the new-tab page mirrors into chrome.storage.local.
const CA_URL = 'https://community-admin-server-production.up.railway.app';

function flashBadge(text, color) {
  chrome.action.setBadgeBackgroundColor({ color });
  chrome.action.setBadgeText({ text });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 1800);
}

// The tooltip reflects what the toolbar button does, which depends on its target.
function applyToolbarTitle(target) {
  chrome.action.setTitle({
    title: target === 'wiki-queue' ? 'Suggest page to the community wiki' : 'Save & close tab',
  });
}

// Injected into the active page (runs in the PAGE context, so it must be
// self-contained). A brief top-right toast — the suggest action does not close
// the tab, so it needs visible confirmation. Colors carry meaning: green done,
// slate already-there, amber a setup step you still owe, red a real failure. A
// confirmation clears in 2s; the actionable amber/red messages linger longer so
// there is time to read and act. Announced to assistive tech via role/aria-live.
function pageToast(message, kind) {
  const id = '__mc_wiki_toast__';
  const prev = document.getElementById(id);
  if (prev) prev.remove();
  const el = document.createElement('div');
  el.id = id;
  el.textContent = message;
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', kind === 'error' ? 'assertive' : 'polite');
  // Darker-than-token shades so white text clears WCAG AA on each fill.
  const colors = { success: '#2d6a4f', info: '#3d6d8c', warn: '#b45309', error: '#b91c1c' };
  const bg = colors[kind] || colors.error;
  Object.assign(el.style, {
    position: 'fixed', top: '16px', right: '16px', zIndex: '2147483647',
    background: bg, color: '#ffffff', padding: '11px 16px', borderRadius: '10px',
    font: '600 14px/1.4 system-ui, -apple-system, sans-serif',
    boxShadow: '0 8px 28px rgba(0,0,0,0.28)', maxWidth: '340px',
    opacity: '0', transform: 'translateY(-8px)',
    transition: 'opacity .2s ease, transform .2s ease', pointerEvents: 'none',
  });
  document.documentElement.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; });
  const life = (kind === 'warn' || kind === 'error') ? 4000 : 2000;
  setTimeout(() => {
    el.style.opacity = '0'; el.style.transform = 'translateY(-8px)';
    setTimeout(() => el.remove(), 220);
  }, life);
}

// Show the toast in a tab. Best-effort: restricted pages (web store, pdf viewer,
// etc.) reject injection, and the badge still fired as a fallback.
async function showToast(tabId, message, kind) {
  if (tabId == null) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId }, func: pageToast, args: [message, kind] });
  } catch (err) {
    /* page disallows injection — badge covers it */
  }
}

// Which community a suggestion goes to: the member's explicit setting if it still
// matches a selected community, else the sole selected community, else none.
function resolveSuggestCommunity(communities, setting) {
  if (!communities || communities.length === 0) return null;
  if (setting && communities.some((c) => c.id === setting.id)) return setting;
  if (communities.length === 1) return communities[0];
  return null;
}

async function suggestToWiki(tab) {
  if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) return;
  const store = await chrome.storage.local.get(['mc_ca_session_bg', 'mc_communities_bg', 'mc_wiki_suggest_community']);
  const token = store['mc_ca_session_bg'];
  if (!token) {
    flashBadge('!', '#d97706');
    showToast(tab.id, 'Sign in to My Community to suggest sources.', 'warn');
    return;
  }
  const community = resolveSuggestCommunity(store['mc_communities_bg'], store['mc_wiki_suggest_community']);
  if (!community) {
    flashBadge('?', '#d97706');
    showToast(tab.id, 'Pick a target community in Settings first.', 'warn');
    return;
  }
  try {
    const res = await fetch(`${CA_URL}/communities/${community.id}/wiki/queue`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: tab.url, title: tab.title || null, source: 'browser' }),
    });
    if (res.status === 201) {
      flashBadge('✓', '#3d8c40');
      showToast(tab.id, `Suggested to ${community.name}.`, 'success');
    } else if (res.status === 409) {
      flashBadge('=', '#457b9d');
      showToast(tab.id, `Already in ${community.name}'s wiki queue.`, 'info');
    } else if (res.status === 403) {
      flashBadge('✗', '#dc2626');
      showToast(tab.id, `You're not a member of ${community.name}.`, 'error');
    } else {
      flashBadge('✗', '#dc2626');
      showToast(tab.id, 'Could not suggest this page. Try again.', 'error');
    }
    // Nudge an open new-tab feed to refresh so the source appears.
    chrome.runtime.sendMessage({ type: 'WIKI_QUEUE_CHANGED' }).catch(() => {});
  } catch (err) {
    console.error('Suggest to wiki failed', err);
    flashBadge('✗', '#dc2626');
    showToast(tab.id, `Couldn't reach ${community.name} right now. Try again.`, 'error');
  }
}

// Toolbar icon click: suggest to the wiki when that is the chosen target, otherwise
// save based on setting (default: "Saved Tabs").
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) return;
  try {
    const settings = await chrome.storage.local.get('tab-hoarder-toolbar-target');
    const target = settings['tab-hoarder-toolbar-target'] || 'saved-tabs';
    if (target === 'wiki-queue') { await suggestToWiki(tab); return; }
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

// Keyboard shortcuts. Alt+S (save-to-recent) saves to a collection; the dedicated
// suggest-to-wiki shortcut always suggests the current page, regardless of the
// toolbar target setting.
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'suggest-to-wiki') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await suggestToWiki(tab);
    return;
  }
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

// Sync the toolbar tooltip with what the button currently does, on worker start.
chrome.storage.local.get('tab-hoarder-toolbar-target').then((s) => {
  applyToolbarTitle(s['tab-hoarder-toolbar-target'] || 'saved-tabs');
});

// React to setting changes: backup interval -> reschedule; toolbar target -> retitle.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes['tab-hoarder-backup-interval']) {
    const minutes = parseInt(changes['tab-hoarder-backup-interval'].newValue) || 1440;
    chrome.alarms.create('daily-backup', { periodInMinutes: minutes });
  }
  if (changes['tab-hoarder-toolbar-target']) {
    applyToolbarTitle(changes['tab-hoarder-toolbar-target'].newValue || 'saved-tabs');
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

// --- Community Admin sign-in redirect catch (IdP S3) ---
// After magic-link verify, community-admin redirects an extension login to
// /auth/extension-callback#session=<token>. Chrome blocks external→extension
// redirects, so catch the callback here, stash the session token, and navigate
// the tab back to the dashboard. Mirrors the dear-neighbors auth redirect-stash.
const CA_CALLBACK_HOST = 'community-admin-server-production.up.railway.app';
const CA_CALLBACK_PATH = '/auth/extension-callback';
const CA_STASH_KEY = 'mc_ca_auth_redirect';

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!changeInfo.url) return;
  let url;
  try { url = new URL(changeInfo.url); } catch { return; }
  if (url.hostname !== CA_CALLBACK_HOST || url.pathname !== CA_CALLBACK_PATH) return;
  const m = url.hash.match(/session=([^&]+)/);
  if (!m) return;
  chrome.storage.local.set({ [CA_STASH_KEY]: decodeURIComponent(m[1]) }, () => {
    chrome.tabs.update(tabId, { url: chrome.runtime.getURL('src/newtab.html') });
  });
});
