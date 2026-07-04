import { signal, computed } from '@preact/signals';
import { getServiceAuth, resolveHandleFromDid } from '../lib/oauth-atproto';

const CA_URL = import.meta.env.VITE_CA_URL || 'https://community-admin-server-production.up.railway.app';
const SESSION_KEY = 'mc_ca_session';
const HANDLE_KEY = 'mc_ca_bluesky_handle'; // cached friendly @handle for a Bluesky (DID) identity
const STASH_KEY = 'mc_ca_auth_redirect'; // written by background.js after the magic-link redirect
const CA_DID = import.meta.env.VITE_CA_DID || 'did:web:community-admin-server-production.up.railway.app';

// The signed-in community identity: an email or a Bluesky DID, plus which kind.
export const caSubject = signal(null); // string | null
export const caType = signal(null);    // 'email' | 'atproto' | null
export const caHandle = signal(localStorage.getItem(HANDLE_KEY) || null); // friendly @handle for a DID identity
export const caSignedIn = computed(() => !!caSubject.value);

let _jwt = null;   // cached 15-min JWT
let _jwtExp = 0;   // epoch ms

function sessionToken() {
  return localStorage.getItem(SESSION_KEY);
}

function decodeExp(jwt) {
  try {
    const part = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return (JSON.parse(atob(part)).exp || 0) * 1000;
  } catch { return 0; }
}

// Pull a freshly-stashed session token (from the service worker's redirect catch)
// into localStorage, then resolve the signed-in identity. Call once on app start.
export async function initCaAuth() {
  try {
    const stash = await chrome.storage?.local?.get(STASH_KEY);
    const stashed = stash?.[STASH_KEY];
    if (stashed) {
      localStorage.setItem(SESSION_KEY, stashed);
      await chrome.storage.local.remove(STASH_KEY);
      _jwt = null; _jwtExp = 0;
    }
  } catch {}
  if (sessionToken()) await refreshIdentity();
}

// Resolve the signed-in identity from the session token. community-admin's
// /auth/me returns { subject, type }; older builds returned { email }. Read both
// so a rollback or mixed deploy never blanks a live session.
async function refreshIdentity() {
  try {
    const res = await fetch(`${CA_URL}/auth/me`, { headers: { Authorization: `Bearer ${sessionToken()}` } });
    if (res.ok) {
      const me = await res.json();
      caSubject.value = me.subject ?? me.email ?? null;
      caType.value = me.type ?? (me.email ? 'email' : null);
      // Backfill a friendly @handle for a Bluesky (DID) identity so the UI never
      // shows a raw DID, even with no live feed session. Resolved from the DID doc.
      if (caType.value === 'atproto' && caSubject.value && !caHandle.value) {
        resolveHandleFromDid(caSubject.value)
          .then((h) => { if (h) { caHandle.value = h; localStorage.setItem(HANDLE_KEY, h); } })
          .catch(() => {});
      }
      return;
    }
    if (res.status === 401) signOut();
  } catch {}
}

export async function requestSignIn(email) {
  const res = await fetch(`${CA_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, client: 'extension' }),
  });
  if (!res.ok && res.status !== 204) throw new Error('Could not send the magic link. Try again.');
}

// Community sign-in via the existing Bluesky OAuth session: mint a PDS-signed
// service-auth JWT for community-admin's DID, exchange it at /auth/atproto/assert
// for a community session. Requires Bluesky already connected (getServiceAuth
// throws "not signed in" otherwise).
export async function requestBlueskySignIn() {
  const jwt = await getServiceAuth(CA_DID);
  const res = await fetch(`${CA_URL}/auth/atproto/assert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: jwt }),
  });
  if (!res.ok) throw new Error('Could not verify your Bluesky identity with the community server.');
  const { session } = await res.json();
  localStorage.setItem(SESSION_KEY, session);
  _jwt = null; _jwtExp = 0;
  await refreshIdentity();
}

// A valid 15-min JWT, or null when signed out / on failure.
export async function getToken() {
  if (!sessionToken()) return null;
  if (_jwt && Date.now() < _jwtExp - 30000) return _jwt;
  try {
    const res = await fetch(`${CA_URL}/auth/token`, { headers: { Authorization: `Bearer ${sessionToken()}` } });
    if (res.status === 401) { signOut(); return null; }
    if (!res.ok) return null;
    const { token } = await res.json();
    _jwt = token; _jwtExp = decodeExp(token);
    return token;
  } catch { return null; }
}

// Header object for scenius-digest calls: Bearer when signed in, empty otherwise.
export async function authHeader() {
  const t = await getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export function signOut() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(HANDLE_KEY);
  _jwt = null; _jwtExp = 0;
  caSubject.value = null;
  caType.value = null;
  caHandle.value = null;
}
