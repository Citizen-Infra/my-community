import { signal, computed } from '@preact/signals';

const CA_URL = import.meta.env.VITE_CA_URL || 'https://community-admin-server-production.up.railway.app';
const SESSION_KEY = 'mc_ca_session';
const STASH_KEY = 'mc_ca_auth_redirect'; // written by background.js after the magic-link redirect

// The signed-in community identity: an email or a Bluesky DID, plus which kind.
export const caSubject = signal(null); // string | null
export const caType = signal(null);    // 'email' | 'atproto' | null
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
  _jwt = null; _jwtExp = 0;
  caSubject.value = null;
  caType.value = null;
}
