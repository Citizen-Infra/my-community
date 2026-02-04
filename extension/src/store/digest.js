import { signal } from '@preact/signals';

const LINKS_API = 'https://scenius-digest.vercel.app/api/links';
const CACHE_KEY = 'mc_digest_cache';
const CACHE_TTL = 60 * 60 * 1000;

export const digestLinks = signal([]);
export const digestLoading = signal(false);

const TOPIC_EMOJI = {
  links: '\uD83D\uDCDA',
  memes: '\uD83C\uDFAD',
  news: '\uD83D\uDCF0',
  resources: '\uD83D\uDCDA',
};

export function topicEmoji(topic) {
  return TOPIC_EMOJI[topic] || '\uD83D\uDD17';
}

export async function loadDigest(communityIds) {
  if (communityIds.length === 0) {
    digestLinks.value = [];
    return;
  }

  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      const cacheKey = communityIds.sort().join(',');
      if (cached.key === cacheKey) {
        digestLinks.value = cached.links;
        return;
      }
    }
  } catch {}

  digestLoading.value = true;

  try {
    const allLinks = [];
    await Promise.all(
      communityIds.map(async (id) => {
        const res = await fetch(`${LINKS_API}?group=${id}&days=14`);
        const data = await res.json();
        const links = (data.links || []).map((l) => ({ ...l, community_id: id }));
        allLinks.push(...links);
      })
    );

    allLinks.sort((a, b) => new Date(b.shared_at) - new Date(a.shared_at));
    digestLinks.value = allLinks;

    localStorage.setItem(CACHE_KEY, JSON.stringify({
      key: communityIds.sort().join(','),
      links: allLinks,
      timestamp: Date.now(),
    }));
  } catch (err) {
    console.error('Failed to load digest:', err);
  }

  digestLoading.value = false;
}
