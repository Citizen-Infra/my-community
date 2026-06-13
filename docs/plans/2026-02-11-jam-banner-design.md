# Jam Banner — Live Navidrome Jam Rooms in Participation Feed

**Date:** 2026-02-11
**Projects:** my-community, navidrome-jam

## Goal

Show a banner at the top of My Community's Participation tab when a member of the user's selected community is hosting a room in Navidrome Jam. No music streaming — just awareness that a communal listening session is happening, with a link to join.

## Design Decisions

- Community tag on rooms is **optional** — not every jam session is community-related
- Available communities fetched from **scenius-digest `/api/groups`** — single source of truth, same as my-community
- **No user count** displayed — avoids discouraging joins on small rooms
- **2-minute polling interval** for active rooms
- Banner **disappears** when no matching rooms are active
- Visual design references **both** navidrome-jam's visual language and my-community's design system (use `frontend-design` skill during implementation)

## Changes: Navidrome Jam

### Server — Room Model (`server/src/roomManager.js`)

Add optional `community` field (string, nullable) to the Room class:

```js
// In Room constructor
this.community = community || null;
```

### Server — API Routes (`server/src/index.js`)

**`POST /api/rooms`** — accept optional `community` in request body:

```js
const { community } = req.body;
// Pass to Room constructor
```

**`GET /api/rooms`** — add optional `?community=` query param filter:

```js
// If ?community=scenius, return only rooms where room.community === 'scenius'
// If no param, return all rooms (existing behavior)
```

**`GET /api/rooms`** — include `community` in response:

```json
{
  "rooms": [
    {
      "id": "ABC123",
      "hostName": "Artem",
      "community": "scenius",
      "currentTrack": { "title": "...", "artist": "...", "playing": true },
      "createdAt": 1234567890
    }
  ]
}
```

### Client — Room Creation UI

- Fetch communities from `https://scenius-digest.vercel.app/api/groups` on room creation form load
- Add optional "Community" dropdown, default "None"
- Send `community` field with `POST /api/rooms` if selected
- Store last selected community in localStorage for convenience

### Not Changing

- No Socket.io event changes
- No changes to playback, queue, or sync logic
- No changes to user registration or invite system

## Changes: My Community

### New Store — `store/jam.js`

Signals:
- `jamRooms` — array of active rooms matching selected communities

Functions:
- `loadJamRooms(communityIds)` — for each community ID, fetch `GET https://jam.zhgnv.com/api/rooms?community={id}`, merge and deduplicate results
- `startJamPolling(communityIds)` — call `loadJamRooms` immediately, then every 2 minutes
- `stopJamPolling()` — clear the interval

Data shape used from API:

```js
{
  id: "ABC123",          // room code, used to build join link
  hostName: "Artem",     // displayed in banner
  community: "scenius",  // for community badge (if multiple communities selected)
  currentTrack: {
    title: "Song Name",
    artist: "Artist",
    playing: true
  }
}
```

### New Component — `components/JamBanner.jsx`

Rendered at the top of `SessionsPanel.jsx`, above the session groups. Only visible when `jamRooms` has items.

Per room, a compact banner row:
- **Left:** music/headphones icon + "Jam" label
- **Center:** "[HostName] is listening to [Track — Artist]" (or "[HostName] has a room open" if nothing playing)
- **Right:** "Join" link → opens `https://jam.zhgnv.com/room/{id}` in new tab
- **Community badge** shown when user has multiple communities selected

Multiple rooms stack vertically. Whole section disappears when empty.

### New Styles — `styles/jam.css`

Designed with `frontend-design` skill referencing navidrome-jam's visual language while fitting my-community's warm editorial palette.

### Modified — `components/SessionsPanel.jsx`

Import `JamBanner` and render it at the top of the panel, before the session groups.

### Modified — `app.jsx`

Start/stop jam polling alongside session loading when selected communities change.

### Not Changing

- No changes to existing session cards, events API, or digest feed
- No changes to community selection logic or settings
- No new dependencies
