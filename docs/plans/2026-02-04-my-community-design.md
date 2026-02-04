# My Community — Design Document

**Date:** 2026-02-04
**Status:** Approved
**Parent project:** dear-neighbors (fork)

## Overview

Chrome extension that replaces the new tab page with a community dashboard. Three toggleable tabs: Bluesky Network, Community Digest, and Participation Opportunities. Part of the Citizen Infrastructure ecosystem.

Key differences from dear-neighbors:
- **ATproto OAuth** (optional) replaces Supabase magic link auth
- **Community-scoped** content replaces location/neighborhood-based content
- **Three tabbed feeds** replace the two-column layout
- **No link submission** — content comes from external sources (scenius-digest, Bluesky, Luma)

## Architecture

### Stack

Same as dear-neighbors: Preact + @preact/signals, Vite, Chrome extension manifest v3. Supabase for sessions only. No `api/` directory — consumes external APIs.

### Data Sources

| Feed | Source | Auth required |
|------|--------|--------------|
| Bluesky Network | ATproto API (`app.bsky.feed.getTimeline` or feed generators) | Yes (ATproto OAuth) |
| Community Digest | scenius-digest API (`GET /api/links?group=<id>`) | No |
| Participation | Supabase sessions + Luma API (community calendars) | No |

### What's Removed from Dear Neighbors

- Neighborhood/location hierarchy (replaced by community selection)
- Link submission UI (popup + inline form)
- Toolbar popup entry point entirely
- Voting system
- Environment badges (AQI/UV)
- Content language filter

### What's Kept

- Preact + Signals state management pattern
- Theme system (light/dark/system)
- Settings modal structure
- Supabase client (for sessions)

## Onboarding

Single-screen, no wizard. Two optional steps shown together:

1. **Pick communities** (multi-select chips) — fetched from scenius-digest `/api/groups`. Required to see digest and participation tabs.
2. **Connect Bluesky** (button) — initiates ATproto OAuth. Optional. Enables the network tab.

If the user skips everything, they see inline prompts in the tab area. No blocking modal.

## Settings Modal

- **Account:** Bluesky connection status (connect/disconnect), display handle
- **Communities:** Multi-select chips, toggle each on/off
- **Feed tabs:** Checkboxes for which tabs are visible (Network / Digest / Participation)
- **Bluesky feed:** Dropdown to pick feed generator (default: "Popular from timeline", or any subscribed feed)
- **Theme:** Light/dark/system (unchanged)

## Storage Keys

All prefixed with `mc_`:

- `mc_communities` — selected community IDs
- `mc_bluesky_session` — encrypted ATproto session tokens
- `mc_visible_tabs` — which tabs are enabled
- `mc_bluesky_feed` — selected feed generator URI
- `mc_theme_preference`

## The Three Feeds

Tab bar sits below the top bar. Only enabled tabs are shown. User picks default tab in settings; falls back to first available.

### Tab 1: Bluesky Network

- **Default mode:** Fetches user's timeline via `app.bsky.feed.getTimeline`, sorts by engagement (likes + reposts + replies) within a configurable window (24h / 7 days / 30 days).
- **Feed generator mode:** User picks a subscribed feed. Displayed as-is (feed generator handles ranking).
- **Post card:** Author avatar + handle, post text (truncated), embed preview (images/links), engagement counts, timestamp. Clicking opens the post on Bluesky in a new tab.
- **Hidden when:** Bluesky not connected. Tab disappears entirely.
- **Refresh:** On new tab open + manual refresh button. Cache posts in localStorage to avoid rate limits.

### Tab 2: Community Digest

- **Source:** `GET /api/links?group=<id>` for each selected community.
- **Grouping:** Grouped by community, then by topic (using scenius-digest's emoji mapping).
- **Card:** Title, URL (domain shown), description snippet, shared by attribution, timestamp. Clicking opens URL in new tab.
- **Refresh:** Poll on new tab open, cache with 1-hour TTL.
- **Empty state:** "No recent links from your communities" with link to settings.

### Tab 3: Participation

Two data sources merged into one feed:
- **Sessions** — from Supabase (Harmonica, Polis, etc.), filtered by community
- **Luma events** — from community Luma calendars via Luma API

**Unified grouping:** Live Now > Upcoming > Past. Both sessions and Luma events sorted by start time. Source badge distinguishes type (Harmonica / Polis / Luma).

**Luma integration:** Community config includes optional `luma_url`. Extension fetches events via Luma's public API. Cached with 1-hour TTL.

## ATproto OAuth

### Flow

1. User clicks "Connect Bluesky" and enters their handle
2. Extension resolves handle to PDS via `com.atproto.identity.resolveHandle`
3. Opens PDS authorization page in a new tab
4. User approves, PDS redirects to callback URL
5. Service worker captures the auth code (same pattern as dear-neighbors magic link interception)
6. Extension exchanges code for session tokens
7. Tokens stored in `chrome.storage.local`, refreshed automatically

### Requirements

- Client metadata document hosted at a public HTTPS URL (Vercel or GitHub Pages)
- Read-only scopes: timeline + social graph
- Automatic token refresh (short-lived access tokens)

## Community Configuration

Currently sourced from scenius-digest `groups.json`. Each community has:

```json
{
  "name": "Sensemaking Scenius",
  "group_id": "-1002141367711",
  "luma_url": "https://lu.ma/scenius",
  "topics": ["links", "memes"]
}
```

MVP: users freely select from available communities. Future: community admin whitelisting.

Future enhancement: auto-detect communities via ATproto social graph (follows, starter packs).

## File Structure (New Repo)

```
my-community/
├── extension/
│   ├── public/
│   │   ├── background.js        # ATproto OAuth callback handler
│   │   ├── manifest.json         # "My Community" config
│   │   └── icons/
│   ├── src/
│   │   ├── app.jsx               # Tabbed layout
│   │   ├── index.jsx             # Entry point
│   │   ├── newtab.html
│   │   ├── components/
│   │   │   ├── TopBar.jsx
│   │   │   ├── TabBar.jsx        # NEW
│   │   │   ├── BlueskyFeed.jsx   # NEW
│   │   │   ├── DigestFeed.jsx    # NEW
│   │   │   ├── SessionsPanel.jsx # Modified (community-scoped + Luma)
│   │   │   ├── BlueskyPostCard.jsx # NEW
│   │   │   ├── DigestCard.jsx    # NEW
│   │   │   ├── EventCard.jsx     # NEW
│   │   │   └── SettingsModal.jsx # Modified
│   │   ├── store/
│   │   │   ├── auth.js           # ATproto OAuth (rewritten)
│   │   │   ├── communities.js    # NEW (replaces neighborhoods)
│   │   │   ├── digest.js         # NEW (replaces links)
│   │   │   ├── bluesky.js        # NEW
│   │   │   ├── sessions.js       # Modified (community-scoped + Luma)
│   │   │   └── theme.js          # Unchanged
│   │   ├── lib/
│   │   │   ├── atproto.js        # NEW — OAuth + API client
│   │   │   ├── luma.js           # NEW — Luma API client
│   │   │   └── supabase.js       # Kept for sessions
│   │   └── styles/
│   ├── package.json
│   └── vite.config.js
├── CLAUDE.md
├── README.md
└── CHANGELOG.md
```

## Build Sequence

1. Fork repo, strip removed files, rename
2. Community selection store + settings UI
3. Digest feed (scenius-digest API integration)
4. Participation feed (sessions + Luma)
5. ATproto OAuth flow
6. Bluesky network feed
7. Polish: theme, empty states, caching, onboarding prompts
