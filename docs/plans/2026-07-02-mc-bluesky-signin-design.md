# MC "Sign in with Bluesky" for the community account — design

Design spec — 2026-07-02. my-community#19. Consumer of community-admin V5 (Bluesky OAuth) + S3 (extension auth).

## Goal

Let a My Community user sign into the **community account** (community-admin) with **Bluesky** — reusing the Bluesky identity they already use in MC, which carries their DID community memberships — so DID-membership-gated private communities resolve under the current Bearer-JWT model. Email magic-link stays as a secondary fallback. Along the way, fix a confirmed V5 regression that hides the signed-in state.

## Background — the confirmed current-state diagnosis

Traced end-to-end through the code:

- scenius-digest's `/api/groups` (`api/groups.py` + `lib/auth.py`) shows a **private** community only to a caller presenting a **valid community-admin Bearer JWT** whose `memberships` claim contains that community. The old `?identity=` param is gone. `cibc` and `scenius` are both **private**.
- So a user seeing those private communities in MC **must** be sending a valid membership JWT. Today that happens via a **stale email community-session**: the S3 email sign-in left a 30-day session token in `localStorage` (`mc_ca_session`); `getToken()` still mints a JWT from it; the user is an email-admin of all communities (V2 seed), so that JWT carries `cibc`/`scenius`; scenius-digest resolves them.
- **The V5 regression:** `caAuth.refreshEmail()` reads `/auth/me`'s `.email`, but V5 changed `/auth/me` to return `{ subject, type }`. So `caEmail` goes `undefined`, `caSignedIn` reads `false`, and the UI shows **signed-out** even though the session token is live and gating works. The user reasonably concludes "not signed in with email."

Implications this design acts on: (1) the `/auth/me` read is a **live bug** to fix; (2) proper token gating already works via the *email* identity, so the value of #19 is a correct UI **and** making the **Bluesky/DID** identity usable (which also serves any member who is DID-only, not email-admin-of-everything).

## Component 1 — `extension/src/store/caAuth.js`: generalize identity (also fixes the regression)

- Replace the email-only signal with a subject/type model:
  - `caEmail` (signal) → `caSubject` (signal: the identity string, an email or a DID) + `caType` (signal: `'email' | 'atproto'`).
  - `caSignedIn = computed(() => !!caSubject.value)` (unchanged semantics).
- `refreshEmail()` → `refreshIdentity()`: `GET /auth/me`, read `{ subject, type }`, set `caSubject`/`caType`. On `401`, `signOut()`. (This fixes the V5 regression.)
- `initCaAuth()`: unchanged mechanics (pull the stashed session token from the service worker into `localStorage`), then call `refreshIdentity()`.
- Keep `requestSignIn(email)` (email magic-link) exactly as is.
- Add `requestBlueskySignIn(handle)`: navigate the current tab to `${CA_URL}/auth/atproto/login?handle=${encodeURIComponent(handle)}&client=extension`. (A full-page redirect is required for OAuth; `background.js`'s existing callback-catch returns the user to the newtab.)
- `getToken()` / `authHeader()` / `signOut()` unchanged — they key off the session token, which is identity-agnostic. `signOut()` clears `caSubject`/`caType` (was `caEmail`).

## Component 2 — the sign-in flow (reuses V5 + S3 plumbing; no new server or service-worker code)

1. User clicks "Sign in with Bluesky" in Settings → `requestBlueskySignIn(handle)` navigates to community-admin `/auth/atproto/login?handle=…&client=extension`.
2. community-admin runs the ATProto OAuth (Bluesky consent), callback with `state='extension'` → redirects to `/auth/extension-callback#session=<token>`.
3. `background.js` (unchanged — it already matches `…/auth/extension-callback`) stashes the token in `chrome.storage.local` and navigates the tab back to `src/newtab.html`.
4. On load, `initCaAuth()` pulls the stash into `localStorage` and calls `refreshIdentity()` → `/auth/me` = `{ subject: '<did>', type: 'atproto' }` → `caSubject = did`, `caType = 'atproto'`, `caSignedIn = true`.
5. `getToken()` → `/auth/token` → JWT with `sub = did` + `memberships`. `authHeader()` sends it to scenius-digest → private communities the DID is a member of resolve.

## Component 3 — `extension/src/components/SettingsModal.jsx`: the community-account section

**Use the `impeccable` skill for this UI change** (MC has `PRODUCT.md` + `DESIGN.md`). Mirror the existing community-account section's treatment.

- **Signed out** (`!caSignedIn.value`):
  - Primary: a **"Sign in with Bluesky"** button. If MC's own Bluesky is connected (`blueskyUser.value` from `store/auth.js` is non-null), use its `handle` directly (one click, no input). If not connected, show a small handle text input first (`you.bsky.social`), then the button.
  - Secondary: a quieter "or sign in with email" magic-link form (the existing `caEmailInput` + `requestSignIn` flow), visually subordinate.
- **Signed in** (`caSignedIn.value`):
  - Show the identity with a status dot + "Sign out": for `caType === 'atproto'`, show the **handle** when `caSubject === blueskyUser.value?.did` (reuse the handle MC already knows), else the raw DID; for `caType === 'email'`, show `caSubject` (the email). Replaces the current `caEmail.value` display.

## Handle source

Reuse MC's existing Bluesky session — `blueskyUser` (`{ did, handle }`) from `extension/src/store/auth.js`. Prefill the sign-in with `blueskyUser.value.handle`; use `blueskyUser.value.did` to decide whether to show a friendly handle for the signed-in DID.

## Error handling / known edges

- Token expiry / `401` → existing `signOut()` in `getToken()` / `refreshIdentity()`.
- **Known minor edge (community-admin):** the atproto *failure* path redirects to `${ADMIN_URL}/#/?error=atproto` (the community-admin panel), not back to MC. So a cancelled/failed Bluesky consent lands the user on the panel rather than MC; they simply remain signed-out in MC. Acceptable for v1; a follow-up on community-admin could branch the extension failure redirect. Out of scope here.
- If the user is not Bluesky-connected in MC and mistypes a handle, community-admin's login redirects to the same error path; same v1 behavior.

## Testing / verification

MC has **no test framework** (per its CLAUDE.md) — do not introduce one. Verification is:
- `cd extension && npm run build` succeeds.
- Manual smoke (load unpacked, reload): with MC Bluesky connected, click "Sign in with Bluesky" → consent → return to newtab → Settings shows the **handle** as signed-in (not signed-out) → private communities the DID is a member of appear. Confirm the email fallback still sends a link. Confirm an already-signed-in email session now displays correctly (regression fix) rather than showing signed-out.

## Scope

**In scope:** `caAuth.js` subject/type generalization (+ the `/auth/me` regression fix), `requestBlueskySignIn`, the SettingsModal community-account UI (via impeccable), friendly-handle display for a DID session.

**Out of scope:**
- Whether scenius-digest correctly enforces gating — it does (verified in `api/groups.py`); #19 just sends the correct DID token.
- The community-list source (stays scenius-digest — MC is a client and can't hold the service secret to hit community-admin `/api/config` directly, unlike avails).
- community-admin's atproto failure-redirect edge (a possible follow-up on community-admin, not MC).
- MC's own Bluesky (app-password) auth for the feed — unrelated, unchanged.

## Success criteria

- A member signs into the community account with **Bluesky** in one click (handle prefilled), lands back in MC signed-in, and sees the private communities their DID is a member of.
- The signed-in state displays correctly for **both** a Bluesky (handle) and an email session — the V5 "shows signed-out while signed in" regression is gone.
- Email magic-link sign-in still works as a fallback.
- `npm run build` clean; no test framework added.
