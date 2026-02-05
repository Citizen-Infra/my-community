# My Community

Chrome extension that replaces the new tab page with a community dashboard. Three toggleable feeds keep you connected without context-switching.

## Feeds

- **Community Digest** — Curated links from your communities with rich previews (OG thumbnails, descriptions), sourced from [scenius-digest](https://github.com/sensemaking-scenius/scenius-digest).
- **Bluesky Network** — Popular posts from people you follow, sorted by likes. Connect with an app password. Configurable time window (24h/7d/30d), reposts toggle, and weighted engagement sort.
- **Participation** — Upcoming opportunities to participate: sensemaking sessions, deliberations, voting, community events.

All tabs are toggleable in settings. The extension works without Bluesky — digest and participation feeds require no authentication.

## Install

Download the latest release zip from [Releases](https://github.com/Citizen-Infra/my-community/releases), extract it, then:

1. Open `chrome://extensions`, enable Developer mode
2. Click "Load unpacked" and select the extracted folder

### Build from source

```bash
cd extension && npm install && npm run build
```

Then load `extension/dist/` as an unpacked extension.

### Environment

Supabase credentials must be set at build time (for sessions data):

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Stack

- [Preact](https://preactjs.com/) + [@preact/signals](https://preactjs.com/guide/v10/signals/) — reactive UI
- [Vite](https://vitejs.dev/) — build tool
- [ATproto API](https://atproto.com/) — Bluesky authentication and feeds
- [Supabase](https://supabase.com/) — sessions data
- [Luma API](https://lu.ma/) — community events

## Changelog

### [0.1.1] - 2026-02-05
- Bluesky saved feeds selection — choose from your pinned feeds in Settings
- Time window filtering and sorting now applies to all feeds (not just Following)
- Community origin indicators on Digest cards — color-coded badges and left accent bar
- Share to Bluesky button on Digest cards — opens Bluesky compose with pre-filled text
- Reorganized Settings modal — Bluesky, Digest, and Participation sections with inline visibility toggles

### [0.1.0] - 2026-02-04
- Community dashboard replacing Chrome new tab page
- Community Digest feed with OG metadata thumbnails (title, description, image)
- Bluesky feed — follow-only filter, paginated time windows (24h/7d/30d), sort by likes or weighted engagement
- Multi-community selection from Telegram groups that have scenius-digest bot installed
- Bluesky app password authentication
- Show reposts and weighted engagement sort toggles
- Light/dark/system theme
- All tabs toggleable in settings

## Related

- [Dear Neighbors](https://github.com/Citizen-Infra/dear-neighbors) — parent project (neighborhood dashboard)
- [Scenius Digest](https://github.com/sensemaking-scenius/scenius-digest) — digest data source

Part of the [Citizen Infrastructure](https://github.com/Citizen-Infra) ecosystem.
