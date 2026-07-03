# MC unified ATProto sign-in + Network feed — design

Design spec — 2026-07-03. Supersedes the UI half of the #19 "Bluesky primary, email fallback" design (`2026-07-02-mc-bluesky-signin-design.md`); keeps #19's caAuth store fix. Touches two repos: my-community (led) and community-admin (one supporting endpoint).

## Goal

Collapse My Community's two separate Bluesky sign-ins into one coherent model. The community account gets two equal front doors, email and ATProto (Bluesky), because most communities register members by email today and a growing minority by DID. A single ATProto OAuth session powers BOTH the Network feed and the community identity, so a Bluesky user signs in once. App passwords are retired. The feed tab is renamed from "Bluesky" to "Network."

## Why (the problem this fixes)

Today MC has two independent Bluesky-flavored auths:

- **Feed auth** (`store/auth.js`, `lib/atproto.js`): app-password login to read the user's timeline. Session key `mc_bluesky_session`.
- **Community account** (`store/caAuth.js`): identity proof to community-admin so it returns the user's memberships. Session key `mc_ca_session`. Email today; #19 added a second Bluesky (server-side OAuth) door.

The result of #19 as built: two "Sign in with Bluesky" affordances with different copy, and email demoted to a hidden fallback even though email is the only door most communities will use. Two problems: (1) a Bluesky user appears to sign in with Bluesky twice; (2) email is not first-class. This design removes both.

Naming rationale: the feed is named "Network" (not "Bluesky") because ATProto is a protocol on which multiple networks are built (Bluesky, Blacksky, custom-domain networks). A protocol-level content name stays correct as the ecosystem widens; the platform name is reserved for the sign-in action, where recognition matters.

## Prior facts this builds on (verified)

- community-admin stores each member as an email OR a DID (`community_members.identifier` + `type` in {`email`, `atproto`}), and `/auth/token` returns a membership JWT for the signed-in subject. Its session model is one subject per session.
- scenius-digest `/api/groups` returns a private community only when the caller's verified token carries that community's id in its memberships (`visibility != "private"` are always public). Public communities show to everyone. This is correct and unchanged by this work.
- ATProto OAuth signs a user in by handle and issues a session with PDS access, sufficient to read `app.bsky.feed.getTimeline` and to sign inter-service auth assertions.

## The model: one account, two equal doors

The governing principle: **only one Bluesky/ATProto affordance is visible at a time, chosen by state.** That is what keeps this from ever reading as two logins.

- **Signed out (community account):** two equal, side-by-side options. "Sign in with email" (magic link) and "Sign in with Bluesky" (ATProto OAuth). No primary/fallback framing. The user picks whichever identity their community registered them under.
- **Signed in with Bluesky:** the same ATProto OAuth session powers the community identity (memberships for the DID) AND the Network feed (reads the timeline). No app password, no second connect. One sign-in, both lit.
- **Signed in with email:** communities resolve via the email identity. The Network feed is not connected (email carries no Bluesky session). The Network tab's own empty state offers "Connect Bluesky to see popular posts from your network." Connecting there runs an ATProto OAuth purely for the feed; it does not change the community identity, which stays email.

Consequence: a user never sees "Sign in with Bluesky" (account door) and "Connect Bluesky for feed" at the same time. The account door appears only when signed out; the feed connect appears only when signed-in-by-email (or fully signed out of communities but wanting the feed) and lives at the feed, not in the account area.

Known limitation (accepted for v1): community-admin sessions are single-subject, so a user who belongs to one community by email and another by DID sees only the memberships of whichever identity they signed in as. Multi-identity sessions are out of scope.

## Components

### 1. MC in-extension ATProto OAuth client (new)

MC runs its own browser ATProto OAuth client (candidate library: `@atproto/oauth-client-browser`), replacing app-password `createSession`. The flow:

- User enters a handle; the client resolves the PDS and runs OAuth (consent at the user's own PDS, Bluesky or otherwise).
- On callback, MC holds an OAuth session: the DID plus PDS access (DPoP-bound), refreshable by the library.
- Reuses the existing MV3 redirect-catch pattern in `public/background.js` (today it catches `/auth/extension-callback`); the OAuth redirect URI and client-metadata hosting are resolved in Technical validation below.

This session is the single source of the user's Bluesky identity for both feed and community.

### 2. Community identity from the OAuth session (new community-admin endpoint)

Instead of #19's server-side `/auth/atproto/login` redirect, MC proves the DID to community-admin without a second consent:

- MC uses the OAuth session to mint an ATProto inter-service auth JWT (`aud` = community-admin's DID/service, signed by the session key).
- New community-admin endpoint (e.g. `POST /auth/atproto/assert`) verifies that JWT against the DID's published signing key (resolve the DID document), then issues community-admin's membership JWT, the same shape `/auth/token` returns today, and a session token for `mc_ca_session`.
- The email door is unchanged (`/auth/login` magic link). #19's server-side atproto OAuth endpoints can be removed once MC no longer calls them.

### 3. Feed reads from the OAuth session (modify)

`store/bluesky.js` / `lib/atproto.js` fetch `getTimeline` / `getFeed` through the OAuth session rather than the app-password session. Feed filtering, caching, and pagination behavior are unchanged.

### 4. UI (modify, via impeccable)

- **Community account section:** two equal doors, no fallback framing. Signed-in card shows the friendly handle for a Bluesky identity (resolved from the OAuth session, not a separate feed session, fixing the raw-DID display quirk noted in #19), or the email for an email identity.
- **Network tab:** rename the label `network: 'Bluesky'` to `network: 'Network'` in `TabBar.jsx`. Its empty state carries the contextual "Connect Bluesky for your feed" affordance for email/no-Bluesky users.
- **Remove** the standalone app-password "Bluesky" box from Settings.
- Sign-in button copy defaults to "Sign in with Bluesky" (recognition); flagged as the one non-neutral label. All other copy and the implementation stay network-neutral.

### 5. Retire app passwords (migration)

Existing users hold an app-password `mc_bluesky_session`. On upgrade it stops powering the feed. The Network tab's empty state prompts them to reconnect via the new one-click ATProto sign-in. No silent breakage: detect a legacy session and surface a "reconnect your Bluesky" prompt.

## Data flow

**Bluesky door:** click "Sign in with Bluesky" -> enter handle -> ATProto OAuth consent at the user's PDS -> callback -> MC holds OAuth session (DID + PDS tokens). Then in parallel: (a) Network feed reads the timeline from the session; (b) MC mints an inter-service JWT -> `POST /auth/atproto/assert` -> community-admin verifies against the DID key -> returns membership JWT + session token -> `authHeader()` sends it to scenius-digest -> the DID's private communities resolve.

**Email door:** "Sign in with email" -> `/auth/login` magic link -> community-admin session -> membership JWT (unchanged). Network feed stays disconnected until the user connects Bluesky at the feed.

## Error handling

- OAuth cancel/failure returns the user to MC signed-out (no dead-end on the community-admin panel, unlike #19's server-side flow).
- OAuth token refresh handled by the client library; on unrecoverable failure, clear the session and show the reconnect prompt.
- community-admin `/auth/atproto/assert`: invalid or unverifiable assertion -> 401 with a clear message; DID-resolution failure -> distinct retryable error.

## Technical validation — spike result: GO (2026-07-03)

The feasibility spike resolved the unknowns in favor of the in-extension approach. Verdict: GO, with one custom-code caveat.

**Confirmed architecture:**
- **OAuth from the extension** uses Chrome's `chrome.identity.launchWebAuthFlow()` with a `https://<EXTENSION_ID>.chromiumapp.org/...` relay redirect. Two shipping extensions prove this against real ATProto OAuth (hzoo/henry.ink, kevinmcmahon/bsky-oauth-chrome-extension).
- **Client metadata plus a thin `/oauth/callback` relay page** are hosted on community-admin's existing HTTPS domain (it already serves its own client metadata).
- **The OAuth client runs in the newtab page** (it needs a DOM; it cannot run in the MV3 service worker). The DPoP keypair and session persist in **IndexedDB under the extension origin** (survives service-worker restarts); `background.js` reads that same-origin store for `getTimeline`.

**Proving the DID to community-admin (the key unlock):** immediately after login, the extension calls `com.atproto.server.getServiceAuth({ aud: <community-admin DID> })`. That returns a short-lived JWT signed by the user's PDS (not the client), authorized by the ordinary DPoP access token under the `transition:generic` scope. The extension POSTs it to community-admin, which verifies it statelessly by resolving the DID document. No second redirect, no server-side OAuth custody. This replaces #19's server-side `/auth/atproto/login` entirely.

**The one caveat / biggest risk:** the official `@atproto/oauth-client-browser` library does not support the extension redirect flow out of the box (upstream issue #3093, open since Nov 2024). MC must hand-roll the PKCE / DPoP / token-exchange around `launchWebAuthFlow`, as both precedent extensions did. Proven, but custom.

**Proof-of-concept: PASSED (2026-07-03).** A throwaway Node PoC (`atproto-oauth-poc/`, a loopback redirect standing in for `launchWebAuthFlow`) validated the full chain against a real account, end to end: hand-rolled PKCE + DPoP + PAR (with nonce retry) -> token exchange -> `getTimeline` (feed reads from the one session) -> `getServiceAuth` (no `lxm` needed) -> the resulting ES256K JWT verified statelessly against the DID document. Only the Chrome-specific redirect swap (loopback -> `chrome.identity.launchWebAuthFlow` + a `chromiumapp.org` relay) is unexercised in code, and two precedent extensions already demonstrate it.

**Implementation note surfaced by the PoC:** community-admin needs its own DID (a `did:web` served at its domain) to be the `aud` of the service-auth JWT and to check `aud` on verification. Setup item for subsystem A. The proven OAuth/DPoP/getServiceAuth code in the PoC is the seed for subsystem B's OAuth module (reuse, do not rewrite).

## Scope and decomposition

Three subsystems, each its own implementation plan after this spec is approved and the spikes pass:

- **A. community-admin:** `POST /auth/atproto/assert` (verify DID-signed assertion -> membership JWT) + remove the now-unused server-side extension OAuth endpoints. Plan lives in `community-admin/docs/plans/`.
- **B. MC identity/feed core:** in-extension OAuth client; feed reads via OAuth; community token via the assert endpoint; app-password retirement + migration. Plan in `my-community/docs/plans/`.
- **C. MC UI:** two-door community account, Network rename, contextual feed connect, remove the app-password box. Via impeccable. Plan in `my-community/docs/plans/`.

## Out of scope

- Multi-identity sessions (email-keyed and DID-keyed communities visible at once).
- scenius-digest changes: its gating is correct; this work only changes which token MC sends.
- Network-specific behavior beyond Bluesky: the flow is network-neutral by design but will be smoke-tested on Bluesky handles only for v1.
- Whether specific communities are public or private: that is a per-community setting in community-admin, unrelated to this auth work.

## Success criteria

- A Bluesky user signs in once and gets both their Network feed and their DID-keyed communities. No second Bluesky sign-in anywhere.
- An email user signs into communities with email as a first-class option, and can separately connect Bluesky for the Network feed from the feed itself.
- No app-password entry remains; legacy users are prompted to reconnect, not silently broken.
- The feed tab reads "Network"; "Bluesky" appears only on the sign-in action.
- The signed-in community account shows a friendly handle for a Bluesky identity, with no raw-DID fallback caused by a separate feed session.
