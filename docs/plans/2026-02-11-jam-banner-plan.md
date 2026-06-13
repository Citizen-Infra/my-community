# Jam Banner Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show live Navidrome Jam rooms in My Community's Participation tab, filtered by community tag.

**Architecture:** Add optional `community` field to NJ room model and API, then poll from My Community and display as a banner. Two independent projects modified: navidrome-jam (server + client) and my-community (new store + component).

**Tech Stack:** Express/Node (NJ server), React 19 (NJ client), Preact + Signals (MC), CSS

---

### Task 1: NJ Server — Add community to room model and API

**Files:**
- Modify: `navidrome-jam/server/src/roomManager.js:18-44` (createRoom + listRooms)
- Modify: `navidrome-jam/server/src/index.js:107-109` (GET /api/rooms), `111-137` (POST /api/rooms)

**Step 1: Add community param to createRoom**

In `navidrome-jam/server/src/roomManager.js`, change the `createRoom` method signature and room object:

```javascript
// Line 18: change signature
createRoom(roomId = null, hostName = 'Host', community = null) {

// Line 25-39: add community to room object
const room = {
  id,
  hostId: null,
  hostName,
  community: community || null,   // <-- add this line
  coHosts: [],
  users: [],
  queue: [],
  playbackState: {
    trackId: null,
    position: 0,
    playing: false,
    timestamp: Date.now()
  },
  createdAt: Date.now()
};
```

**Step 2: Include community in listRooms response**

In `navidrome-jam/server/src/roomManager.js`, add `community` to the `listRooms` map at line 64:

```javascript
listRooms() {
  return Array.from(this.rooms.values()).map(room => ({
    id: room.id,
    hostName: room.hostName,
    community: room.community,       // <-- add this line
    userCount: room.users.length,
    currentTrack: room.playbackState.trackId ? {
      title: room.queue.find(t => t.id === room.playbackState.trackId)?.title || null,
      artist: room.queue.find(t => t.id === room.playbackState.trackId)?.artist || null,
      playing: room.playbackState.playing
    } : null,
    createdAt: room.createdAt
  }));
}
```

**Step 3: Add community filter to GET /api/rooms**

In `navidrome-jam/server/src/index.js`, change the GET handler at line 107:

```javascript
app.get('/api/rooms', (req, res) => {
  let rooms = roomManager.listRooms();
  const { community } = req.query;
  if (community) {
    rooms = rooms.filter(r => r.community === community);
  }
  res.json({ rooms });
});
```

**Step 4: Accept community in POST /api/rooms**

In `navidrome-jam/server/src/index.js`, change the POST handler at line 111:

```javascript
app.post('/api/rooms', createRoomLimiter, (req, res) => {
  try {
    const { roomId, hostName, community } = req.body;   // <-- add community

    // Validate roomId
    const roomIdValidation = validateRoomId(roomId);
    if (!roomIdValidation.valid) {
      return res.status(400).json({ error: roomIdValidation.error });
    }

    // Sanitize hostName to prevent XSS
    const sanitizedHostName = sanitizeString(hostName, 50) || 'Host';

    // Sanitize community tag
    const sanitizedCommunity = community ? sanitizeString(community, 50) : null;

    // Create room
    const room = roomManager.createRoom(roomId || null, sanitizedHostName, sanitizedCommunity);

    res.status(201).json({ room });
  } catch (error) {
    // ... existing error handling unchanged
  }
});
```

**Step 5: Verify manually**

```bash
cd navidrome-jam/server && npm run dev
# In another terminal:
curl -X POST http://localhost:3001/api/rooms -H "Content-Type: application/json" -d '{"hostName":"Test","community":"scenius"}'
curl http://localhost:3001/api/rooms
curl "http://localhost:3001/api/rooms?community=scenius"
curl "http://localhost:3001/api/rooms?community=nonexistent"
```

Expected: POST returns room with `community: "scenius"`. Unfiltered GET shows it. Filtered GET with `scenius` shows it. Filtered GET with `nonexistent` returns empty array.

**Step 6: Commit**

```bash
cd navidrome-jam
git add server/src/roomManager.js server/src/index.js
git commit -m "feat(server): add optional community tag to rooms

Rooms can now be tagged with a community ID on creation.
GET /api/rooms supports ?community= filter param."
```

---

### Task 2: NJ Client — Add community dropdown to room creation

**Files:**
- Modify: `navidrome-jam/client/src/services/jamClient.js:116-129` (createRoom method)
- Modify: `navidrome-jam/client/src/App.jsx:240-253` (handleCreateRoom), `786-814` (room creation form)

**Step 1: Accept community param in jamClient.createRoom**

In `navidrome-jam/client/src/services/jamClient.js`, change line 116:

```javascript
async createRoom(roomId = null, hostName = null, community = null) {
  const response = await fetch(`${this.serverUrl}/api/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId, hostName, community })
  });
```

**Step 2: Add community state and fetch in App.jsx**

Near the top of `App.jsx` where other state is declared (around lines 19-30), add:

```javascript
const [communities, setCommunities] = useState([]);
const [selectedCommunity, setSelectedCommunity] = useState(
  () => localStorage.getItem('jam_community') || ''
);
```

Add a useEffect to fetch communities when on the room screen (after existing auth effects):

```javascript
useEffect(() => {
  if (isAuthenticated && !currentRoom) {
    fetch('https://scenius-digest.vercel.app/api/groups')
      .then(r => r.ok ? r.json() : {})
      .then(data => {
        const list = Object.entries(data).map(([id, info]) => ({
          id,
          name: info.name || id
        }));
        setCommunities(list);
      })
      .catch(() => {});
  }
}, [isAuthenticated, currentRoom]);
```

**Step 3: Pass community to handleCreateRoom**

In `App.jsx` at line 240, update `handleCreateRoom`:

```javascript
const handleCreateRoom = async () => {
  setIsCreatingRoom(true);
  setRoomError('');

  try {
    const community = selectedCommunity || null;
    const room = await jamClient.createRoom(null, username, community);
    setRoomInput(room.id);
    jamClient.joinRoom(room.id, username);
  } catch (error) {
    setRoomError(error.message);
  } finally {
    setIsCreatingRoom(false);
  }
};
```

**Step 4: Add dropdown to room creation form**

In `App.jsx` at line 806-813, add a community select before the "Create New Room" button:

```jsx
{communities.length > 0 && (
  <div className="community-select-group">
    <label className="community-label">Community (optional)</label>
    <select
      className="win98-select"
      value={selectedCommunity}
      onChange={(e) => {
        setSelectedCommunity(e.target.value);
        localStorage.setItem('jam_community', e.target.value);
      }}
      disabled={isCreatingRoom || isJoiningRoom}
    >
      <option value="">None</option>
      {communities.map(c => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  </div>
)}
<button
  className="win98-btn"
  onClick={handleCreateRoom}
  disabled={!isConnected || isCreatingRoom || isJoiningRoom}
>
  {isCreatingRoom ? 'Creating...' : 'Create New Room'}
</button>
```

**Step 5: Use `frontend-design` skill**

Invoke `frontend-design` to style the community dropdown consistent with NJ's Win98 aesthetic. The `win98-select` class needs to match the existing input/button styles. Check `client/src/App.css` for existing `.win98-input` and `.win98-btn` styles.

**Step 6: Verify manually**

```bash
cd navidrome-jam/client && npm run dev
# Open http://localhost:5173, login, verify:
# - Community dropdown appears with fetched communities
# - "None" is default
# - Creating room with a community selected tags the room
# - Active rooms list still works
```

**Step 7: Commit**

```bash
cd navidrome-jam
git add client/src/services/jamClient.js client/src/App.jsx client/src/App.css
git commit -m "feat(client): add community dropdown to room creation

Fetches available communities from scenius-digest groups API.
Optional dropdown lets hosts tag rooms with a community.
Selection persisted in localStorage."
```

---

### Task 3: MC — Add jam store with polling

**Files:**
- Create: `my-community/extension/src/store/jam.js`

**Step 1: Create the jam store**

```javascript
import { signal } from '@preact/signals';

const JAM_API = 'https://navidrome-jam-production.up.railway.app/api/rooms';
const POLL_INTERVAL = 2 * 60 * 1000; // 2 minutes

export const jamRooms = signal([]);

let pollTimer = null;

export async function loadJamRooms(communityIds) {
  try {
    const promises = communityIds.map((id) =>
      fetch(`${JAM_API}?community=${encodeURIComponent(id)}`)
        .then((r) => (r.ok ? r.json() : { rooms: [] }))
        .catch(() => ({ rooms: [] }))
    );
    const results = await Promise.all(promises);

    const seen = new Set();
    const rooms = [];
    for (const result of results) {
      for (const room of result.rooms || []) {
        if (!seen.has(room.id)) {
          seen.add(room.id);
          rooms.push(room);
        }
      }
    }

    jamRooms.value = rooms;
  } catch (err) {
    console.error('Failed to load jam rooms:', err);
  }
}

export function startJamPolling(communityIds) {
  stopJamPolling();
  if (communityIds.length === 0) return;
  loadJamRooms(communityIds);
  pollTimer = setInterval(() => loadJamRooms(communityIds), POLL_INTERVAL);
}

export function stopJamPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  jamRooms.value = [];
}
```

**Step 2: Commit**

```bash
cd my-community
git add extension/src/store/jam.js
git commit -m "feat: add jam store with 2-min polling for active rooms"
```

---

### Task 4: MC — Add JamBanner component and styles

**Files:**
- Create: `my-community/extension/src/components/JamBanner.jsx`
- Create: `my-community/extension/src/styles/jam.css`

**Step 1: Use `frontend-design` skill**

Invoke `frontend-design` with the following context:
- Reference NJ's Win98 aesthetic (VT323 font, dark blue/space theme, pixel borders) from `navidrome-jam/client/src/App.css`
- Reference MC's warm editorial palette from `my-community/extension/src/styles/variables.css`
- The banner should feel like an NJ element transplanted into MC — recognizable but not jarring
- Compact: single row per room, music note icon, host name, track info, join link
- Should animate in/out smoothly

**Step 2: Create JamBanner component**

After getting the design from `frontend-design`, create `JamBanner.jsx`:

```jsx
import { jamRooms } from '../store/jam';
import { selectedCommunityIds } from '../store/communities';
import { getCommunityColors } from '../lib/community-colors';
import '../styles/jam.css';

export function JamBanner() {
  const rooms = jamRooms.value;
  if (rooms.length === 0) return null;

  const showCommunity = selectedCommunityIds.value.length > 1;

  return (
    <div class="jam-banner-container">
      {rooms.map((room) => {
        const colors = room.community ? getCommunityColors(room.community) : null;
        const trackText = room.currentTrack?.title
          ? `${room.currentTrack.title}${room.currentTrack.artist ? ` \u2014 ${room.currentTrack.artist}` : ''}`
          : null;

        return (
          <a
            key={room.id}
            class="jam-banner"
            href={`https://jam.zhgnv.com/room/${room.id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span class="jam-banner-icon">{'\u266B'}</span>
            <span class="jam-banner-text">
              <strong>{room.hostName}</strong>
              {trackText ? ` is listening to ${trackText}` : ' has a room open'}
            </span>
            {showCommunity && room.community && (
              <span
                class="jam-banner-community"
                style={colors ? { background: colors.bg, color: colors.text, borderColor: colors.border } : undefined}
              >
                {room.community}
              </span>
            )}
            <span class="jam-banner-join">Join</span>
          </a>
        );
      })}
    </div>
  );
}
```

**Step 3: Create jam.css**

Placeholder — actual styles come from `frontend-design` skill output. Minimum structure:

```css
.jam-banner-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 24px;
}

.jam-banner {
  /* Styled by frontend-design — NJ-inspired compact banner */
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  text-decoration: none;
  border-radius: 8px;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.jam-banner:hover {
  transform: translateY(-1px);
}

.jam-banner-icon {
  flex-shrink: 0;
}

.jam-banner-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.jam-banner-community {
  flex-shrink: 0;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid;
}

.jam-banner-join {
  flex-shrink: 0;
  font-weight: 600;
}
```

**Step 4: Commit**

```bash
cd my-community
git add extension/src/components/JamBanner.jsx extension/src/styles/jam.css
git commit -m "feat: add JamBanner component for live room display"
```

---

### Task 5: MC — Wire JamBanner into SessionsPanel and App

**Files:**
- Modify: `my-community/extension/src/components/SessionsPanel.jsx:1-10` (imports), `21-22` (render)
- Modify: `my-community/extension/src/app.jsx:6-7` (imports), `30-40` (effect)

**Step 1: Add JamBanner to SessionsPanel**

In `SessionsPanel.jsx`, add import at line 1:

```javascript
import { activeSessions, upcomingSessions, completedSessions, sessionsLoading } from '../store/sessions';
import { jamRooms } from '../store/jam';
import { JamBanner } from './JamBanner';
import { getCommunityColors } from '../lib/community-colors';
import '../styles/sessions.css';
```

Then render `<JamBanner />` at the top of the panel, right after the `<h2>` title at line 22:

```jsx
return (
  <div class="sessions-panel">
    <h2 class="section-title">Participation</h2>
    <JamBanner />

    {!hasAny && jamRooms.value.length === 0 ? (
      <div class="sessions-empty">
        No sessions or events right now. Check back soon.
      </div>
    ) : (
      // ... rest unchanged
    )}
  </div>
);
```

Note: Update the empty state check to also consider `jamRooms` — if there are jam rooms but no sessions, we still want to show the banner (not the "no sessions" empty state).

**Step 2: Start/stop polling in App.jsx**

In `app.jsx`, add import:

```javascript
import { startJamPolling, stopJamPolling } from './store/jam';
```

In the effect that watches `selectedCommunityIds` (line 30), add jam polling:

```javascript
useEffect(() => {
  if (!ready) return;
  const ids = selectedCommunityIds.value;
  if (ids.length > 0) {
    loadDigest(ids);
    loadSessions(selectedCommunities.value);
    startJamPolling(ids);
  } else {
    stopJamPolling();
  }
  return () => stopJamPolling();
}, [ready, selectedCommunityIds.value]);
```

**Step 3: Build and verify**

```bash
cd my-community/extension && npm run build
# Load extension in Chrome, open new tab
# Verify: no banner when no jam rooms active (normal state)
# To test: create a room in NJ dev with community tag, verify it appears
```

**Step 4: Commit**

```bash
cd my-community
git add extension/src/components/SessionsPanel.jsx extension/src/app.jsx
git commit -m "feat: wire JamBanner into participation feed with polling"
```

---

### Task 6: Deploy NJ server changes

**Step 1: Deploy to Railway**

```bash
cd navidrome-jam
npx @railway/cli up --detach
```

**Step 2: Verify production API**

```bash
curl https://navidrome-jam-production.up.railway.app/api/rooms
# Should return { rooms: [] } with no errors
```

**Step 3: No MC deploy needed** — extension runs locally after build + reload.
