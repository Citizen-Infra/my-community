import { signal, computed } from '@preact/signals';
import { getServiceAuth, resolveHandleFromDid } from '../lib/oauth-atproto';
import { getCached, setCached, clearCached } from '../lib/cache';
import { CA_URL, CA_DID } from '../lib/config';
import { platform } from '../lib/platform';
import { validWebCallbackState } from '../lib/web-auth-state';
import { clearPrivateCommunityCaches } from '../lib/private-data';
import {
  clearTelegramSignInState,
  readTelegramSignInState,
  rememberTelegramSignInState,
} from '../lib/telegram-auth-state';

const SESSION_KEY = 'mc_ca_session';
const HANDLE_KEY = 'mc_ca_bluesky_handle'; // cached friendly @handle for a Bluesky (DID) identity
const JWT_KEY = 'mc_ca_jwt';           // persisted { token, exp } so the 15-min JWT survives page loads
const IDENTITY_KEY = 'mc_ca_identity'; // cached { subject, type, identities } to skip auth reads on warm reopens
const IDENTITY_TTL = 5 * 60 * 1000;

export { clearTelegramSignInState, rememberTelegramSignInState };

// The signed-in community identity: an email or a Bluesky DID, plus which kind.
export const caSubject = signal(null); // string | null
export const caType = signal(null);    // 'email' | 'atproto' | null
export const caHandle = signal(localStorage.getItem(HANDLE_KEY) || null); // friendly @handle for a DID identity
export const caSignedIn = computed(() => !!caSubject.value);
export const caMemberships = signal([]);
export const caIdentities = signal([]);
export const caTelegramLinked = computed(() => caIdentities.value.some((identity) => identity.kind === 'telegram'));

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

// Mirror the CA session token through the extension adapter so the service worker
// (which cannot read this page's localStorage) can authenticate wiki-suggest POSTs
// for Sub-project C. Reads the live token, so it both sets and clears.
function mirrorSessionToBg() { platform().mirrorCommunitySession(sessionToken()); }

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
    const stashed = await platform().consumeCommunitySession();
    if (stashed) {
      localStorage.setItem(SESSION_KEY, stashed);
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
      caIdentities.value = cached.identities || [{ kind: cached.type, value: cached.subject, current: true }];
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
      caIdentities.value = [{ kind: caType.value, value: caSubject.value, current: true }];
      try {
        const identitiesResponse = await fetch(`${CA_URL}/auth/identities`, {
          headers: { Authorization: `Bearer ${sessionToken()}` },
        });
        if (identitiesResponse.ok) {
          const result = await identitiesResponse.json();
          if (Array.isArray(result.identities)) caIdentities.value = result.identities;
        }
      } catch {}
      setCached(IDENTITY_KEY, {
        subject: caSubject.value,
        type: caType.value,
        identities: caIdentities.value,
      });
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
  const activePlatform = platform();
  const isWeb = activePlatform.kind === 'web';
  const state = isWeb ? activePlatform.createOAuthState() : undefined;
  if (isWeb) localStorage.setItem('mc_web_email_state', JSON.stringify({ value: state, createdAt: Date.now() }));
  const res = await fetch(`${CA_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(isWeb
      ? { email, client: 'my-community-web', state, redirectUri: `${location.origin}/auth/callback` }
      : { email, client: 'extension' }),
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
    body: JSON.stringify({ token: jwt, ...(platform().kind === 'web' ? { client: 'my-community-web' } : {}) }),
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

function decodeClaims(jwt) {
  try {
    const part = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(part));
  } catch { return {}; }
}

if (_jwt) caMemberships.value = decodeClaims(_jwt).memberships || [];

export async function exchangeWebSignIn(code, state) {
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem('mc_web_email_state') || 'null'); } catch {}
  const fresh = stored && Date.now() - stored.createdAt < 20 * 60 * 1000;
  if (!fresh || !validWebCallbackState(stored.value, state)) throw new Error('This sign-in link does not match this browser.');
  await exchangeWebCode(code, state);
  localStorage.removeItem('mc_web_email_state');
}

async function exchangeWebCode(code, state) {
  const res = await fetch(`${CA_URL}/auth/web/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client: 'my-community-web', code, state }),
  });
  if (!res.ok) throw new Error('This sign-in link is invalid or has expired.');
  const { session } = await res.json();
  localStorage.setItem(SESSION_KEY, session);
  _jwt = null; _jwtExp = 0;
  clearCached(JWT_KEY);
  clearCached(IDENTITY_KEY);
  await refreshIdentity();
}

export async function exchangeTelegramSignIn(code, state) {
  const stored = readTelegramSignInState(state);
  const fresh = stored && Date.now() - stored.createdAt < 11 * 60 * 1000;
  if (!fresh || !validWebCallbackState(stored.value, state)) {
    throw new Error('This Telegram sign-in does not match this browser.');
  }
  await exchangeWebCode(code, state);
  clearTelegramSignInState(state);
}

export async function refreshCommunityAccount() {
  _jwt = null;
  _jwtExp = 0;
  caMemberships.value = [];
  clearCached(JWT_KEY);
  clearCached(IDENTITY_KEY);
  clearPrivateCommunityCaches();
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
    caMemberships.value = decodeClaims(token).memberships || [];
    try { localStorage.setItem(JWT_KEY, JSON.stringify({ token, exp: _jwtExp })); } catch {}
    return token;
  } catch { return null; }
}

// Header object for scenius-digest calls: Bearer when signed in, empty otherwise.
export async function authHeader() {
  // Do not authenticate a request until the session has resolved to an account.
  // Otherwise private responses could be cached under the anonymous selector.
  const subject = caSubject.value;
  if (!subject) return {};
  const t = await getToken();
  return t && caSubject.value === subject ? { Authorization: `Bearer ${t}` } : {};
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
  const previousSession = sessionToken();
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(HANDLE_KEY);
  localStorage.removeItem(JWT_KEY);
  localStorage.removeItem(IDENTITY_KEY);
  clearTelegramSignInState();
  mirrorSessionToBg(); // token gone -> clears the worker's copy
  _jwt = null; _jwtExp = 0;
  caSubject.value = null;
  caType.value = null;
  caHandle.value = null;
  caMemberships.value = [];
  caIdentities.value = [];
  clearPrivateCommunityCaches();
  if (previousSession) {
    return fetch(`${CA_URL}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${previousSession}` },
    }).catch(() => undefined);
  }
  return Promise.resolve();
}
