# New-tab-open cost: shared service-worker polling (Slice 2 of #32)

**Issue:** Citizen-Infra/my-community#32
**Status:** Design, approved 2026-07-12
**Builds on:** Slice 1 (lazy-load + caching, PR #38, merged). This slice completes #32.

## Goal

Collapse per-tab jam + avails polling into a single shared loop in the service worker. Today each open new-tab page runs its own `setInterval` for jam (2min) and avails (5min), so N open tabs = 2N concurrent polling loops. MC replaces the new-tab page, so a user routinely has many tabs open — this is a real steady-state load. Target: N tabs share one poll (or zero when no MC tab is open), and the slice-1 warm-reopen residual (the always-on jam fetch) drops as jam is served from cache on open.

## Background (verified)

- `public/background.js` is plain, un-bundled vanilla JS (copied as-is; it hand-rolls IndexedDB "no build deps"). It already uses `chrome.alarms` (daily-backup), `chrome.storage.onChanged`, `chrome.tabs.onUpdated`, and `chrome.runtime` messaging. **A service worker cannot import the store modules or `lib/cache.js`, and cannot read the page's `localStorage`.**
- `store/jam.js`: `jamRooms` signal; `loadJamRooms(ids)` fetches `navidrome-jam .../api/rooms?community=<id>` per community and dedups by `room.id`; `startJamPolling`/`stopJamPolling` run a 2min `setInterval`. Unauthenticated GET.
- `store/avails.js`: `availsPolls` signal; `loadAvailsPolls(ids)` fetches `avails.zhgnv.com/api/polls?community=<id>&status=open` per community and dedups by `did/rkey`; 5min `setInterval`. Unauthenticated GET.
- `store/communities.js`: `selectedCommunityIds` signal, persisted to `localStorage.mc_communities`; `toggleCommunity` mutates it.
- `app.jsx`: the always-on effect calls `startJamPolling`; the Participation-scoped effect calls `startAvailsPolling`/`stopAvailsPolling` (both added in slice 1).
- `manifest.json`: `permissions` include `alarms`, `storage`, `tabs`; `host_permissions` include both `navidrome-jam-production.up.railway.app/*` and `avails.zhgnv.com/*`; the new-tab override URL is `src/newtab.html`. **No new permissions needed.**

## Locked decisions

1. **Approach = service worker + `chrome.alarms`** (not leader-tab election; not per-tab caching). Rationale in the design doc; the SW is the idiomatic MV3 fix and MC's new-tab-per-tab nature makes the N-tab load real.
2. **`chrome.storage.onChanged` is the page-update channel** (no manual `sendMessage` broadcast needed): the SW writes results to `chrome.storage.local`, and every open page's `onChanged` fires automatically.
3. **Community IDs reach the SW via `chrome.storage.local`** (the SW can't read `localStorage`).

## Architecture

### chrome.storage.local keys (the SW/page contract)

| Key | Written by | Shape |
|---|---|---|
| `mc_selected_communities` | page | `string[]` — the selected community IDs |
| `mc_jam_rooms` | SW | `{ rooms: [...], timestamp }` |
| `mc_avails_polls` | SW | `{ polls: [...], timestamp }` |

### Service worker (`background.js`)

- **Two alarms:** `feed-poll-jam` (2min) and `feed-poll-avails` (5min), created on install (alongside the existing `daily-backup` alarm). Both above the 1-min `chrome.alarms` floor.
- **Poll-gating:** each alarm handler first checks (a) `chrome.tabs.query` finds ≥1 open new-tab page (`chrome-extension://<id>/src/newtab.html`), and (b) `mc_selected_communities` is non-empty. If either fails, skip — no audience or nothing to poll means no fetch.
- **Poll-if-stale:** a poll fetches only if the feed's cached `timestamp` is older than its interval; otherwise no-op. This dedups bursts (5 tabs opening triggers at most one fetch).
- **Fetch + dedup in vanilla JS:** the ~10-line per-community fetch + dedup from `jam.js`/`avails.js` is re-implemented in `background.js` (unavoidable — the SW isn't bundled). On success it writes `mc_jam_rooms` / `mc_avails_polls` (with `timestamp`); on failure it leaves the last cached value untouched.
- **Triggers:**
  - the two alarms (steady-state, for long-open tabs);
  - `chrome.storage.onChanged` on `mc_selected_communities` → poll both feeds fresh for the new set (if a tab is open);
  - a `chrome.runtime.onMessage` `{ type: 'FEEDS_POLL_IF_STALE' }` from a freshly-opened page.

### Page side

- `communities.js`: mirror `selectedCommunityIds` to `chrome.storage.local.mc_selected_communities` on every `toggleCommunity`, and **seed it once on load** so the SW has the set immediately after this ships.
- `jam.js` / `avails.js`: **drop the `setInterval`** (`startJamPolling` / `startAvailsPolling` / `stopJamPolling` / `stopAvailsPolling` go away). Add an init that (1) reads the cached `mc_jam_rooms` / `mc_avails_polls` from `chrome.storage.local` into the `jamRooms` / `availsPolls` signal (instant, no fetch), and (2) subscribes to `chrome.storage.onChanged` for that key to update the signal live when the SW polls. The `jamRooms` / `availsPolls` signals and their consumers (`JamBanner`, `SessionsPanel`) are unchanged.
- `app.jsx`: remove the `start*/stop*Polling` calls. On mount, call the jam/avails inits (cache read + subscribe) and send one `FEEDS_POLL_IF_STALE` message so a freshly-opened tab refreshes if the shared cache is stale. Community selection no longer drives polling directly — the `chrome.storage` mirror + the SW's `onChanged` handler do.

### Data flow

- **Tab open:** page reads `mc_jam_rooms`/`mc_avails_polls` from storage → signals render instantly; page sends `FEEDS_POLL_IF_STALE`; SW polls only if stale + writes storage → `onChanged` updates every open tab.
- **Community change:** page writes `mc_selected_communities` → SW's `onChanged` handler polls fresh → storage write → all tabs update.
- **Steady state (long-open tab):** alarms fire → SW polls (gated) → storage write → tabs update.
- **No MC tab open:** alarms fire → `tabs.query` finds none → skip. Zero polling.

## Error handling

SW fetch failure keeps the last cached `mc_jam_rooms` / `mc_avails_polls` (no clearing) and logs — same graceful degradation as the current per-tab loops. A page with no cached data yet shows an empty strip/banner until the first poll writes storage.

## Testing / verification

No test framework (see #37). Verification:

1. Production build passes (`npm run build`).
2. Manual: open several new-tab pages, then inspect the **service worker** in `chrome://extensions` (its own DevTools Network). Confirm exactly one jam request per 2min and one avails request per 5min **regardless of how many tabs are open**, and that closing all MC tabs stops the polling. Confirm the jam strip and avails banners still appear and update live in every open tab.
3. Request-count: a warm reopen should drop from slice-1's ~3 toward ~1-2 (the jam fetch is now a `chrome.storage` read, not a network call).

## Success criteria

- N open tabs share one jam poll and one avails poll (2 loops total, not 2N).
- No polling when no MC new-tab page is open.
- Jam strip + avails banners still render and update live.
- Warm reopen drops to ~1-2 requests.
- Closes #32.

## Out of scope

Nothing further — this completes #32. (`jam`/`avails` are now SW-owned, so the slice-1 decision to not localStorage-cache them still holds; their cache is the SW's `chrome.storage` entries.)
