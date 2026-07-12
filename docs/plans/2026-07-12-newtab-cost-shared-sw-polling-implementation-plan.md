# New-tab-open cost: shared service-worker polling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace per-tab jam + avails `setInterval` polling with a single shared loop in the service worker, so N open tabs share one poll (or zero when no MC tab is open).

**Architecture:** Two `chrome.alarms` in `background.js` poll jam + avails, gated to when ≥1 new-tab page is open and communities are selected, writing results to `chrome.storage.local`. The page mirrors its selected communities to `chrome.storage.local` for the SW to read, and consumes results via `chrome.storage.onChanged` (dropping both `setInterval`s).

**Tech Stack:** Preact + @preact/signals, Vite MV3 Chrome extension, `chrome.alarms` / `chrome.storage` / `chrome.tabs`.

**Spec:** `docs/plans/2026-07-12-newtab-cost-shared-sw-polling-design.md`

## Global Constraints

- **No test framework** (see #37). Verify by: `npm run build` for bundled `src/`; `node --check public/background.js` for the service worker (the build only *copies* `public/`, it does not transpile or syntax-check it — a syntax error there would ship silently); and a final manual service-worker inspection (Task 4).
- **Build command:** from `extension/`, `npm run build`. On Windows via PowerShell.
- **No new manifest permissions** — `alarms`, `storage`, `tabs`, and host permissions for `navidrome-jam-production.up.railway.app` + `avails.zhgnv.com` are all already present.
- **`background.js` is plain, un-bundled vanilla JS** — it cannot `import` the store modules or `lib/cache.js`. Re-implement the fetch + dedup inline.
- **chrome.storage.local contract:** page writes `mc_selected_communities` (`string[]`); SW writes `mc_jam_rooms` (`{ rooms, timestamp }`) and `mc_avails_polls` (`{ polls, timestamp }`).
- **No visible UI change** — the jam strip (`JamBanner`) and avails banners (`SessionsPanel`) read the `jamRooms` / `availsPolls` signals exactly as today.
- **Branch:** create `perf/newtab-cost-shared-sw-polling` before Task 1; commit per task; one PR at the end (closes #32). AI attribution in commit trailers only.

## File Structure

- `extension/public/background.js` — MODIFY: add the shared jam+avails poller (alarms, audience+stale gates, vanilla fetch+dedup, `chrome.storage` write) and its three triggers.
- `extension/src/store/communities.js` — MODIFY: mirror `selectedCommunityIds` to `chrome.storage.local`.
- `extension/src/store/jam.js` — MODIFY: drop the `setInterval`; become a `chrome.storage` consumer.
- `extension/src/store/avails.js` — MODIFY: same as jam.
- `extension/src/app.jsx` — MODIFY: drop `start*/stop*Polling`; init the feed consumers, seed the mirror, and trigger a poll-if-stale on open.

---

### Task 1: Service-worker shared poller (`background.js`)

**Files:**
- Modify: `extension/public/background.js`

**Interfaces:**
- Produces (SW behavior): writes `chrome.storage.local.mc_jam_rooms` = `{ rooms, timestamp }` and `mc_avails_polls` = `{ polls, timestamp }`; reads `mc_selected_communities`. Responds to a `{ type: 'FEEDS_POLL_IF_STALE' }` runtime message.

- [ ] **Step 1: Add the poller block**

In `extension/public/background.js`, add this block near the top (after the existing `openDB` helper is fine — anywhere at module scope):

```js
// --- Shared feed polling: jam + avails, one loop for all open tabs (#32 slice 2) ---
const NEWTAB_URL = chrome.runtime.getURL('src/newtab.html');
const FEEDS = {
  jam: {
    api: 'https://navidrome-jam-production.up.railway.app/api/rooms',
    query: '', storeKey: 'mc_jam_rooms', outKey: 'rooms',
    intervalMs: 2 * 60 * 1000, dedup: (r) => r.id,
  },
  avails: {
    api: 'https://avails.zhgnv.com/api/polls',
    query: '&status=open', storeKey: 'mc_avails_polls', outKey: 'polls',
    intervalMs: 5 * 60 * 1000, dedup: (p) => `${p.did}/${p.rkey}`,
  },
};

async function anyNewtabOpen() {
  const tabs = await chrome.tabs.query({});
  return tabs.some((t) => (t.url || t.pendingUrl || '').startsWith(NEWTAB_URL));
}

async function pollFeed(name, { ifStale }) {
  const cfg = FEEDS[name];
  if (!cfg) return;
  if (!(await anyNewtabOpen())) return;                       // no audience -> don't poll
  const stored = await chrome.storage.local.get(['mc_selected_communities', cfg.storeKey]);
  const ids = stored.mc_selected_communities || [];
  if (ids.length === 0) return;                               // nothing selected
  if (ifStale) {
    const cached = stored[cfg.storeKey];
    if (cached && Date.now() - cached.timestamp < cfg.intervalMs) return; // still fresh
  }
  try {
    const results = await Promise.all(ids.map((id) =>
      fetch(`${cfg.api}?community=${encodeURIComponent(id)}${cfg.query}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
    ));
    const seen = new Set();
    const items = [];
    for (const result of results) {
      for (const item of (result?.[cfg.outKey] || [])) {
        const k = cfg.dedup(item);
        if (!seen.has(k)) { seen.add(k); items.push(item); }
      }
    }
    await chrome.storage.local.set({ [cfg.storeKey]: { [cfg.outKey]: items, timestamp: Date.now() } });
  } catch (err) {
    console.error(`Feed poll failed (${name}):`, err); // keep the last cached value
  }
}

function pollAllFeeds(opts) {
  pollFeed('jam', opts);
  pollFeed('avails', opts);
}
```

- [ ] **Step 2: Create the two alarms on install**

In the existing `chrome.runtime.onInstalled.addListener(async () => { ... })` (which creates `daily-backup`), add after the `daily-backup` alarm creation:

```js
  chrome.alarms.create('feed-poll-jam', { periodInMinutes: 2 });
  chrome.alarms.create('feed-poll-avails', { periodInMinutes: 5 });
```

- [ ] **Step 3: Handle the alarms**

In the existing `chrome.alarms.onAlarm.addListener((alarm) => { ... })`, add:

```js
  if (alarm.name === 'feed-poll-jam') pollFeed('jam', { ifStale: true });
  if (alarm.name === 'feed-poll-avails') pollFeed('avails', { ifStale: true });
```

- [ ] **Step 4: Poll fresh when the community selection changes**

In the existing `chrome.storage.onChanged.addListener((changes, area) => { ... })`, add (compare old/new so an identical re-write of the seed does not trigger a poll):

```js
  if (area === 'local' && changes.mc_selected_communities) {
    const { oldValue, newValue } = changes.mc_selected_communities;
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) pollAllFeeds({ ifStale: false });
  }
```

- [ ] **Step 5: Handle the page's poll-if-stale nudge**

In the existing `chrome.runtime.onMessage.addListener((message, sender, sendResponse) => { ... })`, add (before the final `}`):

```js
  if (message.type === 'FEEDS_POLL_IF_STALE') {
    pollAllFeeds({ ifStale: true });
    return; // no response
  }
```

- [ ] **Step 6: Syntax-check and build**

Run (from `extension/`): `node --check public/background.js` (expect no output, exit 0), then `npm run build` (expect `built in ...`).

- [ ] **Step 7: Commit**

```bash
git add extension/public/background.js
git commit -m "feat(sw): shared jam+avails polling in the service worker (#32)"
```

---

### Task 2: Mirror selected communities to chrome.storage (`communities.js`)

**Files:**
- Modify: `extension/src/store/communities.js`

**Interfaces:**
- Produces: `mirrorSelectedCommunities()` — writes `selectedCommunityIds.value` to `chrome.storage.local.mc_selected_communities`. Called on boot (seed) and on every `toggleCommunity`.

- [ ] **Step 1: Add the mirror**

In `extension/src/store/communities.js`, add this exported function (e.g. below `toggleCommunity`):

```js
// Mirror the selected community IDs to chrome.storage.local so the service
// worker (which cannot read localStorage) can poll jam/avails for them.
export function mirrorSelectedCommunities() {
  chrome.storage?.local?.set({ mc_selected_communities: selectedCommunityIds.value });
}
```

Then call it inside `toggleCommunity`, right after the existing `localStorage.setItem('mc_communities', JSON.stringify(next));`:

```js
  selectedCommunityIds.value = next;
  localStorage.setItem('mc_communities', JSON.stringify(next));
  mirrorSelectedCommunities();
```

- [ ] **Step 2: Build**

Run (from `extension/`): `npm run build`
Expected: `built in ...` with no errors.

- [ ] **Step 3: Commit**

```bash
git add extension/src/store/communities.js
git commit -m "feat(communities): mirror selection to chrome.storage for the SW (#32)"
```

---

### Task 3: Page cutover — jam + avails become SW consumers (`jam.js`, `avails.js`, `app.jsx`)

This is one atomic task: the store rewrites remove exports that `app.jsx` imports, so all three files must change together for a working build.

**Files:**
- Modify: `extension/src/store/jam.js`
- Modify: `extension/src/store/avails.js`
- Modify: `extension/src/app.jsx`

**Interfaces:**
- Consumes: `mirrorSelectedCommunities` from `./store/communities`.
- Produces: `initJamFeed()` (jam.js), `initAvailsFeed()` (avails.js) — read the SW's cached results into the `jamRooms` / `availsPolls` signal and subscribe to `chrome.storage.onChanged` for live updates. `startJamPolling` / `stopJamPolling` / `loadJamRooms` / `startAvailsPolling` / `stopAvailsPolling` / `loadAvailsPolls` are removed.

- [ ] **Step 1: Rewrite `jam.js` as a consumer**

Replace the entire contents of `extension/src/store/jam.js` with:

```js
import { signal } from '@preact/signals';

export const jamRooms = signal([]);

const STORE_KEY = 'mc_jam_rooms';

// The service worker owns jam polling (one shared loop for all tabs, #32 slice 2).
// The page reflects the SW's chrome.storage cache into the signal and updates
// live whenever the SW writes a fresh poll.
export function initJamFeed() {
  chrome.storage?.local?.get(STORE_KEY, (s) => {
    const cached = s?.[STORE_KEY];
    if (cached?.rooms) jamRooms.value = cached.rooms;
  });
  chrome.storage?.onChanged?.addListener((changes, area) => {
    if (area === 'local' && changes[STORE_KEY]) {
      jamRooms.value = changes[STORE_KEY].newValue?.rooms || [];
    }
  });
}
```

- [ ] **Step 2: Rewrite `avails.js` as a consumer**

Replace the entire contents of `extension/src/store/avails.js` with:

```js
import { signal } from '@preact/signals';

export const availsPolls = signal([]);

const STORE_KEY = 'mc_avails_polls';

// The service worker owns avails polling (one shared loop for all tabs, #32
// slice 2). The page reflects the SW's chrome.storage cache into the signal.
export function initAvailsFeed() {
  chrome.storage?.local?.get(STORE_KEY, (s) => {
    const cached = s?.[STORE_KEY];
    if (cached?.polls) availsPolls.value = cached.polls;
  });
  chrome.storage?.onChanged?.addListener((changes, area) => {
    if (area === 'local' && changes[STORE_KEY]) {
      availsPolls.value = changes[STORE_KEY].newValue?.polls || [];
    }
  });
}
```

- [ ] **Step 3: Update `app.jsx` imports**

In `extension/src/app.jsx`, change the jam and avails imports from:

```js
import { startJamPolling, stopJamPolling } from './store/jam';
import { startAvailsPolling, stopAvailsPolling } from './store/avails';
```

to:

```js
import { initJamFeed } from './store/jam';
import { initAvailsFeed } from './store/avails';
```

And add `mirrorSelectedCommunities` to the existing communities import:

```js
import { loadCommunities, selectedCommunityIds, selectedCommunities, mirrorSelectedCommunities } from './store/communities';
```

- [ ] **Step 4: Wire the feed consumers into boot**

In the boot IIFE in `app.jsx`, immediately before `setReady(true);`, add:

```js
      // Jam + avails are served by the shared service-worker poll (#32 slice 2):
      // reflect its cache into the signals, seed the community mirror, and nudge
      // the SW to refresh if its cache is stale.
      initJamFeed();
      initAvailsFeed();
      mirrorSelectedCommunities();
      chrome.runtime?.sendMessage?.({ type: 'FEEDS_POLL_IF_STALE' }).catch(() => {});
      setReady(true);
```

- [ ] **Step 5: Remove jam from the always-on effect**

Replace the always-on effect (the one that loads `proposals` and starts jam polling) with the proposals-only version:

```js
  // The consent badge (proposals) loads on mount and on community / sign-in
  // change so the Community Input badge is live on every open. Jam is now
  // served by the shared service-worker poll (see initJamFeed).
  useEffect(() => {
    if (!ready) return;
    loadProposals(caSignedIn.value ? selectedCommunityIds.value : []);
  }, [ready, caSignedIn.value, selectedCommunityIds.value]);
```

- [ ] **Step 6: Delete the participation-scoped avails effect**

Delete the entire effect that calls `startAvailsPolling` / `stopAvailsPolling` (the one with the `// avails polling is scoped to the Participation tab` comment). Avails is now SW-driven, so nothing replaces it.

- [ ] **Step 7: Build and confirm the old polling is gone**

Run (from `extension/`): `npm run build` (expect `built in ...`), then confirm no references remain:

Run: `grep -rn "startJamPolling\|stopJamPolling\|startAvailsPolling\|stopAvailsPolling\|loadJamRooms\|loadAvailsPolls" extension/src`
Expected: no matches.

- [ ] **Step 8: Commit**

```bash
git add extension/src/store/jam.js extension/src/store/avails.js extension/src/app.jsx
git commit -m "perf(app): consume SW-polled jam+avails, drop per-tab intervals (#32)"
```

---

### Task 4: End-to-end verification (MANUAL — human, not a subagent)

**Files:** none.

- [ ] **Step 1: Build + load**

Run (from `extension/`): `npm run build`, then reload the unpacked extension at `chrome://extensions` (Load unpacked -> `extension/dist/`).

- [ ] **Step 2: One shared poll regardless of tab count**

Open 3+ new tabs. In `chrome://extensions`, click the extension's **service worker** link to open its DevTools; watch the Network tab. Confirm exactly one `api/rooms` request per ~2min and one `api/polls` per ~5min **total** (not per tab). Confirm the jam strip and avails banners still render/update in every tab.

- [ ] **Step 3: No audience -> no poll**

Close all MC tabs (open a non-extension page). Confirm the service worker stops issuing `api/rooms` / `api/polls` requests.

- [ ] **Step 4: Community change refetches**

With a tab open, toggle a community in Settings. Confirm the SW fires a fresh jam + avails poll and the strip/banners update.

- [ ] **Step 5: Warm-reopen count**

Optionally re-run the slice-1 request counter: warm reopen should now be ~1-2 (the jam fetch is a `chrome.storage` read, not a network call).

- [ ] **Step 6: Open the PR (closes #32)**

```bash
git push -u origin perf/newtab-cost-shared-sw-polling
gh pr create --repo Citizen-Infra/my-community --base master \
  --title "perf: shared service-worker polling for jam+avails (#32, slice 2)" \
  --body-file <pr-body>   # note "Closes #32"
```

## Self-Review

- **Spec coverage:** two alarms + audience gate + poll-if-stale -> Task 1; community mirror -> Task 2; page drops setInterval and consumes via `chrome.storage.onChanged` -> Task 3; `FEEDS_POLL_IF_STALE` on open + seed -> Task 3 Step 4; identical-seed guard -> Task 1 Step 4 (old/new compare). Covered.
- **Type consistency:** SW writes `{ rooms, timestamp }` / `{ polls, timestamp }` under `mc_jam_rooms` / `mc_avails_polls`; consumers read `.rooms` / `.polls` from the same keys. `mirrorSelectedCommunities` writes `mc_selected_communities`; the SW reads the same key. Message type `FEEDS_POLL_IF_STALE` matches on both sides.
- **Un-bundled SW:** `background.js` uses only `chrome.*`, `fetch`, and plain JS — no imports. `node --check` gates its syntax (Task 1 Step 6), since the build won't.
- **No orphaned imports:** Task 3 Step 7 greps that every removed export (`start*/stop*Polling`, `load*`) has no remaining caller.
