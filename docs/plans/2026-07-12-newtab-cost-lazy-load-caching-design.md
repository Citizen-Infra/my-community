# New-tab-open cost: lazy-load + caching (Slice 1 of #32)

**Issue:** Citizen-Infra/my-community#32
**Status:** Design, approved 2026-07-12
**Scope:** Slice 1 of 2. This slice = lazy-load by active tab (part A) + cache the uncached stores (part B). Shared service-worker polling (part C) is deferred to Slice 2 (its own issue/PR) because it targets steady-state N-tab load rather than per-open cost and carries the MV3 service-worker-lifecycle risk.

## Goal

Cut the per-new-tab-open request cost. A cold open currently fires ~15-20 requests across 6 backends; a warm reopen still fires ~14-15 because only 2 of ~9 network stores cache. Target: cold open fetches only the active tab's feed (plus the consent badge and jam strip); warm reopen served almost entirely from cache.

## Background (verified from the boot trace)

- `app.jsx`'s mount effects call every `load*` regardless of which dashboard tab is active. `Dashboard.jsx` only conditionally *renders* panels; the panels are presentational and do not fetch. So opening the default Digest tab still fetches Bluesky, Sessions, avails, and Community Input in the background.
- Dashboard tabs live in `store/panels.js`: `activeTab` signal (default `digest`), `visibleTabs` (`network` / `digest` / `participation` / `communityInput`). Jam is a global strip below the TopBar (its own `jamVisible` flag), not a tab.
- Tab -> feed mapping: `network` -> `bluesky.js` (`loadSavedFeeds` + `loadBlueskyFeed`); `digest` -> `digest.js`; `participation` -> `sessions.js` + `avails.js` (and the global jam strip); `communityInput` -> `proposals.js`.
- Only `digest.js` (1h TTL) and `bluesky.js` (5min) cache. `communities.js`, `sessions.js`, `jam.js`, `avails.js`, `proposals.js`, and the community-account calls have no cache.
- The consent-badge count (`TabBar.jsx:26`, `openUnvotedCount`) is a `computed` derived from the full `proposals` signal, so the badge only reflects pending decisions if `loadProposals` has run.

## Locked decisions

1. **Scope:** lazy-load + caching now; shared SW polling as a separate follow-up.
2. **Consent badge stays live on every open.** Keep `proposals` in the mount path (now cached with a short TTL so it is cheap) and lazy-load only the two heaviest tabs, Network and Participation. Rationale: the badge is a governance alert; a stale/absent count is misleading, and caching keeps the mount-path fetch cheap.
3. **Lazy-load mechanism = central tab->loaders registry** (not panel-owns-fetch, not scattered inline guards). Keeps loading orchestration where it already lives (`app.jsx`), smallest and lowest-risk change, and folds cleanly with the #33/#35 single-owner Bluesky-load fix.

## Architecture

### Load policy on a new-tab open

- **Always on mount:** `loadProposals` (consent badge) + the jam strip load. Both now cached.
- **Active tab only, on mount:** the loaders for whichever of `network` / `digest` / `participation` is the current `activeTab`. (If the active tab is `communityInput`, its loader is `loadProposals`, already covered by the always-on set.)
- **On `activeTab` change:** run the newly-active tab's loaders. The per-store cache short-circuits the network when fresh, so switching back to an already-visited tab costs nothing. No separate "already loaded" bookkeeping: the cache is the dedup.
- **On community-selection change:** every cache key is suffixed with the sorted selected-community-ID set, so loaders refetch for the new selection; non-active tabs refetch lazily on next visit.

### Tab -> loaders registry

A single map, defined in `app.jsx` (or a small `store/feeds.js` if it reads cleaner):

```
TAB_LOADERS = {
  network:       (ids) => { if (isConnected.value) { loadSavedFeeds(); loadBlueskyFeed(); } },
  digest:        (ids) => loadDigest(ids),
  participation: (ids) => { loadSessions(selectedCommunities.value); loadAvailsPolls(ids); },
  communityInput:(ids) => loadProposals(caSignedIn.value ? ids : []),
}
```

Mount and `activeTab`-change effects call `TAB_LOADERS[activeTab.value]?.(ids)`. The always-on set (`loadProposals` for the badge + jam) runs on mount independently of `activeTab`. The existing connection-state effect that owns Bluesky loading is folded into the `network` entry, preserving the single-owner property from #33/#35: Bluesky loads only when the Network tab is active (and connected) or when the user switches to it while connected.

Note: in this slice jam still loads on mount (it is a global strip, not tab-gated) and keeps its per-tab poll; both the jam and avails polling loops move to the service worker in Slice 2.

### Caching (the warm-reopen win)

Extract the hand-rolled `digest` / `bluesky` cache into one helper, `lib/cache.js`:

```
getCached(key, ttlMs) -> value | null   // returns null on miss, stale, or parse error
setCached(key, value) -> void           // stores { value, timestamp }
communityKey(ids) -> string             // sorted, joined selected-community IDs, for key suffixing
```

Every cache key is `"<store>:<communityKey(ids)>[:<extra params>]"`. Adopt the helper in the uncached stores with these TTLs:

| Store | TTL | Notes |
|---|---|---|
| `communities` | 1h | changes rarely |
| `sessions` / events | 5min | |
| `avails` | 5min | matches its current poll interval |
| `jam` | 2min | matches its current poll interval |
| `proposals` | 90s | short, keeps the consent badge fresh |

On a cache miss/stale, the loader falls through to the live fetch and repopulates the cache (same shape as `bluesky.js` today).

**Community-account calls.** `caAuth.js` *already* caches the 15-min `/auth/token` JWT (`getToken()`), but in module-level in-memory variables (`_jwt` / `_jwtExp`) that reset on every fresh new-tab page. So the JWT is reused *within* a page but re-fetched on *every* open. Fix: persist `_jwt` / `_jwtExp` (e.g. `mc_ca_jwt` in localStorage) so a fresh page reads the still-valid JWT before calling `/auth/token`. Separately, `initCaAuth()` calls `/auth/me` on every mount to resolve identity; cache the resolved `{ subject, type }` (short TTL, alongside the existing `mc_ca_bluesky_handle`) so a warm reopen skips `/auth/me`, refreshing it in the background so a server-side revocation still self-corrects (401 -> `signOut`). Note: `proposals` and community-admin's own endpoints use the session token directly (`caSessionHeader()`, synchronous, no network), so they need no JWT change.

Optionally retrofit `digest.js` and `bluesky.js` onto the same helper so there is one cache pattern in the codebase (low-risk; keeps `bluesky`'s existing multi-field param key).

## Components / files touched

- `src/app.jsx` — replace the three feed-loading effects with the always-on mount set + a registry-driven active-tab loader; add an effect on `activeTab`.
- `src/store/panels.js` — no change expected (already exposes `activeTab` / `setActiveTab`).
- `src/lib/cache.js` — new cache helper.
- `src/store/communities.js`, `sessions.js`, `avails.js`, `jam.js`, `proposals.js` — adopt `getCached`/`setCached`, keyed by community set.
- `src/store/caAuth.js` — persist the `/auth/token` JWT (`_jwt`/`_jwtExp`) across page loads; cache the `/auth/me` identity with a short TTL + background refresh.
- (optional) `src/store/digest.js`, `bluesky.js` — retrofit onto the helper.

## Error handling

Unchanged. Every `load*` already try/catches and degrades to an empty feed. A cache miss or JSON parse error returns `null` from `getCached` and falls through to a live fetch, mirroring `bluesky.js`'s existing `try { ... } catch {}` around its cache read.

## Testing / verification

This repo has no test framework, and the payoff is a request count, which is not unit-testable without a browser. Verification for this slice:

1. Production build passes (`npm run build`).
2. Manual instrumented load: a temporary `fetch` counter (or the browser Network panel) confirms a cold open drops from ~15 to ~4-5 requests, and a warm reopen (seconds later) to ~1-2.
3. Behavior spot-checks: the consent badge still shows the correct unvoted count on a cold open; the jam strip still appears when rooms exist; switching to Network / Participation loads their feeds on first visit and is instant on return; connecting Bluesky still loads the feed once (no #33/#35 regression); changing the community selection refetches.

Standing up a test harness (e.g. vitest + a mockable fetch layer) is out of scope for this slice unless explicitly requested.

## Success criteria

- Cold open fetches only the active tab's feed + `proposals` (badge) + jam; the two heaviest background loads (Bluesky, Participation) are deferred until their tab is visited.
- Warm reopen is served almost entirely from cache (~1-2 requests).
- No behavior change to the consent badge, the jam strip, the connect flow, or community switching.

## Out of scope (Slice 2, follow-up)

Shared service-worker polling: move `jam` + `avails` polling out of per-tab `setInterval` into a single `chrome.alarms` loop in `background.js`, fetching in the SW and broadcasting results to open new-tab pages via `chrome.runtime.sendMessage` (the SW already uses `chrome.alarms` for daily-backup and message-broadcasts `DATA_CHANGED`). Turns 2N polling loops across N tabs into 2.
