import { signal } from '@preact/signals';

const AVAILS_API = 'https://avails.zhgnv.com/api/polls';
const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

export const availsPolls = signal([]);

let pollTimer = null;

export async function loadAvailsPolls(communityIds) {
  try {
    const promises = communityIds.map((id) =>
      fetch(`${AVAILS_API}?community=${encodeURIComponent(id)}&status=open&published=1`)
        .then((r) => (r.ok ? r.json() : { polls: [] }))
        .catch(() => ({ polls: [] }))
    );
    const results = await Promise.all(promises);

    const seen = new Set();
    const polls = [];
    for (const result of results) {
      for (const poll of result.polls || []) {
        const key = `${poll.did}/${poll.rkey}`;
        if (!seen.has(key)) {
          seen.add(key);
          polls.push(poll);
        }
      }
    }

    availsPolls.value = polls;
  } catch (err) {
    console.error('Failed to load avails polls:', err);
  }
}

export function startAvailsPolling(communityIds) {
  stopAvailsPolling();
  if (communityIds.length === 0) return;
  loadAvailsPolls(communityIds);
  pollTimer = setInterval(() => loadAvailsPolls(communityIds), POLL_INTERVAL);
}

export function stopAvailsPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  availsPolls.value = [];
}
