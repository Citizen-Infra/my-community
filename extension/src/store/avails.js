import { signal } from '@preact/signals';
import { AVAILS_URL } from '../lib/config';
import { authHeader, caSubject } from './caAuth';

const AVAILS_API = `${AVAILS_URL}/api/polls`;
const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

export const availsPolls = signal([]);

let pollTimer = null;
let loadVersion = 0;

export async function loadAvailsPolls(communityIds) {
  const version = ++loadVersion;
  const subject = caSubject.value;
  try {
    const headers = await authHeader();
    if (version !== loadVersion || subject !== caSubject.value) return;
    const promises = communityIds.map((id) =>
      fetch(`${AVAILS_API}?community=${encodeURIComponent(id)}&status=open&published=1`, { headers })
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

    if (version === loadVersion && subject === caSubject.value) availsPolls.value = polls;
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
  loadVersion += 1;
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  availsPolls.value = [];
}
