# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**My Community** -- Chrome extension that replaces the new tab page with a community dashboard. Three toggleable feeds: Bluesky Network (popular posts from people you follow), Community Digest (curated links from scenius-digest), and Participation (sessions + Luma events). Part of the Citizen Infrastructure ecosystem.

Forked from dear-neighbors, replacing location-based content with community-scoped feeds.

## Skills

Always use the `frontend-design` skill for visual/UI tasks: icons, component design, styling, layout changes.

## Commands

```bash
cd extension && npm run build   # Production build -> dist/
cd extension && npm run dev     # Vite dev server
```

After building, reload at `chrome://extensions` (Developer mode, Load unpacked -> `extension/dist/`).

No linting or test framework configured.

## Architecture

### Stack

- **Preact + @preact/signals** -- reactive UI
- **Vite** -- build tool, `base: ''` for Chrome extension relative paths
- **@supabase/supabase-js** -- sessions data
- **ATproto API** -- Bluesky authentication and feed access (app passwords)

### Single entry point

`src/newtab.html` -> tabbed dashboard (App component). No toolbar popup.

### Data Sources

| Feed | Source | Auth required |
|------|--------|--------------|
| Bluesky Network | ATproto API (getTimeline / getFeed) | Yes (app password) |
| Community Digest | scenius-digest API (GET /api/links), includes OG metadata | No |
| Participation | Supabase sessions + Luma API | No |

### State management

Signals-based stores in `src/store/`:
- `auth.js` -- Bluesky app password auth (createSession), session persistence
- `bluesky.js` -- timeline fetching, feed selection, engagement sorting
- `communities.js` -- community selection from scenius-digest /api/groups
- `digest.js` -- digest links from scenius-digest API, cached
- `sessions.js` -- Supabase sessions + Luma events, merged
- `tabs.js` -- tab visibility and active tab state
- `theme.js` -- light/dark/system theme

### Libraries

- `lib/atproto.js` -- ATproto session management, authenticated fetch
- `lib/luma.js` -- Luma calendar event fetching
- `lib/supabase.js` -- Supabase client

### Components

- `TopBar.jsx` -- branding + settings gear
- `TabBar.jsx` -- horizontal tab navigation
- `BlueskyFeed.jsx` + `BlueskyPostCard.jsx` -- Bluesky timeline
- `DigestFeed.jsx` + `DigestCard.jsx` -- community digest links (OG thumbnail support)
- `SessionsPanel.jsx` -- participation opportunities (sessions + Luma)
- `SettingsModal.jsx` -- communities, Bluesky account, tab toggles, theme

### Design system

- **Typography**: `--font-display: 'Instrument Serif'` (headings, brand), `--font-body: 'DM Sans'` (body text). Loaded via Google Fonts in `newtab.html`.
- **Palette**: Warm editorial -- cream background (`#f8f6f1`), stone text colors, amber primary (`#c4841d`). Dark mode uses warm near-black (`#151311`).
- **Cards**: `card-enter` stagger animation on load, hover lift with shadow transition.

### localStorage keys

All keys prefixed with `mc_`:

| Key | Store | Description |
|-----|-------|-------------|
| `mc_bluesky_session` | `lib/atproto.js` | ATproto session (DID, handle, tokens) |
| `mc_bluesky_feed` | `store/bluesky.js` | Selected feed URI (default: `timeline`) |
| `mc_bluesky_window` | `store/bluesky.js` | Time window filter (default: `24h`) |
| `mc_communities` | `store/communities.js` | Selected community slugs (JSON array) |
| `mc_visible_tabs` | `store/tabs.js` | Tab visibility toggles (JSON object) |
| `mc_active_tab` | `store/tabs.js` | Currently active tab (default: `digest`) |
| `mc_theme` | `store/theme.js` | Theme preference: `light`, `dark`, or `system` |

### Key constraints

- `base: ''` in vite.config.js -- Chrome extensions need relative paths
- Supabase env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` must be set at build time
- Communities fetched from scenius-digest API at https://scenius-digest.vercel.app/api/groups
- Digest links cached with 1-hour TTL, Bluesky posts cached with 5-minute TTL
- DigestCard prefers `og_title` over `title`, `og_description` over `description`, shows `og_image` thumbnail when available
- All feeds degrade gracefully -- Bluesky requires auth but digest and participation work without it; broken OG images are hidden via `onError` handler

## Related Projects

- **Dear Neighbors** (`../dear-neighbors/`) -- parent project (neighborhood dashboard)
- **Scenius Digest** (`../scenius-digest/`) -- digest data source
- **Harmonica** (`../harmonica-web-app/`) -- session source
- **NSRT** (`../nsrt/`) -- parent ecosystem
