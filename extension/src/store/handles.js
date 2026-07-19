import { signal } from '@preact/signals';
import { resolveHandleFromDid } from '../lib/oauth-atproto';

const CACHE_KEY = 'mc_did_handles';

function loadCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

// did -> handle (e.g. 'alice.bsky.social'). Reactive, so any card that reads it
// re-renders when a handle lands. Seeded from a small localStorage cache so
// already-known handles show on first paint instead of the generic fallback.
export const handles = signal(loadCache());
const inflight = new Set();

// Turn a community-admin subject into a display name: an email shows its local
// part, a Bluesky DID shows @handle once resolved (else the caller's fallback).
// Reading handles.value here is what makes the calling component re-render when a
// handle resolves.
export function subjectLabel(subject, fallback) {
  if (!subject) return fallback;
  if (subject.startsWith('did:')) {
    const h = handles.value[subject];
    return h ? `@${h}` : fallback;
  }
  if (subject.includes('@')) return subject.split('@')[0];
  return fallback;
}

// Resolve any not-yet-known DIDs among these subjects to handles, once each
// (deduped across in-flight + cached). Non-DID subjects and already-resolved ones
// are skipped. Call after a feed loads its items.
export function resolveHandles(subjects) {
  for (const s of subjects || []) {
    if (!s || !s.startsWith('did:')) continue;
    if (handles.value[s] || inflight.has(s)) continue;
    inflight.add(s);
    resolveHandleFromDid(s)
      .then((h) => {
        if (!h) return;
        handles.value = { ...handles.value, [s]: h };
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(handles.value)); } catch {}
      })
      .catch(() => {})
      .finally(() => inflight.delete(s));
  }
}
