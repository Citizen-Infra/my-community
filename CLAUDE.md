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

Bump version in `extension/package.json`, update changelog in `README.md`, commit, tag `v*`, push tag. GitHub Actions (`package.yml`) builds a `.zip` and attaches it to the GitHub Release.

```bash
git tag v0.1.3 && git push origin v0.1.3   # Triggers release workflow
./scripts/package-zip.sh                    # Local: build + create .zip
./scripts/package-zip.sh --skip-build       # Use existing dist/
```

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
- `bluesky.js` -- timeline fetching with pagination, follow-only filter, reposts toggle, sort by likes or weighted engagement
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
| `mc_bluesky_feed` | `store/bluesky.js` | Selected feed URI (default: `timeline`) |
| `mc_bluesky_window` | `store/bluesky.js` | Time window filter (default: `24h`) |
| `mc_bluesky_reposts` | `store/bluesky.js` | Show reposts toggle (default: `true`) |
| `mc_bluesky_weighted` | `store/bluesky.js` | Weighted engagement sort (default: `false`) |
| `mc_communities` | `store/communities.js` | Selected community slugs (JSON array) |
| `mc_visible_tabs` | `store/tabs.js` | Tab visibility toggles (JSON object) |
| `mc_active_tab` | `store/tabs.js` | Currently active tab (default: `digest`) |
| `mc_theme` | `store/theme.js` | Theme preference: `light`, `dark`, or `system` |

### Key constraints

- `base: ''` in vite.config.js -- Chrome extensions need relative paths
- Supabase env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` must be set at build time
- Communities fetched from scenius-digest API at https://scenius-digest.vercel.app/api/groups
- Digest links cached with 1-hour TTL, Bluesky posts cached with 5-minute TTL (cache key includes feed URI, time window, reposts, and sort settings)
- Bluesky timeline filtered to followed users only (`author.viewer.following`); reposts kept or hidden based on user setting
- Bluesky pagination: 2 pages for 24h, 6 for 7d, 10 for 30d — stops early when posts fall outside window
- DigestCard prefers `og_title` over `title`, `og_description` over `description`, shows `og_image` thumbnail when available
- All feeds degrade gracefully -- the Network feed requires Bluesky OAuth (connect at the Network tab) but digest and participation work without it; broken OG images are hidden via `onError` handler

## Related Projects

- **Dear Neighbors** (`../dear-neighbors/`) -- parent project (neighborhood dashboard)
- **Scenius Digest** (`../scenius-digest/`) -- digest data source
- **Harmonica** (`../harmonica-web-app/`) -- session source
- **Community Admin** (`../community-admin/`) -- shared admin platform for community organizers (Citizen-Infra)
- **Navidrome Jam** (`../navidrome-jam/`) -- live jam rooms shown as banners in participation feed
- **NSRT** (`../nsrt/`) -- parent ecosystem
