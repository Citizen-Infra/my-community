import { computed, signal } from '@preact/signals';
import { AVAILS_URL } from '../lib/config';
import { authHeader, caSignedIn, caSubject } from './caAuth';
import { selectedCommunities } from './communities';
import { deploymentConfig } from '../lib/deployment-config';
import { availsFeedNeedsAuth, pollsForAccount, visibleAvailsCommunityIds } from '../lib/avails-preview';
import { accountCommunityKey, clearCached, getCached, getCachedStale, setCached } from '../lib/cache';

const AVAILS_API = `${AVAILS_URL}/api/polls`;
const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes
const CACHE_KEY = 'mc_avails_polls_cache';

export const availsPolls = signal([]);
const loadedSubject = signal(null);
const loadedSelector = signal(null);
export const visibleAvailsPolls = computed(() => {
  const visibleIds = visibleAvailsCommunityIds(selectedCommunities.value, {
    signedIn: caSignedIn.value,
    requireSignIn: deploymentConfig.linksRequireSignIn,
  });
  if (loadedSelector.value !== accountCommunityKey(caSubject.value, visibleIds)) return [];
  return pollsForAccount(availsPolls.value, loadedSubject.value, caSubject.value, visibleIds);
});

let pollTimer = null;
let loadVersion = 0;

export function hydrateAvailsPolls(communityIds, { allowStale = false } = {}) {
  loadVersion += 1;
  const subject = caSubject.value;
  const selector = accountCommunityKey(subject, communityIds);
  const cached = communityIds.length === 0 ? null : allowStale
    ? getCachedStale(CACHE_KEY, selector)
    : getCached(CACHE_KEY, POLL_INTERVAL, selector);
  loadedSubject.value = subject;
  loadedSelector.value = selector;
  availsPolls.value = Array.isArray(cached) ? cached : [];
  return Array.isArray(cached);
}

export async function loadAvailsPolls(communityIds) {
  const version = ++loadVersion;
  const subject = caSubject.value;
  const selector = accountCommunityKey(subject, communityIds);
  const cached = communityIds.length ? getCached(CACHE_KEY, POLL_INTERVAL, selector) : [];
  if (Array.isArray(cached)) {
    loadedSubject.value = subject;
    loadedSelector.value = selector;
    availsPolls.value = cached;
    return;
  }
  try {
    const privateIds = new Set(selectedCommunities.value
      .filter((community) => availsFeedNeedsAuth(community, deploymentConfig.linksRequireSignIn))
      .map((community) => community.id));
    const headers = communityIds.some((id) => privateIds.has(id)) ? await authHeader() : {};
    if (version !== loadVersion || subject !== caSubject.value) return;
    let denied = false;
    let failed = false;
    const promises = communityIds.map((id) =>
      fetch(`${AVAILS_API}?community=${encodeURIComponent(id)}&status=open&published=1`, {
        headers: privateIds.has(id) ? headers : {},
      })
        .then((r) => {
          if (r.status === 401 || r.status === 403) denied = true;
          else if (!r.ok) failed = true;
          return r.ok ? r.json() : { polls: [] };
        })
        .catch(() => { failed = true; return { polls: [] }; })
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
      if (denied) {
        clearCached(CACHE_KEY);
        loadedSelector.value = null;
        availsPolls.value = [];
        return;
      }
      if (failed) return; // Keep the last snapshot, but retry on the next open.
      loadedSubject.value = subject;
      loadedSelector.value = selector;
      availsPolls.value = polls;
      setCached(CACHE_KEY, polls, selector);
    }
  } catch (err) {
    console.error('Failed to load avails polls:', err);
  }
}

export function startAvailsPolling(communityIds) {
  stopAvailsPolling({ preserve: true });
  if (communityIds.length === 0) return;
  loadAvailsPolls(communityIds);
  pollTimer = setInterval(() => loadAvailsPolls(communityIds), POLL_INTERVAL);
}

export function stopAvailsPolling({ preserve = false } = {}) {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  // The overview still uses the last response (and may be fetching a newer
  // one). Stopping its five-minute feed timer must not erase or cancel that
  // preview. Full teardown still invalidates pending requests.
  if (preserve) return;
  loadVersion += 1;
  loadedSubject.value = null;
  loadedSelector.value = null;
  availsPolls.value = [];
}
