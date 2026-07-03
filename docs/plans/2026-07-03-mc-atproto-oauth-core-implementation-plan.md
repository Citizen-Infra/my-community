# MC ATProto OAuth Core Implementation Plan (subsystem B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace My Community's Bluesky app-password auth with an in-extension ATProto OAuth session that powers BOTH the Network feed and the community identity (via community-admin S5), from a single sign-in.

**Architecture:** A new `lib/oauth-atproto.js` runs the OAuth flow with `chrome.identity.launchWebAuthFlow` against community-admin's hosted client metadata + callback relay (subsystem A). It persists the DPoP keypair and tokens in IndexedDB (extension origin) and exposes a DPoP-authenticated fetch. The feed stores read through that fetch; `caAuth.js` mints a `getServiceAuth` JWT and exchanges it at `POST /auth/atproto/assert` for a community session. App passwords are removed; legacy sessions are detected and the user is prompted to reconnect. The proven reference implementation is `atproto-oauth-poc/poc.mjs` (committed spike).

**Tech Stack:** Preact + @preact/signals, Vite, Chrome MV3, `jose` (browser build, for DPoP proofs). No test framework in MC: verify with `cd extension && npm run build` plus manual smoke (real OAuth consent).

## Global Constraints

- **No test framework**; do not add one. Per-task gate: `cd extension && npm run build` succeeds. Interactive OAuth is a human smoke step, marked `[Human]`.
- **Port, do not re-derive.** `atproto-oauth-poc/poc.mjs` is the validated reference. Port its `resolveHandleToDid`, `resolveDidDoc`, `pdsFromDidDoc`, `discoverAuthServer`, `dpopProof`, `dpopPost`, `dpopGet` verbatim into the browser module (they use only `fetch`, `jose`, and WebCrypto, all available in the extension page). Change only what the browser environment requires: the DPoP keypair is a WebCrypto `CryptoKey` pair persisted in IndexedDB (not regenerated per run), and the redirect goes through `launchWebAuthFlow`.
- **client_id** = `${CA_URL}/oauth/client-metadata.json`; **redirect_uri** in PAR/authorize = `${CA_URL}/oauth/callback` (subsystem A). The final captured URL is `chrome.identity.getRedirectURL()` (a `chromiumapp.org` URL). community-admin's `MC_EXTENSION_REDIRECT` env must equal that value; this plan's Task 1 prints it.
- **CA_URL** = `import.meta.env.VITE_CA_URL || 'https://community-admin-server-production.up.railway.app'` (same default as `caAuth.js`). **CA_DID** = `did:web:community-admin-server-production.up.railway.app` (the `getServiceAuth` `aud`), via `import.meta.env.VITE_CA_DID` with that default.
- No em dashes in copy/comments. No AI attribution in commits.
- **Branch:** `feat/mc-atproto-oauth` off `master`. Depends on subsystem A being deployed (client-metadata + callback + assert live) before the Task 5/6 human smokes, but the code can be built before then.

---

### Task 1: Stable extension id + `identity` permission

OAuth needs a fixed extension id (so the `chromiumapp.org` redirect and community-admin's `MC_EXTENSION_REDIRECT` are stable) and the `identity` permission.

**Files:**
- Modify: `extension/public/manifest.json` (add `"key"`, add `"identity"` to `permissions`)

**Interfaces:**
- Produces: a fixed extension id; `chrome.identity.getRedirectURL()` -> `https://<id>.chromiumapp.org/`. Record this URL; the operator sets community-admin `MC_EXTENSION_REDIRECT` to it (append a path like `oauthcb`).

- [ ] **Step 1: Generate a key + id.** In `extension/`, run: `openssl genrsa 2048 | openssl rsa -pubout -outform DER | openssl base64 -A`. This base64 is the manifest `"key"`. (Deriving the exact id from the key: after loading unpacked once with the key set, `chrome://extensions` shows the stable id; or compute it. The id is deterministic from the key.)

- [ ] **Step 2: Add to `extension/public/manifest.json`:** the top-level `"key": "<base64 from step 1>"`, and add `"identity"` to the `permissions` array.

- [ ] **Step 3: Build + load unpacked, read the id.** `cd extension && npm run build`; load `dist/` at `chrome://extensions`; note the extension id and thus `https://<id>.chromiumapp.org/`. Write both into `docs/process-notes.md` and this task's report so the operator can set `MC_EXTENSION_REDIRECT`.

- [ ] **Step 4: Commit** — `git add extension/public/manifest.json && git commit -m "feat: fixed extension key + identity permission for ATProto OAuth"`

---

### Task 2: The OAuth client module

**Files:**
- Create: `extension/src/lib/oauth-atproto.js`
- Reference (read, port from): `atproto-oauth-poc/poc.mjs`

**Interfaces (Produces, consumed by Tasks 3-5):**
- `loginWithBluesky(handle: string): Promise<{ did, handle, pdsUrl }>` — runs `launchWebAuthFlow`, exchanges the code, persists the session in IndexedDB, returns the identity. Throws on cancel/failure.
- `getStoredSession(): Promise<{ did, handle, pdsUrl } | null>` — the persisted identity (no tokens exposed).
- `dpopFetch(url: string, init?: { method?, body?, headers? }): Promise<Response>` — DPoP + access-token fetch with nonce retry and one refresh-on-401.
- `getServiceAuth(aud: string): Promise<string>` — a `com.atproto.server.getServiceAuth` JWT.
- `logout(): Promise<void>` — clears the IndexedDB session.

- [ ] **Step 1: Port the resolution + DPoP helpers.** Copy `resolveHandleToDid`, `resolveDidDoc`, `pdsFromDidDoc`, `discoverAuthServer`, `dpopProof`, `dpopPost`, `dpopGet`, `b64url`, `sha256`, `now` from `atproto-oauth-poc/poc.mjs` into `oauth-atproto.js` unchanged, except: `dpopProof` takes a `{ privateKey, publicJwk }` sourced from the persisted `CryptoKey` (see Step 2), and `sha256` uses `crypto.subtle.digest('SHA-256', ...)` returning a `Uint8Array` (the Node `createHash` version does not exist in the browser). Provide:

```js
async function sha256(strOrBytes) {
  const data = typeof strOrBytes === 'string' ? new TextEncoder().encode(strOrBytes) : strOrBytes;
  return new Uint8Array(await crypto.subtle.digest('SHA-256', data));
}
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
```

- [ ] **Step 2: IndexedDB persistence.** Implement a tiny store `mc-atproto-oauth` (db name), object store `session` (keyPath `'id'`, single record id `'current'`) holding `{ id:'current', did, handle, pdsUrl, accessToken, refreshToken, sub, dpopPublicKey, dpopPrivateKey, tokenEndpoint, authIssuer }`. The DPoP keys are stored as `CryptoKey` objects directly (IndexedDB supports structured-clone of non-extractable `CryptoKey`). Helpers:

```js
function idb() { /* open 'mc-atproto-oauth' v1, create store 'session' keyPath 'id' */ }
async function saveSession(s) { /* put {...s, id:'current'} */ }
async function readSession() { /* get 'current' or null */ }
async function clearSessionIdb() { /* delete 'current' */ }
async function makeDpopKey() {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const publicJwk = await crypto.subtle.exportKey('jwk', kp.publicKey); // publicKey must be extractable
  return { privateKey: kp.privateKey, publicKey: kp.publicKey, publicJwk: { ...publicJwk, alg: 'ES256' } };
}
```

Note: generate the keypair with the public key extractable and the private key non-extractable (`generateKey(..., true, ['sign'])` then export only the public JWK; the private `CryptoKey` persists in IndexedDB and is used with `jose`'s `SignJWT(...).sign(privateKey)` which accepts a `CryptoKey`).

- [ ] **Step 3: `loginWithBluesky(handle)`.** Compose the ported helpers + `launchWebAuthFlow`:

```js
import { SignJWT } from 'jose';
const CLIENT_ID = `${CA_URL}/oauth/client-metadata.json`;
const REDIRECT_URI = `${CA_URL}/oauth/callback`;
const SCOPE = 'atproto transition:generic';

export async function loginWithBluesky(handle) {
  const { md, pds } = await resolveIdentity(handle);   // ported resolve chain
  const key = await makeDpopKey();
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const codeChallenge = b64url(await sha256(verifier));
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const { request_uri, nonce } = await doPar(md, handle, { codeChallenge, state }, key);  // ported PAR
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
  const doc = await resolveDidDoc(tok.sub);
  const session = { did: tok.sub, handle, pdsUrl: pds, accessToken: tok.access_token, refreshToken: tok.refresh_token, sub: tok.sub, tokenEndpoint: md.token_endpoint, authIssuer: md.issuer, dpopPublicKey: key.publicKey, dpopPrivateKey: key.privateKey };
  await saveSession(session);
  return { did: session.did, handle, pdsUrl: pds };
}
```

(`resolveIdentity` and `doPar` are the ported helpers; they return `md`/`pds` and `request_uri`/`nonce` as in the PoC.)

- [ ] **Step 4: `dpopFetch`, `getServiceAuth`, refresh, `logout`, `getStoredSession`.**

```js
async function keyFromSession(s) { return { privateKey: s.dpopPrivateKey, publicKey: s.dpopPublicKey, publicJwk: { ...(await crypto.subtle.exportKey('jwk', s.dpopPublicKey)), alg: 'ES256' } }; }

export async function dpopFetch(url, init = {}) {
  let s = await readSession();
  if (!s) throw new Error('not signed in');
  const key = await keyFromSession(s);
  const doOnce = async (accessToken, nonce) => {
    const headers = { ...(init.headers || {}), Authorization: `DPoP ${accessToken}`, DPoP: await dpopProof(key, init.method || 'GET', url, { accessToken, nonce }) };
    return fetch(url, { ...init, headers });
  };
  let r = await doOnce(s.accessToken);
  if (r.status === 401 && r.headers.get('DPoP-Nonce')) r = await doOnce(s.accessToken, r.headers.get('DPoP-Nonce'));
  if (r.status === 401) { const rs = await refresh(s); if (rs) r = await doOnce(rs.accessToken); }
  return r;
}

export async function getServiceAuth(aud) {
  const s = await readSession();
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

export async function getStoredSession() { const s = await readSession(); return s ? { did: s.did, handle: s.handle, pdsUrl: s.pdsUrl } : null; }
export async function logout() { await clearSessionIdb(); }
```

- [ ] **Step 5: Build** — `cd extension && npm run build`. Expected: compiles (module is not yet imported anywhere, so this only checks syntax). Fix any error.

- [ ] **Step 6: Commit** — `git add extension/src/lib/oauth-atproto.js && git commit -m "feat: in-extension ATProto OAuth client (ported from PoC)"`

---

### Task 3: Point the feed at the OAuth session

Replace the app-password session with the OAuth session for identity + feed reads.

**Files:**
- Modify: `extension/src/store/auth.js` (source `blueskyUser`/`blueskySession` from the OAuth module)
- Modify: `extension/src/lib/atproto.js` (`bskyFetch`/`bskyPost` delegate to `dpopFetch`)
- Modify: `extension/src/store/bluesky.js` (feed URLs use `session.pdsUrl`, not hardcoded `bsky.social`)

**Interfaces:**
- Consumes: `loginWithBluesky`, `getStoredSession`, `dpopFetch`, `logout` (Task 2).
- Produces: `blueskyUser` = `{ did, handle }` from the OAuth session; `blueskySession` = a marker object `{ did, handle, pdsUrl }` (no tokens; the DPoP fetch owns them). `connectBluesky(handle)` runs the OAuth login. `disconnectBluesky()` calls `logout()`.

- [ ] **Step 1: Rewrite `store/auth.js`.** `initAuth` -> `const s = await getStoredSession(); if (s) { blueskyUser.value = { did: s.did, handle: s.handle }; blueskySession.value = s; }`. `connectBluesky(handle)` -> `const id = await loginWithBluesky(handle); blueskyUser.value = { did: id.did, handle: id.handle }; blueskySession.value = id; return id;` (drop `appPassword`). `disconnectBluesky()` -> `await logout(); blueskyUser.value = null; blueskySession.value = null; clearBlueskyState();`. Remove imports of `createSession`/`getValidSession`/`clearSession` from `lib/atproto`.

- [ ] **Step 2: Rewrite `lib/atproto.js`** `bskyFetch`/`bskyPost` to delegate to `dpopFetch`:

```js
import { dpopFetch } from './oauth-atproto';
export async function bskyFetch(url) { return dpopFetch(url, { method: 'GET' }); }
export async function bskyPost(url, body) { return dpopFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
```

Delete the app-password functions (`createSession`, `getSavedSession`, `refreshSession`, `getValidSession`, `clearSession`) from this file. `bskyFetch`/`bskyPost` no longer take a `session` arg (the module owns it).

- [ ] **Step 3: Update `store/bluesky.js`.** Every hardcoded `https://bsky.social/xrpc/...` feed/pref/list URL becomes `${session.pdsUrl}/xrpc/...`, and every `bskyFetch(url, session)` / `bskyPost(url, body, session)` call drops the trailing `session` arg (now `bskyFetch(url)` / `bskyPost(url, body)`). `session` is still read from `blueskySession.value` for `pdsUrl` and the early `if (!session) return`. The `toggleLike` `session.did`/`session.pdsUrl` reads still work (both are on the marker object).

- [ ] **Step 4: Build** — `cd extension && npm run build`. Fix any missed `session` arg or URL.

- [ ] **Step 5: `[Human]` smoke** — requires subsystem A deployed. Load `dist/`, Settings, connect Bluesky (Task 4 wires the button; until then, temporarily call `connectBluesky('<handle>')` from the console). Confirm the Network feed loads. If it 401s, capture the response.

- [ ] **Step 6: Commit** — `git add extension/src/store/auth.js extension/src/lib/atproto.js extension/src/store/bluesky.js && git commit -m "feat: feed reads via the ATProto OAuth session (DPoP)"`

---

### Task 4: Community identity from the OAuth session

After Bluesky sign-in, mint a service-auth JWT and exchange it at community-admin for a community session.

**Files:**
- Modify: `extension/src/store/caAuth.js` (add `requestBlueskySignIn`)

**Interfaces:**
- Consumes: `getServiceAuth`, `loginWithBluesky`/`getStoredSession` (Task 2); `POST ${CA_URL}/auth/atproto/assert` (subsystem A) returning `{ session }`.
- Produces: `requestBlueskySignIn(handle: string): Promise<void>` — ensures a Bluesky OAuth session (reuse if `store/auth.js` already connected, else `loginWithBluesky`), mints `getServiceAuth(CA_DID)`, POSTs it to `/auth/atproto/assert`, stores the returned session token in `mc_ca_session`, then `refreshIdentity()`. Replaces the deleted `#19` server-redirect version.

- [ ] **Step 1: Implement** in `caAuth.js`:

```js
import { getServiceAuth } from '../lib/oauth-atproto';
const CA_DID = import.meta.env.VITE_CA_DID || 'did:web:community-admin-server-production.up.railway.app';

export async function requestBlueskySignIn() {
  const jwt = await getServiceAuth(CA_DID);
  const res = await fetch(`${CA_URL}/auth/atproto/assert`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: jwt }),
  });
  if (!res.ok) throw new Error('Could not verify your Bluesky identity with the community server.');
  const { session } = await res.json();
  localStorage.setItem(SESSION_KEY, session);
  _jwt = null; _jwtExp = 0;
  await refreshIdentity();
}
```

(`requestBlueskySignIn` requires an existing Bluesky OAuth session; the UI in plan C only offers it once `isConnected`/after `connectBluesky`. `getServiceAuth` throws "not signed in" otherwise, which the UI surfaces.)

- [ ] **Step 2: Build** — `cd extension && npm run build`.

- [ ] **Step 3: `[Human]` smoke** — with subsystem A live: `connectBluesky('<handle>')` then `requestBlueskySignIn()` from the console. Confirm `/auth/me` now returns `{ subject: '<did>', type: 'atproto' }` and a private community the DID is a member of appears via `loadCommunities()`.

- [ ] **Step 4: Commit** — `git add extension/src/store/caAuth.js && git commit -m "feat: community sign-in via getServiceAuth -> /auth/atproto/assert"`

---

### Task 5: Retire app passwords + migrate legacy sessions

**Files:**
- Modify: `extension/src/lib/oauth-atproto.js` (add `hasLegacyAppPasswordSession`)
- Modify: `extension/src/store/auth.js` (expose a `legacyBlueskySession` signal for the UI)

**Interfaces:**
- Produces: `hasLegacyAppPasswordSession(): boolean` — true when the old `localStorage['mc_bluesky_session']` exists (an app-password session that no longer works). `legacyBlueskySession` signal (boolean) for plan C's reconnect prompt. On any successful `loginWithBluesky`, the legacy key is removed.

- [ ] **Step 1: Detect + clear.** In `oauth-atproto.js`: `export function hasLegacyAppPasswordSession() { return !!localStorage.getItem('mc_bluesky_session'); }`, and at the end of `loginWithBluesky` add `localStorage.removeItem('mc_bluesky_session');`. In `store/auth.js`, add `export const legacyBlueskySession = signal(hasLegacyAppPasswordSession());` and set it false after a successful `connectBluesky`.

- [ ] **Step 2: Confirm no app-password code remains.** `grep -rn "createSession\|appPassword\|app-password\|accessJwt\|refreshJwt" extension/src` returns only comments/none. Any live reference is a bug from Task 3; fix it.

- [ ] **Step 3: Build** — `cd extension && npm run build`.

- [ ] **Step 4: Commit** — `git add extension/src/lib/oauth-atproto.js extension/src/store/auth.js && git commit -m "feat: retire app passwords, flag legacy sessions for reconnect"`

---

## Coupling checklist (hand to the operator / plan A)

- The extension id from Task 1 -> community-admin `MC_EXTENSION_REDIRECT = https://<id>.chromiumapp.org/` (+ the path `launchWebAuthFlow` uses; default `chrome.identity.getRedirectURL()` has no path, so use the bare origin).
- Add `chrome-extension://<id>` to community-admin `EXTENSION_ORIGINS`.
- community-admin `CA_DID` must equal MC's `VITE_CA_DID`.

## Out of scope
- The UI (plan C): the two-door account, Network rename, contextual connect, reconnect prompt. This plan wires the store + lib only; plan C renders them.
- Multi-identity sessions.

## Spec coverage
- In-extension OAuth (launchWebAuthFlow + hosted metadata) -> Tasks 1-2. Feed via OAuth -> Task 3. Community token via assert -> Task 4. App-password retirement + migration -> Task 5. All trace to `2026-07-03-mc-unified-atproto-signin-design.md` subsystem B and the PoC.
