import { signal } from '@preact/signals';
import { authHeader } from './caAuth';

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

function cachedDigest(communityIds) {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    const cacheKey = [...communityIds].sort().join(',');
    if (cached && Date.now() - cached.timestamp < CACHE_TTL && cached.key === cacheKey) {
      return cached.links;
    }
  } catch {}
  return null;
}

export function hydrateDigest(communityIds) {
  const cached = cachedDigest(communityIds);
  if (!cached) return false;
  digestLinks.value = cached;
  digestLoaded.value = true;
  return true;
}

export async function loadDigest(communityIds) {
  lastDigestArgs = communityIds;
  digestError.value = false;
  if (communityIds.length === 0) {
    digestLinks.value = [];
    digestLoaded.value = true;
    return;
  }

  if (hydrateDigest(communityIds)) return;

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

    allLinks.sort((a, b) => new Date(b.shared_at) - new Date(a.shared_at));
    digestLinks.value = allLinks;

    localStorage.setItem(CACHE_KEY, JSON.stringify({
      key: [...communityIds].sort().join(','),
      links: allLinks,
      timestamp: Date.now(),
    }));
  } catch (err) {
    console.error('Failed to load digest:', err);
    digestError.value = true;
  }

  digestLoading.value = false;
  digestLoaded.value = true;
}
