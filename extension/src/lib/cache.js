// Tiny localStorage cache with TTL. Matches the shape digest.js / bluesky.js
// already use: one storage key per store, an optional `selector` (e.g. the
// selected-community set) compared on read, and a timestamp for TTL expiry.

function readCached(key, selector) {
  try {
    const c = JSON.parse(localStorage.getItem(key) || 'null');
    if (c && (c.selector ?? '') === selector) return c;
  } catch {}
  return null;
}

export function getCached(key, ttlMs, selector = '') {
  const cached = readCached(key, selector);
  return cached && Date.now() - cached.timestamp < ttlMs ? cached.value : null;
}

// Overview tiles may render an expired snapshot while their focused feed gets a
// network refresh. Selectors still gate the read, so stale data cannot cross a
// community or account boundary.
export function getCachedStale(key, selector = '') {
  return readCached(key, selector)?.value ?? null;
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

export function accountCommunityKey(account, ids) {
  return JSON.stringify([account || '', communityKey(ids)]);
}
