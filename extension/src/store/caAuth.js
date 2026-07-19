import { signal, computed } from '@preact/signals';
import { getServiceAuth, resolveHandleFromDid } from '../lib/oauth-atproto';
import { getCached, setCached, clearCached } from '../lib/cache';

const CA_URL = import.meta.env.VITE_CA_URL || 'https://community-admin-server-production.up.railway.app';
const SESSION_KEY = 'mc_ca_session';
const HANDLE_KEY = 'mc_ca_bluesky_handle'; // cached friendly @handle for a Bluesky (DID) identity
const STASH_KEY = 'mc_ca_auth_redirect'; // written by background.js after the magic-link redirect
const CA_DID = import.meta.env.VITE_CA_DID || 'did:web:community-admin-server-production.up.railway.app';
const JWT_KEY = 'mc_ca_jwt';           // persisted { token, exp } so the 15-min JWT survives page loads
const IDENTITY_KEY = 'mc_ca_identity'; // cached { subject, type } to skip /auth/me on warm reopens
const IDENTITY_TTL = 5 * 60 * 1000;

// The signed-in community identity: an email or a Bluesky DID, plus which kind.
export const caSubject = signal(null); // string | null
export const caType = signal(null);    // 'email' | 'atproto' | null
export const caHandle = signal(localStorage.getItem(HANDLE_KEY) || null); // friendly @handle for a DID identity
export const caSignedIn = computed(() => !!caSubject.value);

let _jwt = null;   // cached 15-min JWT
let _jwtExp = 0;   // epoch ms

// Reuse a still-valid JWT minted by a prior new-tab page instead of re-fetching /auth/token every open.
try {
  const c = JSON.parse(localStorage.getItem(JWT_KEY) || 'null');
  if (c && Date.now() < c.exp - 30000) { _jwt = c.token; _jwtExp = c.exp; }
} catch {}

function sessionToken() {
  return localStorage.getItem(SESSION_KEY);
}

// Mirror the CA session token into chrome.storage.local so the service worker
// (which cannot read this page's localStorage) can authenticate wiki-suggest POSTs
// for Sub-project C. Reads the live token, so it both sets and clears.
function mirrorSessionToBg() {
  try {
    const t = sessionToken();
    if (t) chrome.storage?.local?.set({ mc_ca_session_bg: t });
    else chrome.storage?.local?.remove('mc_ca_session_bg');
  } catch {}
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
      clearCached(JWT_KEY);
      clearCached(IDENTITY_KEY);
    }
  } catch {}
  mirrorSessionToBg(); // keep the worker's copy fresh on every open
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
      setCached(IDENTITY_KEY, { subject: caSubject.value, type: caType.value });
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
  mirrorSessionToBg();
  _jwt = null; _jwtExp = 0;
  clearCached(JWT_KEY);
  clearCached(IDENTITY_KEY);
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
    try { localStorage.setItem(JWT_KEY, JSON.stringify({ token, exp: _jwtExp })); } catch {}
    return token;
  } catch { return null; }
}

// Header object for scenius-digest calls: Bearer when signed in, empty otherwise.
export async function authHeader() {
  const t = await getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// Header for community-admin's OWN endpoints (e.g. /communities/:id/proposals).
// authMiddleware there accepts the session token as Bearer (the same token /auth/me
// uses), NOT the short-lived JWT above — that JWT is for services verifying via JWKS
// (scenius-digest). Synchronous: reads the stored session token directly.
export function caSessionHeader() {
  const t = sessionToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export function signOut() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(HANDLE_KEY);
  localStorage.removeItem(JWT_KEY);
  localStorage.removeItem(IDENTITY_KEY);
  mirrorSessionToBg(); // token gone -> clears the worker's copy
  _jwt = null; _jwtExp = 0;
  caSubject.value = null;
  caType.value = null;
  caHandle.value = null;
}
