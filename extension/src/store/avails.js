import { computed, signal } from '@preact/signals';
import { AVAILS_URL } from '../lib/config';
import { authHeader, caSubject } from './caAuth';
import { selectedCommunities } from './communities';
import { deploymentConfig } from '../lib/deployment-config';
import { availsFeedNeedsAuth, pollsForAccount } from '../lib/avails-preview';

const AVAILS_API = `${AVAILS_URL}/api/polls`;
const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

export const availsPolls = signal([]);
const loadedSubject = signal(null);
export const visibleAvailsPolls = computed(() => pollsForAccount(availsPolls.value, loadedSubject.value, caSubject.value));

let pollTimer = null;
let loadVersion = 0;

export async function loadAvailsPolls(communityIds) {
  const version = ++loadVersion;
  const subject = caSubject.value;
  try {
    const privateIds = new Set(selectedCommunities.value
      .filter((community) => availsFeedNeedsAuth(community, deploymentConfig.linksRequireSignIn))
      .map((community) => community.id));
    const headers = communityIds.some((id) => privateIds.has(id)) ? await authHeader() : {};
    if (version !== loadVersion || subject !== caSubject.value) return;
    const promises = communityIds.map((id) =>
      fetch(`${AVAILS_API}?community=${encodeURIComponent(id)}&status=open&published=1`, {
        headers: privateIds.has(id) ? headers : {},
      })
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

    if (version === loadVersion && subject === caSubject.value) {
      loadedSubject.value = subject;
      availsPolls.value = polls;
    }
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
  loadedSubject.value = null;
  availsPolls.value = [];
}
