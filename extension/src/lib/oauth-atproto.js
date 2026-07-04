// In-extension ATProto OAuth client, ported from the validated spike at
// atproto-oauth-poc/poc.mjs (LOGIN PASSED against a real Bluesky account).
// Node -> browser adaptations only: WebCrypto instead of node:crypto/jose
// generateKeyPair, chrome.identity.launchWebAuthFlow instead of a loopback
// HTTP server, and idb (IndexedDB) instead of an in-memory session. The
// resolution + DPoP logic itself is identical to the spike.

import { openDB } from 'idb';
import { SignJWT } from 'jose';

const CA_URL = import.meta.env.VITE_CA_URL || 'https://community-admin-server-production.up.railway.app';
const CLIENT_ID = `${CA_URL}/oauth/client-metadata.json`;
const REDIRECT_URI = `${CA_URL}/oauth/callback`;
const SCOPE = 'atproto transition:generic';

// --- crypto primitives (WebCrypto adaptations of the PoC's node:crypto helpers) ---

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function sha256(strOrBytes) {
  const data = typeof strOrBytes === 'string' ? new TextEncoder().encode(strOrBytes) : strOrBytes;
  return new Uint8Array(await crypto.subtle.digest('SHA-256', data));
}

const now = () => Math.floor(Date.now() / 1000);

// --- identity resolution: handle -> DID -> PDS -> auth server (ported verbatim from poc.mjs) ---

async function resolveHandleToDid(handle) {
  const r = await fetch(`https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`);
  if (!r.ok) throw new Error(`resolveHandle ${r.status}: ${await r.text()}`);
  return (await r.json()).did;
}

async function resolveDidDoc(did) {
  let url;
  if (did.startsWith('did:plc:')) url = `https://plc.directory/${did}`;
  else if (did.startsWith('did:web:')) url = `https://${did.slice('did:web:'.length).replace(/:/g, '/')}/.well-known/did.json`;
  else throw new Error(`unsupported DID method: ${did}`);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`DID doc ${r.status}`);
  return r.json();
}

function pdsFromDidDoc(doc) {
  const svc = (doc.service || []).find((s) => (s.id || '').endsWith('#atproto_pds') || s.type === 'AtprotoPersonalDataServer');
  if (!svc) throw new Error('no atproto_pds service in DID doc');
  return svc.serviceEndpoint;
}

async function discoverAuthServer(pds) {
  const pr = await fetch(`${pds}/.well-known/oauth-protected-resource`);
  if (!pr.ok) throw new Error(`oauth-protected-resource ${pr.status}`);
  const authServer = (await pr.json()).authorization_servers?.[0];
  if (!authServer) throw new Error('no authorization_servers');
  const md = await fetch(`${authServer}/.well-known/oauth-authorization-server`);
  if (!md.ok) throw new Error(`oauth-authorization-server ${md.status}`);
  return md.json();
}

async function resolveIdentity(handle) {
  const did = await resolveHandleToDid(handle);
  const doc = await resolveDidDoc(did);
  const pds = pdsFromDidDoc(doc);
  const md = await discoverAuthServer(pds);
  return { did, doc, pds, md };
}

// The account's handle from its DID document's alsoKnownAs (at://handle), so a
// community identity keyed on a DID can display @handle without a live feed session.
export async function resolveHandleFromDid(did) {
  const doc = await resolveDidDoc(did);
  const aka = (doc.alsoKnownAs || []).find((a) => typeof a === 'string' && a.startsWith('at://'));
  return aka ? aka.slice('at://'.length) : null;
}

// --- DPoP ---

async function makeDpopKey() {
  // extractable: false keeps the private signing key non-exportable. WebCrypto
  // always leaves an EC public key extractable regardless, so exportKey below
  // still yields the public jwk, and the private CryptoKey persists in IndexedDB.
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', kp.publicKey);
  const publicJwk = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, alg: 'ES256' };
  return { privateKey: kp.privateKey, publicKey: kp.publicKey, publicJwk };
}

async function dpopProof(key, htm, htu, { nonce, accessToken } = {}) {
  const payload = { jti: b64url(crypto.getRandomValues(new Uint8Array(16))), htm, htu, iat: now() };
  if (nonce) payload.nonce = nonce;
  if (accessToken) payload.ath = b64url(await sha256(accessToken));
  return new SignJWT(payload)
    .setProtectedHeader({ typ: 'dpop+jwt', alg: 'ES256', jwk: key.publicJwk })
    .sign(key.privateKey);
}

// POST form to an endpoint with DPoP, retrying once when the server hands back a fresh nonce.
async function dpopPost(endpoint, form, key, { nonce, accessToken } = {}) {
  let curNonce = nonce;
  for (let attempt = 0; attempt < 2; attempt++) {
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded', DPoP: await dpopProof(key, 'POST', endpoint, { nonce: curNonce, accessToken }) };
    if (accessToken) headers.Authorization = `DPoP ${accessToken}`;
    const r = await fetch(endpoint, { method: 'POST', headers, body: form });
    const serverNonce = r.headers.get('DPoP-Nonce');
    if ((r.status === 400 || r.status === 401) && serverNonce && serverNonce !== curNonce) {
      curNonce = serverNonce; // use_dpop_nonce challenge -> retry
      continue;
    }
    return { res: r, nonce: serverNonce || curNonce };
  }
  throw new Error('exhausted DPoP nonce retries');
}

async function doPar(md, handle, { codeChallenge, state }, key) {
  const form = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPE,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
    login_hint: handle,
  });
  const { res, nonce } = await dpopPost(md.pushed_authorization_request_endpoint, form, key);
  if (!res.ok) throw new Error(`PAR ${res.status}: ${await res.text()}`);
  const { request_uri, expires_in } = await res.json();
  return { request_uri, expires_in, nonce };
}

// --- IndexedDB session persistence (mirrors src/store/db.js's idb idiom) ---

const DB_NAME = 'mc-atproto-oauth';
const DB_VERSION = 1;
const STORE_NAME = 'session';

let dbPromise;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      },
    });
  }
  return dbPromise;
}

async function saveSession(s) {
  const db = await getDb();
  await db.put(STORE_NAME, { ...s, id: 'current' });
}

async function readSession() {
  const db = await getDb();
  const s = await db.get(STORE_NAME, 'current');
  return s || null;
}

async function clearSessionIdb() {
  const db = await getDb();
  await db.delete(STORE_NAME, 'current');
}

// --- public API ---

export async function loginWithBluesky(handle) {
  const { pds, md } = await resolveIdentity(handle);
  const key = await makeDpopKey();
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const codeChallenge = b64url(await sha256(verifier));
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const { request_uri, nonce } = await doPar(md, handle, { codeChallenge, state }, key);
  const authorizeUrl = `${md.authorization_endpoint}?client_id=${encodeURIComponent(CLIENT_ID)}&request_uri=${encodeURIComponent(request_uri)}`;
  const redirect = await chrome.identity.launchWebAuthFlow({ url: authorizeUrl, interactive: true });
  const rt = new URL(redirect);
  if (rt.searchParams.get('state') !== state) throw new Error('state mismatch');
  const code = rt.searchParams.get('code');
  if (!code) throw new Error(rt.searchParams.get('error_description') || 'sign-in cancelled');
  const tokenForm = new URLSearchParams({ client_id: CLIENT_ID, redirect_uri: REDIRECT_URI, grant_type: 'authorization_code', code, code_verifier: verifier });
  const { res } = await dpopPost(md.token_endpoint, tokenForm, key, { nonce });
  if (!res.ok) throw new Error(`token exchange ${res.status}`);
  const tok = await res.json();
  const session = { did: tok.sub, handle, pdsUrl: pds, accessToken: tok.access_token, refreshToken: tok.refresh_token, sub: tok.sub, tokenEndpoint: md.token_endpoint, authIssuer: md.issuer, dpopPublicKey: key.publicKey, dpopPrivateKey: key.privateKey };
  await saveSession(session);
  localStorage.removeItem('mc_bluesky_session'); // retire any legacy app-password session
  return { did: session.did, handle, pdsUrl: pds };
}

async function keyFromSession(s) {
  const jwk = await crypto.subtle.exportKey('jwk', s.dpopPublicKey);
  return { privateKey: s.dpopPrivateKey, publicKey: s.dpopPublicKey, publicJwk: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, alg: 'ES256' } };
}

export async function dpopFetch(url, init = {}) {
  let s = await readSession();
  if (!s) throw new Error('not signed in');
  const key = await keyFromSession(s);
  const doOnce = async (accessToken, nonce) => {
    const headers = { ...(init.headers || {}), Authorization: `DPoP ${accessToken}`, DPoP: await dpopProof(key, init.method || 'GET', url, { accessToken, nonce }) };
    return fetch(url, { ...init, headers });
  };
  // Track the latest server nonce so the refresh retry does not re-omit it: an
  // expired-token-plus-nonce-challenge round-trip would otherwise 401 after a
  // successful refresh and look like a dead session.
  let nonce;
  let r = await doOnce(s.accessToken, nonce);
  nonce = r.headers.get('DPoP-Nonce') || nonce;
  if (r.status === 401 && nonce) { r = await doOnce(s.accessToken, nonce); nonce = r.headers.get('DPoP-Nonce') || nonce; }
  if (r.status === 401) {
    const rs = await refresh(s);
    if (rs) {
      r = await doOnce(rs.accessToken, nonce);
      const freshNonce = r.headers.get('DPoP-Nonce');
      if (r.status === 401 && freshNonce && freshNonce !== nonce) r = await doOnce(rs.accessToken, freshNonce);
    }
  }
  return r;
}

export async function getServiceAuth(aud) {
  const s = await readSession();
  if (!s) throw new Error('not signed in');
  const url = `${s.pdsUrl}/xrpc/com.atproto.server.getServiceAuth?aud=${encodeURIComponent(aud)}`;
  const r = await dpopFetch(url, { method: 'GET' });
  if (!r.ok) throw new Error(`getServiceAuth ${r.status}`);
  return (await r.json()).token;
}

async function refresh(s) {
  const key = await keyFromSession(s);
  const form = new URLSearchParams({ client_id: CLIENT_ID, grant_type: 'refresh_token', refresh_token: s.refreshToken });
  const { res } = await dpopPost(s.tokenEndpoint, form, key);
  if (!res.ok) { await clearSessionIdb(); return null; }
  const tok = await res.json();
  const next = { ...s, accessToken: tok.access_token, refreshToken: tok.refresh_token || s.refreshToken };
  await saveSession(next); return next;
}

export function hasLegacyAppPasswordSession() {
  return !!localStorage.getItem('mc_bluesky_session');
}

export async function getStoredSession() { const s = await readSession(); return s ? { did: s.did, handle: s.handle, pdsUrl: s.pdsUrl } : null; }
export async function logout() { await clearSessionIdb(); }
