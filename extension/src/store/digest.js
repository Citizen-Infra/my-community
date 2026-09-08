import { signal } from '@preact/signals';
import { authHeader, caSubject } from './caAuth';
import { accountCommunityKey } from '../lib/cache';

const LINKS_API = 'https://scenius-digest.vercel.app/api/links';
const CACHE_KEY = 'mc_digest_cache';
const CACHE_TTL = 60 * 60 * 1000;

export const digestLinks = signal([]);
export const digestLoading = signal(false);
export const digestLoaded = signal(false);
// Set when a fetch genuinely fails, so the feed can distinguish an outage from
// an honest "no links". Only surfaced by the UI when there is nothing to show.
export const digestError = signal(false);

let lastDigestArgs = [];
let loadGeneration = 0;
export function retryDigest() { return loadDigest(lastDigestArgs); }

const TOPIC_EMOJI = {
  links: '\uD83D\uDCDA',
  memes: '\uD83C\uDFAD',
  news: '\uD83D\uDCF0',
  resources: '\uD83D\uDCDA',
};

export function topicEmoji(topic) {
  return TOPIC_EMOJI[topic] || '\uD83D\uDD17';
}

function cachedDigest(communityIds, allowStale = false) {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    const cacheKey = accountCommunityKey(caSubject.value, communityIds);
    const freshEnough = allowStale || Date.now() - cached?.timestamp < CACHE_TTL;
    if (cached && freshEnough && cached.key === cacheKey && Array.isArray(cached.links)) {
      return cached.links;
    }
  } catch {}
  return null;
}

export function hydrateDigest(communityIds, { allowStale = false } = {}) {
  loadGeneration += 1;
  digestLoading.value = false;
  digestError.value = false;
  const cached = cachedDigest(communityIds, allowStale);
  if (!cached) {
    digestLinks.value = [];
    digestLoaded.value = false;
    return false;
  }
  digestLinks.value = cached;
  digestLoaded.value = true;
  return true;
}

export async function loadDigest(communityIds) {
  const generation = ++loadGeneration;
  lastDigestArgs = communityIds;
  digestError.value = false;
  if (communityIds.length === 0) {
    digestLinks.value = [];
    digestLoading.value = false;
    digestLoaded.value = true;
    return;
  }

  const cached = cachedDigest(communityIds);
  if (cached) {
    digestLinks.value = cached;
    digestLoading.value = false;
    digestLoaded.value = true;
    return;
  }

  digestLoading.value = true;

  try {
    const headers = await authHeader();
    const allLinks = [];
    await Promise.all(
      communityIds.map(async (id) => {
        const res = await fetch(`${LINKS_API}?group=${id}&days=7&all=true`, { headers });
        const data = await res.json();
        const links = (data.links || []).map((l) => ({ ...l, community_id: id }));
        allLinks.push(...links);
      })
    );

    if (generation !== loadGeneration) return;
    allLinks.sort((a, b) => new Date(b.shared_at) - new Date(a.shared_at));
    digestLinks.value = allLinks;

    localStorage.setItem(CACHE_KEY, JSON.stringify({
      key: accountCommunityKey(caSubject.value, communityIds),
      links: allLinks,
      timestamp: Date.now(),
    }));
  } catch (err) {
    if (generation !== loadGeneration) return;
    console.error('Failed to load digest:', err);
    digestError.value = true;
  }

  if (generation === loadGeneration) {
    digestLoading.value = false;
    digestLoaded.value = true;
  }
}
