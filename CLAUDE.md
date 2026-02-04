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
| Community Digest | scenius-digest API (GET /api/links) | No |
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
- `DigestFeed.jsx` + `DigestCard.jsx` -- community digest links
- `SessionsPanel.jsx` -- participation opportunities (sessions + Luma)
- `SettingsModal.jsx` -- communities, Bluesky account, tab toggles, theme

## Key Constraints

- `base: ''` in vite.config.js -- Chrome extensions need relative paths
- Supabase env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` must be set at build time
- ATproto app passwords stored in localStorage under `mc_bluesky_session`
- All localStorage keys prefixed with `mc_`
- Communities fetched from scenius-digest API at https://scenius-digest.vercel.app/api/groups
- Digest links cached with 1-hour TTL, Bluesky posts cached with 5-minute TTL

## Related Projects

- **Dear Neighbors** (`../dear-neighbors/`) -- parent project (neighborhood dashboard)
- **Scenius Digest** (`../scenius-digest/`) -- digest data source
- **Harmonica** (`../harmonica-web-app/`) -- session source
- **NSRT** (`../nsrt/`) -- parent ecosystem
