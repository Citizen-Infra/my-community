# My Community

Chrome extension that replaces the new tab page with a community dashboard. Three toggleable feeds keep you connected without context-switching.

## Feeds

- **Bluesky Network** — Popular posts from people you follow, sorted by engagement. Connect with an app password.
- **Community Digest** — Curated links from your communities, sourced from [scenius-digest](https://github.com/sensemaking-scenius/scenius-digest). Rich previews with OG thumbnails.
- **Participation** — Upcoming sessions (Harmonica, Polis) and Luma events from your communities.

All tabs are toggleable in settings. The extension works without Bluesky — digest and participation feeds require no authentication.

## Install

1. Clone and build:
   ```bash
   cd extension && npm install && npm run build
   ```
2. Open `chrome://extensions`, enable Developer mode
3. Click "Load unpacked" and select the `extension/dist/` folder

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

## Related

- [Dear Neighbors](https://github.com/Citizen-Infra/dear-neighbors) — parent project (neighborhood dashboard)
- [Scenius Digest](https://github.com/sensemaking-scenius/scenius-digest) — digest data source
- [Harmonica](https://harmonica.chat/) — structured deliberation sessions

Part of the [Citizen Infrastructure](https://github.com/Citizen-Infra) ecosystem.
