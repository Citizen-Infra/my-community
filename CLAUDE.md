# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**My Community** -- Chrome extension that replaces the new tab page with a community dashboard. Three toggleable feeds: Bluesky Network (popular posts from people you follow), Community Digest (curated links from scenius-digest), and Participation (events from scenius-digest unified events API). Part of the Citizen Infrastructure ecosystem.

Forked from dear-neighbors, replacing location-based content with community-scoped feeds.

## Skills

Always use the `impeccable` skill for visual/UI tasks (MC has `PRODUCT.md` + `DESIGN.md`): `shape` before building, `craft` to build, `polish` before ship. Route every visible change through it.

## Commands

```bash
cd extension && npm run build   # Production build -> dist/
cd extension && npm run dev     # Vite dev server
```

After building, reload at `chrome://extensions` (Developer mode, Load unpacked -> `extension/dist/`).

No linting or test framework configured.

### Releasing

Bump version in `extension/package.json`, update changelog in `README.md`, commit, tag `v*`, push tag.

`extension/package.json` is the **only** place a version is bumped. `public/manifest.json` carries a `0.0.0` placeholder and the real value is stamped into `dist/manifest.json` at build time by `stampManifestVersion` in `vite.config.js` (#67) — do not edit it by hand. GitHub Actions (`package.yml`) builds a `.zip` and attaches it to the GitHub Release. The release body is auto-generated from the matching `### <version>` block of the README changelog, so keep that heading format (`### X.Y.Z — Month Year`).

```bash
git tag v0.1.3 && git push origin v0.1.3   # Triggers release workflow
./scripts/package-zip.sh                    # Local: build + create .zip
./scripts/package-zip.sh --skip-build       # Use existing dist/
```

**Only the tag ships anything.** Pushing the release commit is safe and reversible; pushing the tag runs `package.yml` and publishes. So stage the commit, run any gate below, then tag.

#### Verifying a real Bluesky sign-in

Needed whenever a release touches `host_permissions`, `src/lib/oauth-atproto.js`, or `src/lib/config.js`. It cannot be automated — it needs a browser, a consent screen, and a real DPoP key — and CORS evidence gathered with curl does **not** substitute (my-community#90 carries what curl does and does not prove).

1. `cd extension && npm run build` — `prebuild` runs `check-hosts.mjs`; a failure here is config drift, not a sign-in problem.
2. `chrome://extensions` → **Reload** if already loaded unpacked. Do not add a second copy: the pinned `key` means Chrome refuses a duplicate ID.
3. **Confirm the id.** This is the check that prevents a false alarm: a wrong id means a wrong build, not a permission bug. **Two are valid**, and which is correct depends on how the copy under test was installed:
   - `cphcgcdbileeagdkdjfmdjiffpidgngg` — loaded unpacked from a plain `npm run build`, which keeps the `key` field that pins this id.
   - `ooifhbgkclfdplnkicclfldllldffjco` — installed from the Chrome Web Store. `package-zip.sh --store` strips `key`, which is precisely why the store could assign its own at draft upload (2026-08-07).

   Both are in community-admin's `MC_EXTENSION_REDIRECT` and `EXTENSION_ORIGINS` allowlists, so either can complete a sign-in. Because the ids differ, a store install and an unpacked build **can** coexist and be verified independently — step 2's duplicate-id refusal only applies to two unpacked copies. Verify the store build separately once published: it is a different install, and nothing about a passing unpacked test transfers to it.
4. **Sign out first** (Settings → Sign out). A cached session means no OAuth round trip happens and the test proves nothing. This is the step that is easy to skip.
5. DevTools → Network, filter `bsky.network`, *then* sign in with an account hosted on **bsky.social** — a self-hosted PDS would not exercise the wildcard the permission trim removed.
6. Exercise the write path too: Participation → support a call-proposal and undo it. That is `createRecord`/`deleteRecord` against your own PDS, the only path that *writes* to a `bsky.network` host.

Failure looks like a consent screen that opens and never returns, with `blocked by CORS policy` or `net::ERR_FAILED` on a `bsky.network` URL in Console.

## Architecture

### Stack

- **Preact + @preact/signals** -- reactive UI
- **Vite** -- build tool, `base: ''` for Chrome extension relative paths
- **@supabase/supabase-js** -- sessions data
- **ATProto OAuth (in-extension)** -- Bluesky sign-in via `chrome.identity.launchWebAuthFlow` (PKCE + DPoP + PAR). One OAuth session powers BOTH the Network feed and the community identity. See `lib/oauth-atproto.js`. App passwords are retired (v0.3.0).
- **community-admin** -- the ecosystem identity provider. The community account has two equal sign-in doors: email magic link OR Bluesky DID (a `getServiceAuth` proof exchanged at `/auth/atproto/assert`). It issues the session that gates private communities.

### Single entry point

`src/newtab.html` -> tabbed dashboard (App component). No toolbar popup.

### Data Sources

| Feed | Source | Auth required |
|------|--------|--------------|
| Network (Bluesky) | ATproto API (getTimeline / getFeed) via the in-extension OAuth session (DPoP) | Yes (Bluesky OAuth) |
| Community Digest | scenius-digest API (GET /api/links), includes OG metadata | No |
| Participation | scenius-digest API (GET /api/events?community=X) + Supabase sessions | No |
| Jam Rooms | navidrome-jam API (GET /api/rooms?community=X), 2-min polling | No |

### State management

Signals-based stores in `src/store/`:
- `auth.js` -- Bluesky feed identity from the in-extension OAuth session (`connectBluesky`/`disconnectBluesky`, `blueskyUser`/`isConnected`/`legacyBlueskySession`)
- `caAuth.js` -- community account (the IdP session): two-door sign-in (email magic link + Bluesky `getServiceAuth` -> `/auth/atproto/assert`); `caSubject`/`caType`/`caHandle`/`caSignedIn`, `requestSignIn`/`requestBlueskySignIn`/`signOut`. Backfills `@handle` from the DID doc so the account never shows a raw DID.
- `bluesky.js` -- timeline fetching with pagination, follow-only filter, reposts toggle, sort by likes or weighted engagement; honors the user's Bluesky content preferences (muted words, hidden posts, feed-view settings) via a render-time `blueskyVisiblePosts` computed (`lib/moderation.js`)
- `communities.js` -- community selection from scenius-digest /api/groups (includes city, event_topics, event_apis)
- `digest.js` -- digest links from scenius-digest API, cached
- `sessions.js` -- events from scenius-digest /api/events per selected community + Supabase sessions, merged and deduped
- `jam.js` -- active jam rooms from navidrome-jam API, 2-min polling per selected communities
- `tabs.js` -- tab visibility and active tab state
- `theme.js` -- light/dark/system theme

### Libraries

- `lib/oauth-atproto.js` -- in-extension ATProto OAuth client (PKCE + DPoP + PAR via `launchWebAuthFlow`); persists the DPoP key + tokens in IndexedDB (`mc-atproto-oauth`); exports `loginWithBluesky`/`dpopFetch`/`getServiceAuth`/`logout`/`getStoredSession`/`resolveHandleFromDid`. Ported from the validated `../atproto-oauth-poc/` spike.
- `lib/atproto.js` -- thin `bskyFetch`/`bskyPost` that delegate to `dpopFetch` (the OAuth session owns the tokens; app-password functions are gone)
- `lib/supabase.js` -- Supabase client

### Components

- `TopBar.jsx` -- branding + settings gear
- `TabBar.jsx` -- horizontal tab navigation (Network / Digest / Participation)
- `Dashboard.jsx` -- renders the community feed tabs; always mounts `BlueskyFeed` for the Network tab (it owns both the connected + not-connected states)
- `BlueskyFeed.jsx` + `BlueskyPostCard.jsx` -- Bluesky timeline; owns the not-connected connect / legacy-reconnect empty state. Disconnect now lives in Settings > Network.
- `BlueskyFilterBar.jsx` -- the Network feed's inline filter controls: feed-source dropdown, segmented time window (24h/7d/30d) + sort (most liked / most discussed), reposts toggle. Applies changes immediately via `setBluesky*` + `loadBlueskyFeed`.
- `DigestFeed.jsx` + `DigestCard.jsx` -- community digest links (OG thumbnail support)
- `JamBanner.jsx` + `jam.css` -- live jam room banners with animated equalizer bars, shown atop SessionsPanel
- `SessionsPanel.jsx` -- participation opportunities (events from /api/events + Supabase sessions, with source badges)
- `SettingsModal.jsx` -- two-door community account (email + Bluesky, equal), Network (Bluesky connect status + Disconnect; the feed's filters live at the feed, not here), communities, tab toggles, theme, tab-manager save/backup + a local/private note

### Design system

- **Typography**: `--font-display: 'Instrument Serif'` (headings, brand), `--font-body: 'DM Sans'` (body text). Loaded via Google Fonts in `newtab.html`.
- **Palette**: Warm editorial -- warm paper background (`#f8f6f1`), stone text colors, forest-green primary (`#2d6a4f`) with amber (`#d97706`) as a rationed accent. Dark mode uses warm near-black (`#151311`). Source of truth: `DESIGN.md` + `extension/src/styles/variables.css`.
- **Cards**: `card-enter` stagger animation on load, hover lift with shadow transition.

### localStorage keys

All keys prefixed with `mc_`:

| Key | Store | Description |
|-----|-------|-------------|
| `mc_ca_session` | `store/caAuth.js` | community-admin session token (email or Bluesky-DID identity) |
| `mc_ca_bluesky_handle` | `store/caAuth.js` | cached `@handle` for a Bluesky (DID) community identity |
| `mc_bluesky_session` | (legacy) | retired app-password session; detected as `legacyBlueskySession`, prompts a reconnect. The live Bluesky OAuth session (DPoP key + tokens) lives in **IndexedDB** (`mc-atproto-oauth`), not localStorage |
| `mc_bluesky_feed` | `store/bluesky.js` | Selected feed URI (default: the Best of Follows feed generator; falls back to the Following timeline if it is unavailable) |
| `mc_bluesky_window` | `store/bluesky.js` | Time window filter (default: `24h`) |
| `mc_bluesky_reposts` | `store/bluesky.js` | Show reposts toggle (default: `true`) |
| `mc_bluesky_weighted` | `store/bluesky.js` | Weighted engagement sort (default: `false`) |
| `mc_bluesky_prefs` | `store/bluesky.js` | Cached Bluesky content preferences (muted words, hidden posts, feed-view settings) from `getPreferences`, so filtering applies on first paint |
| `mc_communities` | `store/communities.js` | Selected community slugs (JSON array) |
| `mc_visible_tabs` | `store/tabs.js` | Tab visibility toggles (JSON object) |
| `mc_active_tab` | `store/tabs.js` | Currently active tab (default: `digest`) |
| `mc_theme` | `store/theme.js` | Theme preference: `light`, `dark`, or `system` |

### Key constraints

- `base: ''` in vite.config.js -- Chrome extensions need relative paths
- Supabase env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` must be set at build time
- Communities fetched from scenius-digest API at https://scenius-digest.vercel.app/api/groups
- Digest links cached with 1-hour TTL, Bluesky posts cached with 5-minute TTL (cache key includes feed URI, time window, and sort; reposts + content-preference filtering are applied at render, not baked into the cache)
- Bluesky timeline filtered to followed users only (`author.viewer.following`); reposts kept or hidden based on user setting
- Bluesky pagination: 2 pages for 24h, 6 for 7d, 10 for 30d — stops early when posts fall outside window
- DigestCard prefers `og_title` over `title`, `og_description` over `description`, shows `og_image` thumbnail when available
- All feeds degrade gracefully -- the Network feed requires Bluesky OAuth (connect at the Network tab) but digest and participation work without it; broken OG images are hidden via `onError` handler
- **Standing availability is written straight to the member's own PDS** (`store/availability.js`, #49) — no avails API, no community-admin write. Two independent apps on one user-owned record with nothing between them is what makes the ATProto bet real here. It works today because MC's OAuth already asks for `atproto transition:generic`, which covers writes to any collection. **Do NOT narrow that scope without first versioning MC's `client_id`**, which is unversioned (`${CA_URL}/oauth/client-metadata.json`): a PDS caches the grant per client_id and will not re-prompt on a scope change, so writes start failing with `ScopeMissingError` and the member is never asked to re-authorize (avails#49). Two things must stay in step with avails: the **rkey is derived** — `sha256("<scope.type>\n<scope.value>")`, hex, first 24 chars, matching `rkeyForScope` in avails' `server/src/routes/availability.js` — so this uses `putRecord` at that key, and a random rkey or `createRecord` would leave a new permanent public record on every republish; and the **scope is the community** (`{type:'ca-community', value: community_id}`) unless the proposal carries an explicit `scope_uri`, because a per-proposal list would make a "standing" record something the member re-publishes per proposal (community-admin#126, avails#170). `trust` is always written as `'confirm'` — avails returns confirm-members separately and never commits them, so the call still books, and auto-booking is a larger promise than a member can give while answering one proposal.
- **Every host and identity in `src/lib/config.js` is baked in at build time, and this extension is sideload-only** -- an install updates when its user rebuilds by hand, which may be never. So a value here going stale is not a deploy away from fixed: `CA_URL`, `CA_HOST`, `CA_DID`, `AVAILS_URL`. When community-admin flipped `API_URL`, both sign-in doors broke for every installed copy (#84) because the `client_id` in its metadata document stopped matching. Treat these as **pinned by contract**: change them only alongside a server-side grace list (`CA_ACCEPTED_DIDS`, the `MC_EXTENSION_REDIRECT` allowlist) that keeps the old value working, and never assume "the server moved so we move too" -- the server can accept both, this cannot. Rule + episodes: cibc-brain `decisions/2026-08-03-identifiers-accept-a-set-during-migration.md` (D-08).

## Related Projects

- **Dear Neighbors** (`../dear-neighbors/`) -- parent project (neighborhood dashboard)
- **Scenius Digest** (`../scenius-digest/`) -- digest data source
- **Harmonica** (`../harmonica-web-app/`) -- session source
- **Community Admin** (`../community-admin/`) -- shared admin platform for community organizers (Citizen-Infra)
- **Navidrome Jam** (`../navidrome-jam/`) -- live jam rooms shown as banners in participation feed
- **NSRT** (`../nsrt/`) -- parent ecosystem
