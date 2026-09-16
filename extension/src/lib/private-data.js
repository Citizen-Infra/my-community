export const PRIVATE_COMMUNITY_CACHE_KEYS = [
  'mc_communities_cache',
  'mc_digest_cache',
  'mc_sessions_cache',
  'mc_proposals_cache',
  'mc_wiki_queue_cache',
];

export function clearPrivateCommunityCaches(storage = localStorage) {
  for (const key of PRIVATE_COMMUNITY_CACHE_KEYS) storage.removeItem(key);
}
