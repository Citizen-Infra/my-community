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
