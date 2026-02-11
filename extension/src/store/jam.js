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
