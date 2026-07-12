# New-tab-open cost: lazy-load + caching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut the per-new-tab-open request cost by loading only the active dashboard tab's feed on open and serving warm reopens from cache.

**Architecture:** A central "active tab -> loaders" effect in `app.jsx` fetches only the visible tab's feed (Network / Digest / Participation) on mount and on tab switch; the consent badge (`proposals`) and the global jam strip stay always-on. A small `lib/cache.js` helper adds short-TTL localStorage caching (matching the existing `digest.js` / `bluesky.js` shape) to the non-polling stores, and the community-account JWT is persisted across page loads. Shared service-worker polling is a separate follow-up (Slice 2).

**Tech Stack:** Preact + @preact/signals, Vite MV3 Chrome extension, localStorage.

**Spec:** `docs/plans/2026-07-12-newtab-cost-lazy-load-caching-design.md`

## Refinements to the spec (decided during planning)

1. **Do NOT cache the polling stores (`jam`, `avails`) in this slice.** A short TTL fights a 2-5min poll, and Slice 2 moves both into the service worker, so caching them now is throwaway. Slice 1 caches only the non-polling stores: `communities`, `sessions`, `proposals` (+ the auth calls). Lazy-load still scopes `avails` to the Participation tab; `jam` stays the always-on global strip.
2. **`castVote` invalidates the proposals cache.** It patches `proposals.value` in place, so a cached copy would be stale after a vote; clear the key so the next open refetches.
3. **`digest.js` / `bluesky.js` are left as-is** (they already cache with the same shape). Unifying them onto `lib/cache.js` is a later cleanup, out of scope here (YAGNI).

## Global Constraints

- **No test framework in this repo** ("No linting or test framework configured"). Verification is: the one-off `node` test for the pure cache helper (Task 1), `npm run build` passing for every code task, and a final manual instrumented request-count check (Task 7). Do NOT add vitest or any test runner.
- **Build command:** from `extension/`, `npm run build`. On Windows run it via PowerShell (Git Bash can fork-exhaust on long sessions); on Linux/macOS run it directly.
- **Preserve the #33/#35 single-owner property:** `loadBlueskyFeed()` and `loadSavedFeeds()` must be called from exactly ONE place — the active-tab effect's `network` branch. No other effect or component may call them on mount/connect.
- **Cache shape:** one localStorage key per store, value `{ value, selector, timestamp }`, matching `digest.js`. All keys prefixed `mc_`.
- **Community-scoped cache keys** use `communityKey(ids)` (sorted, order-independent) as the `selector`.
- **No visible UI change** in this slice (load behavior only); DESIGN.md / impeccable is not triggered.
- **Branch:** create `perf/newtab-cost-lazy-load-caching` before Task 1; commit per task; open one PR at the end. Commit-message trailers only for AI attribution (`Co-Authored-By` + `Claude-Session`); never in the PR body.

## File Structure

- `extension/src/lib/cache.js` — NEW. Pure TTL localStorage cache: `getCached` / `setCached` / `clearCached` / `communityKey`. One responsibility: cache read/write with expiry + selector.
- `extension/scripts/cache.test.mjs` — NEW. One-off node test for `lib/cache.js`.
- `extension/src/store/communities.js` — MODIFY `loadCommunities` to read/write cache (global list, 1h).
- `extension/src/store/sessions.js` — MODIFY `loadSessions` to read/write cache (community-keyed, 5min).
- `extension/src/store/proposals.js` — MODIFY `loadProposals` to read/write cache (community-keyed, 90s); `castVote` to invalidate it.
- `extension/src/store/caAuth.js` — MODIFY to persist the `/auth/token` JWT across page loads and cache the `/auth/me` identity.
- `extension/src/app.jsx` — MODIFY: replace the three feed-loading effects with an always-on effect (proposals + jam), a lazy active-tab effect, and a Participation-scoped avails effect.

---

### Task 1: `lib/cache.js` cache helper

**Files:**
- Create: `extension/src/lib/cache.js`
- Test: `extension/scripts/cache.test.mjs`

**Interfaces:**
- Produces:
  - `getCached(key: string, ttlMs: number, selector = ''): any | null` — returns the cached value if present, within TTL, and `selector` matches; else `null` (also `null` on corrupt JSON).
  - `setCached(key: string, value: any, selector = ''): void` — stores `{ value, selector, timestamp: Date.now() }`.
  - `clearCached(key: string): void` — removes the key.
  - `communityKey(ids: string[]): string` — sorted, comma-joined, non-mutating.

- [ ] **Step 1: Write the failing test**

Create `extension/scripts/cache.test.mjs`:

```js
// One-off test (no framework in this repo). Run: node scripts/cache.test.mjs
// Shims localStorage so the pure cache helper runs under node (package.json type:module).
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { getCached, setCached, clearCached, communityKey } = await import('../src/lib/cache.js');

let failures = 0;
const assert = (cond, msg) => {
  if (cond) console.log('ok:', msg);
  else { console.error('FAIL:', msg); failures++; }
};

assert(getCached('k', 1000) === null, 'miss returns null');

setCached('k', { a: 1 });
assert(JSON.stringify(getCached('k', 1000)) === JSON.stringify({ a: 1 }), 'fresh get returns value');

setCached('k2', 42);
assert(getCached('k2', -1) === null, 'expired (age >= ttl) returns null');

setCached('k3', 'x', 'cibc');
assert(getCached('k3', 1000, 'scenius') === null, 'selector mismatch returns null');
assert(getCached('k3', 1000, 'cibc') === 'x', 'selector match returns value');

setCached('k4', 1);
clearCached('k4');
assert(getCached('k4', 1000) === null, 'clearCached removes the entry');

const ids = ['b', 'a'];
assert(communityKey(ids) === 'a,b', 'communityKey sorts');
assert(ids[0] === 'b', 'communityKey does not mutate input');

globalThis.localStorage.setItem('k5', '{not json');
assert(getCached('k5', 1000) === null, 'corrupt JSON returns null');

console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `extension/`): `node scripts/cache.test.mjs`
Expected: FAIL — `Cannot find module .../src/lib/cache.js` (the helper does not exist yet).

- [ ] **Step 3: Write the helper**

Create `extension/src/lib/cache.js`:

```js
// Tiny localStorage cache with TTL. Matches the shape digest.js / bluesky.js
// already use: one storage key per store, an optional `selector` (e.g. the
// selected-community set) compared on read, and a timestamp for TTL expiry.

export function getCached(key, ttlMs, selector = '') {
  try {
    const c = JSON.parse(localStorage.getItem(key) || 'null');
    if (c && Date.now() - c.timestamp < ttlMs && (c.selector ?? '') === selector) {
      return c.value;
    }
  } catch {}
  return null;
}

export function setCached(key, value, selector = '') {
  try {
    localStorage.setItem(key, JSON.stringify({ value, selector, timestamp: Date.now() }));
  } catch {}
}

export function clearCached(key) {
  try { localStorage.removeItem(key); } catch {}
}

// Stable, order-independent selector for a set of selected communities.
export function communityKey(ids) {
  return [...ids].sort().join(',');
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run (from `extension/`): `node scripts/cache.test.mjs`
Expected: every line `ok:` then `ALL PASSED`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add extension/src/lib/cache.js extension/scripts/cache.test.mjs
git commit -m "feat(cache): add lib/cache.js TTL localStorage helper (#32)"
```

---

### Task 2: Cache the community list (`communities.js`)

**Files:**
- Modify: `extension/src/store/communities.js`

**Interfaces:**
- Consumes: `getCached`, `setCached` from `../lib/cache`.
- Produces: `loadCommunities()` unchanged signature; now returns cached `allCommunities` when fresh.

- [ ] **Step 1: Add the cache to `loadCommunities`**

In `extension/src/store/communities.js`, add the import at the top (after the existing `authHeader` import):

```js
import { getCached, setCached } from '../lib/cache';
```

Add cache constants below the `GROUPS_API` const:

```js
const CACHE_KEY = 'mc_communities_cache';
const CACHE_TTL = 60 * 60 * 1000; // 1h — the community list changes rarely
```

Replace the whole `loadCommunities` function with:

```js
export async function loadCommunities() {
  const cached = getCached(CACHE_KEY, CACHE_TTL);
  if (cached) {
    allCommunities.value = cached;
    communitiesStatus.value = 'ready';
    return;
  }
  communitiesStatus.value = 'loading';
  try {
    const res = await fetch(GROUPS_API, { headers: await authHeader() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    // Transform { scenius: { name: ... }, cibc: { name: ... } } → array
    const groups = Object.entries(data.groups || data).map(([key, val]) => ({
      id: key,
      name: val.name,
      topics: val.topics ? (Array.isArray(val.topics) ? val.topics : Object.keys(val.topics)) : [],
      city: val.city || null,
      event_topics: val.event_topics || [],
      event_apis: val.event_apis || [],
      hasDigest: !!(val.topics && (Array.isArray(val.topics) ? val.topics.length > 0 : Object.keys(val.topics).length > 0)),
      hasEvents: !!(val.event_apis && val.event_apis.length > 0) || !!(val.event_topics && val.event_topics.length > 0),
    }));
    allCommunities.value = groups;
    setCached(CACHE_KEY, groups);
    communitiesStatus.value = 'ready';
  } catch (err) {
    console.error('Failed to load communities:', err);
    communitiesStatus.value = 'error';
  }
}
```

- [ ] **Step 2: Build to verify no breakage**

Run (from `extension/`): `npm run build`
Expected: `built in ...` with no errors.

- [ ] **Step 3: Manual check (record result in the commit or PR)**

Load `extension/dist/` unpacked, open a new tab, then open another within the hour: the second open must NOT fire a request to `scenius-digest.vercel.app/api/groups` (served from cache), and the community list still renders. Clearing `localStorage.mc_communities_cache` and reopening fetches again.

- [ ] **Step 4: Commit**

```bash
git add extension/src/store/communities.js
git commit -m "perf(communities): cache the community list for 1h (#32)"
```

---

### Task 3: Cache the sessions/events feed (`sessions.js`)

**Files:**
- Modify: `extension/src/store/sessions.js`

**Interfaces:**
- Consumes: `getCached`, `setCached`, `communityKey` from `../lib/cache`.
- Produces: `loadSessions(communities)` unchanged signature; now returns cached `sessions` when fresh for the same community set.

- [ ] **Step 1: Add the cache to `loadSessions`**

In `extension/src/store/sessions.js`, add the import (after the `authHeader` import):

```js
import { getCached, setCached, communityKey } from '../lib/cache';
```

Add cache constants below `EVENTS_API`:

```js
const CACHE_KEY = 'mc_sessions_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5min
```

At the very start of `loadSessions`, before `sessionsLoading.value = true;`, add the cache read (keyed by the selected communities):

```js
export async function loadSessions(communities) {
  const selector = communityKey(communities.map((c) => c.id));
  const cached = getCached(CACHE_KEY, CACHE_TTL, selector);
  if (cached) { sessions.value = cached; return; }

  sessionsLoading.value = true;
  // ... existing body unchanged through the sort ...
```

At the end of the `try`, right after `sessions.value = deduped;`, add the cache write:

```js
    sessions.value = deduped;
    setCached(CACHE_KEY, deduped, selector);
  } catch (err) {
    console.error('Failed to load sessions:', err);
  }

  sessionsLoading.value = false;
}
```

(Leave the event fetch, Supabase query, dedupe, and sort exactly as they are.)

- [ ] **Step 2: Build to verify no breakage**

Run (from `extension/`): `npm run build`
Expected: `built in ...` with no errors.

- [ ] **Step 3: Manual check**

On the Participation tab, switching away and back within 5min must NOT re-fire `scenius-digest.vercel.app/api/events` or the Supabase `sessions_with_topics` query; the events still render. Changing the selected communities DOES refetch (different `selector`).

- [ ] **Step 4: Commit**

```bash
git add extension/src/store/sessions.js
git commit -m "perf(sessions): cache events/sessions per community set for 5min (#32)"
```

---

### Task 4: Cache the consent feed (`proposals.js`) + invalidate on vote

**Files:**
- Modify: `extension/src/store/proposals.js`

**Interfaces:**
- Consumes: `getCached`, `setCached`, `clearCached`, `communityKey` from `../lib/cache`.
- Produces: `loadProposals(communityIds)` and `castVote(...)` unchanged signatures; badge (`openUnvotedCount`) unaffected — it still derives from `proposals`.

- [ ] **Step 1: Add the cache to `loadProposals` and invalidate in `castVote`**

In `extension/src/store/proposals.js`, add the import (after the `caSessionHeader` import):

```js
import { getCached, setCached, clearCached, communityKey } from '../lib/cache';
```

Add cache constants below the `CA_URL` const:

```js
const CACHE_KEY = 'mc_proposals_cache';
const CACHE_TTL = 90 * 1000; // 90s — short, keeps the consent badge fresh
```

In `loadProposals`, after the early-return guard and before `proposalsLoading.value = true;`, add the cache read:

```js
export async function loadProposals(communityIds) {
  const headers = caSessionHeader();
  if (!headers.Authorization || !communityIds || communityIds.length === 0) {
    proposals.value = [];
    return;
  }

  const selector = communityKey(communityIds);
  const cached = getCached(CACHE_KEY, CACHE_TTL, selector);
  if (cached) { proposals.value = cached; return; }

  proposalsLoading.value = true;
  // ... existing per-community fetch + all.sort(byUrgency) unchanged ...
```

After `proposals.value = all;`, add the cache write:

```js
    all.sort(byUrgency);
    proposals.value = all;
    setCached(CACHE_KEY, all, selector);
  } catch (err) {
    console.error('Failed to load decisions:', err);
  }
  proposalsLoading.value = false;
}
```

In `castVote`, after the in-place patch of `proposals.value` and before `return updated;`, invalidate the cache so a reopen shows the post-vote state:

```js
  proposals.value = proposals.value.map((p) =>
    p.id === proposalId && p.community_id === communityId
      ? { ...p, tallies: updated.tallies, my_vote: updated.my_vote, status: updated.status }
      : p
  );
  clearCached(CACHE_KEY); // a vote changes my_vote/tallies; drop the cache so the next open refetches
  return updated;
```

- [ ] **Step 2: Build to verify no breakage**

Run (from `extension/`): `npm run build`
Expected: `built in ...` with no errors.

- [ ] **Step 3: Manual check**

Reopening within 90s serves the consent feed from cache (no `/communities/:id/proposals` calls) and the Community Input tab badge (`openUnvotedCount`) shows the correct count on that cold-cache-less reopen. Casting a vote, then reopening, shows the updated vote/tallies (cache was invalidated), not the pre-vote state.

- [ ] **Step 4: Commit**

```bash
git add extension/src/store/proposals.js
git commit -m "perf(proposals): cache consent feed 90s, invalidate on vote (#32)"
```

---

### Task 5: Persist the community-account JWT + cache the identity (`caAuth.js`)

**Files:**
- Modify: `extension/src/store/caAuth.js`

**Interfaces:**
- Consumes: `getCached`, `setCached`, `clearCached` from `../lib/cache`.
- Produces: `getToken()`, `initCaAuth()`, `signOut()` unchanged signatures. New behavior: the 15-min JWT survives across new-tab page loads; `/auth/me` is skipped on warm reopens (cached identity, background-refreshed).

- [ ] **Step 1: Persist the JWT and cache the identity**

In `extension/src/store/caAuth.js`, add the import (after the existing imports):

```js
import { getCached, setCached, clearCached } from '../lib/cache';
```

Add key + TTL constants near the other `*_KEY` consts:

```js
const JWT_KEY = 'mc_ca_jwt';           // persisted { token, exp } so the 15-min JWT survives page loads
const IDENTITY_KEY = 'mc_ca_identity'; // cached { subject, type } to skip /auth/me on warm reopens
const IDENTITY_TTL = 5 * 60 * 1000;
```

Immediately after the `let _jwt = null; let _jwtExp = 0;` lines, rehydrate the JWT from storage on module load:

```js
// Reuse a still-valid JWT minted by a prior new-tab page instead of re-fetching /auth/token every open.
try {
  const c = JSON.parse(localStorage.getItem(JWT_KEY) || 'null');
  if (c && Date.now() < c.exp - 30000) { _jwt = c.token; _jwtExp = c.exp; }
} catch {}
```

In `getToken`, persist the JWT after a successful fetch:

```js
    const { token } = await res.json();
    _jwt = token; _jwtExp = decodeExp(token);
    try { localStorage.setItem(JWT_KEY, JSON.stringify({ token, exp: _jwtExp })); } catch {}
    return token;
```

In `refreshIdentity`, after setting `caSubject` / `caType` on the success path, cache the identity:

```js
      caSubject.value = me.subject ?? me.email ?? null;
      caType.value = me.type ?? (me.email ? 'email' : null);
      setCached(IDENTITY_KEY, { subject: caSubject.value, type: caType.value });
```

In `initCaAuth`, replace the final line `if (sessionToken()) await refreshIdentity();` with a cached-first, background-refresh version:

```js
  if (sessionToken()) {
    const cached = getCached(IDENTITY_KEY, IDENTITY_TTL);
    if (cached) {
      caSubject.value = cached.subject;
      caType.value = cached.type;
      refreshIdentity(); // background: self-corrects a server-side revocation (401 -> signOut)
    } else {
      await refreshIdentity();
    }
  }
```

In `signOut`, also drop the persisted JWT + identity:

```js
export function signOut() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(HANDLE_KEY);
  localStorage.removeItem(JWT_KEY);
  localStorage.removeItem(IDENTITY_KEY);
  _jwt = null; _jwtExp = 0;
  caSubject.value = null;
  caType.value = null;
  caHandle.value = null;
}
```

Finally, in the two places the session changes and the code already does `_jwt = null; _jwtExp = 0;` (the stash branch in `initCaAuth` and `requestBlueskySignIn`), also clear the persisted JWT + identity so a new session never reuses an old token:

```js
      _jwt = null; _jwtExp = 0;
      clearCached(JWT_KEY);
      clearCached(IDENTITY_KEY);
```

(Apply that to both `initCaAuth`'s `if (stashed) { ... }` block and `requestBlueskySignIn` after `localStorage.setItem(SESSION_KEY, session);`.)

- [ ] **Step 2: Build to verify no breakage**

Run (from `extension/`): `npm run build`
Expected: `built in ...` with no errors.

- [ ] **Step 3: Manual check**

Signed in, open two new tabs in succession: the second must NOT fire `/auth/token` (JWT rehydrated from `mc_ca_jwt`) nor `/auth/me` (identity from `mc_ca_identity`), and the account still shows as signed in. Signing out clears `mc_ca_jwt` + `mc_ca_identity`. Signing in with Bluesky mints a fresh token (old one cleared).

- [ ] **Step 4: Commit**

```bash
git add extension/src/store/caAuth.js
git commit -m "perf(caAuth): persist JWT across opens, cache /auth/me identity (#32)"
```

---

### Task 6: Lazy-load feeds by active tab (`app.jsx`)

**Files:**
- Modify: `extension/src/app.jsx`

**Interfaces:**
- Consumes: `activeTab` from `./store/panels`; existing `loadProposals`, `loadDigest`, `loadSessions`, `loadSavedFeeds`, `loadBlueskyFeed`, `startJamPolling`, `stopJamPolling`, `startAvailsPolling`, `stopAvailsPolling`, `selectedCommunityIds`, `selectedCommunities`, `isConnected`, `caSignedIn`.
- Produces: on a new-tab open, only the active tab's feed is fetched; `proposals` (badge) + jam load always; `avails` polls only while Participation is active.

- [ ] **Step 1: Import `activeTab`**

In `extension/src/app.jsx`, add to the imports (near the other store imports):

```js
import { activeTab } from './store/panels';
```

- [ ] **Step 2: Replace the three feed-loading effects**

Delete the current three effects — the `// Feeds react to community selection.` effect, the `// Consent feed is member-gated:` effect, and the `// Owns the Bluesky feed load lifecycle:` effect (the block from the first of those comments through the third effect's closing `}, [ready, isConnected.value]);`). Replace the whole block with:

```jsx
  // Always-on feeds: the consent badge (proposals) and the global jam strip.
  // These load on mount and on community / sign-in change regardless of the
  // active tab, so the Community Input badge is live on every open.
  useEffect(() => {
    if (!ready) return;
    const ids = selectedCommunityIds.value;
    loadProposals(caSignedIn.value ? ids : []);
    if (ids.length > 0) startJamPolling(ids);
    else stopJamPolling();
    return () => stopJamPolling();
  }, [ready, caSignedIn.value, selectedCommunityIds.value]);

  // Lazy-load the active tab's feed. Fires on mount for the current tab and on
  // every tab switch; the per-store caches dedup repeat activations, so a
  // return visit costs nothing. Network + Participation are never fetched until
  // visited. Bluesky stays single-owner HERE (see #33/#35): it loads only when
  // Network is the active tab and Bluesky is connected — no other caller.
  useEffect(() => {
    if (!ready) return;
    const ids = selectedCommunityIds.value;
    switch (activeTab.value) {
      case 'network':
        if (isConnected.value) { loadSavedFeeds(); loadBlueskyFeed(); }
        break;
      case 'digest':
        loadDigest(ids);
        break;
      case 'participation':
        loadSessions(selectedCommunities.value);
        break;
      // 'communityInput' -> proposals, already loaded by the always-on effect above
    }
  }, [ready, activeTab.value, selectedCommunityIds.value, isConnected.value]);

  // avails polling is scoped to the Participation tab being open (its banners
  // only show there). Starts on activation, stops when you leave.
  // (Slice 2 moves this into a shared service-worker loop.)
  useEffect(() => {
    if (!ready) return;
    const ids = selectedCommunityIds.value;
    if (activeTab.value === 'participation' && ids.length > 0) {
      startAvailsPolling(ids);
    } else {
      stopAvailsPolling();
    }
    return () => stopAvailsPolling();
  }, [ready, activeTab.value, selectedCommunityIds.value]);
```

- [ ] **Step 3: Build to verify no breakage**

Run (from `extension/`): `npm run build`
Expected: `built in ...` with no errors.

- [ ] **Step 4: Manual check**

Load `dist/`, open a new tab on the default Digest tab with DevTools Network open: it must NOT fire the Bluesky `getTimeline` / saved-feeds calls, nor `scenius-digest .../api/events`, nor avails — only digest + proposals (badge) + jam + auth. Switching to Network fetches the Bluesky feed (once); switching to Participation fetches events and starts avails polling; switching back to a visited tab within its TTL fetches nothing. The Community Input badge shows the correct count on the initial Digest open (proposals loaded by the always-on effect). Connecting Bluesky while on the Network tab loads the feed exactly once (no #33/#35 regression); connecting while on Digest does not fetch Bluesky until you switch to Network.

- [ ] **Step 5: Commit**

```bash
git add extension/src/app.jsx
git commit -m "perf(app): lazy-load feeds by active tab (#32)"
```

---

### Task 7: End-to-end verification (MANUAL — human, not a subagent)

**Files:** none (verification only).

This task cannot be automated (no browser harness in this repo); it is run by a human after Tasks 1-6 land.

- [ ] **Step 1: Build and load**

Run (from `extension/`): `npm run build`, then reload the unpacked extension at `chrome://extensions` (Load unpacked -> `extension/dist/`).

- [ ] **Step 2: Count requests, cold vs warm**

Open a new tab with the DevTools Network panel recording. Note the request count on a cold open (cleared caches) and a warm reopen (seconds later).
Expected: cold open ≈ 4-5 requests (down from ~15); warm reopen ≈ 1-2 (mostly the always-on jam fetch, which Slice 2 removes). Record the actual numbers in the PR description.

- [ ] **Step 3: Behavior spot-checks**

Confirm: consent badge correct on a cold Digest open; jam strip appears when rooms exist; Network / Participation load on first visit and are instant on return; connecting Bluesky loads the feed once; changing the selected communities refetches the active tab's feed and the badge.

- [ ] **Step 4: Open the PR**

```bash
git push -u origin perf/newtab-cost-lazy-load-caching
gh pr create --repo Citizen-Infra/my-community --base master \
  --title "perf: lazy-load feeds by tab + cache uncached stores (#32, slice 1)" \
  --body-file <pr-body-with-the-measured-request-counts>
```

## Self-Review

- **Spec coverage:** lazy-load by active tab -> Task 6; cache uncached stores (communities/sessions/proposals) -> Tasks 2-4; JWT reuse + `/auth/me` cache -> Task 5; `lib/cache.js` helper -> Task 1; jam/avails caching intentionally deferred (Refinement 1); shared SW polling is Slice 2 (out of scope). Consent-badge-stays-live -> always-on effect in Task 6. Covered.
- **Type consistency:** `getCached(key, ttlMs, selector)`, `setCached(key, value, selector)`, `clearCached(key)`, `communityKey(ids)` are used with those exact signatures in Tasks 2-5. `activeTab` values (`network` / `digest` / `participation` / `communityInput`) match `panels.js`.
- **Single-owner invariant:** after Task 6, `loadBlueskyFeed` / `loadSavedFeeds` are called only from the active-tab effect's `network` branch — verify by grep during Task 6 review that no other `app.jsx` effect or component mount calls them.
