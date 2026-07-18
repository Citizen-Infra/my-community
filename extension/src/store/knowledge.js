import { signal, computed } from '@preact/signals';
import { caSessionHeader } from './caAuth';
import { getCached, setCached, clearCached, communityKey } from '../lib/cache';

const CA_URL = import.meta.env.VITE_CA_URL || 'https://community-admin-server-production.up.railway.app';
const CACHE_KEY = 'mc_wiki_queue_cache';
const CACHE_TTL = 90 * 1000; // 90s — matches the proposals feed cadence

// Community knowledge sources rising toward the wiki: the votable queue items
// (candidate / ready) plus recently promoted ones (approved / processed), shown as
// resolved. A federated read over community-admin's wiki_queue — MC renders it
// alongside consent decisions in the one feed, it does not migrate the table.
export const wikiItems = signal([]);
export const wikiLoading = signal(false);

// Statuses surfaced in the feed. 'rejected' is dropped.
const FEED_STATUSES = new Set(['candidate', 'ready', 'approved', 'processed']);
// Still open for a vote (opt-in threshold not yet resolved into the wiki).
const VOTABLE = new Set(['candidate', 'ready']);

export function isVotableKnowledge(status) {
  return VOTABLE.has(status);
}

// Votable sources the member has not weighed in on — feeds the Community Input
// badge alongside open decisions.
export const openUnvotedKnowledgeCount = computed(() =>
  wikiItems.value.filter((k) => VOTABLE.has(k.status) && !k.my_vote).length
);

// Actionable (still votable) first, unvoted ahead of voted; then resolved, newest first.
function byKnowledgeUrgency(a, b) {
  const aAct = VOTABLE.has(a.status);
  const bAct = VOTABLE.has(b.status);
  if (aAct !== bAct) return aAct ? -1 : 1;
  if (aAct) {
    const aUnvoted = a.my_vote ? 1 : 0;
    const bUnvoted = b.my_vote ? 1 : 0;
    if (aUnvoted !== bUnvoted) return aUnvoted - bUnvoted; // unvoted (0) first
  }
  return new Date(b.created_at) - new Date(a.created_at);
}

// Fetch the wiki queue for each selected community, keep the feed-relevant statuses,
// aggregate, and sort. Non-members 403 per community and are skipped so the rest of
// the feed still renders. Clears when signed out or nothing is selected.
export async function loadWikiQueue(communityIds) {
  const headers = caSessionHeader();
  if (!headers.Authorization || !communityIds || communityIds.length === 0) {
    wikiItems.value = [];
    return;
  }

  const selector = communityKey(communityIds);
  const cached = getCached(CACHE_KEY, CACHE_TTL, selector);
  if (cached) { wikiItems.value = cached; return; }

  wikiLoading.value = true;
  try {
    const all = [];
    await Promise.all(
      communityIds.map(async (id) => {
        try {
          const res = await fetch(`${CA_URL}/communities/${id}/wiki/queue`, { headers });
          if (!res.ok) return; // 403 (not a member here), 401, etc. — skip this one
          const rows = await res.json();
          for (const k of rows) {
            if (FEED_STATUSES.has(k.status)) all.push({ ...k, community_id: id });
          }
        } catch {
          /* network error for this community — skip, keep the rest */
        }
      })
    );
    all.sort(byKnowledgeUrgency);
    wikiItems.value = all;
    setCached(CACHE_KEY, all, selector);
  } catch (err) {
    console.error('Failed to load knowledge sources:', err);
  }
  wikiLoading.value = false;
}

// Cast (or change) the caller's vote on a source. Support / Pass / Oppose map to the
// wiki_votes agree / pass / disagree set (no block). The server upserts one vote per
// member and returns the updated row (recomputed tallies + status, e.g. flipped to
// 'ready' on crossing the threshold); patch it in place so the card reflects the new
// state without a refetch. Throws on failure (e.g. 409 voting closed).
export async function castKnowledgeVote(communityId, queueId, value) {
  const res = await fetch(`${CA_URL}/communities/${communityId}/wiki/queue/${queueId}/vote`, {
    method: 'POST',
    headers: { ...caSessionHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Could not record your vote. Try again.');
  }
  const updated = await res.json(); // the updated queue row
  wikiItems.value = wikiItems.value.map((k) =>
    k.id === queueId && k.community_id === communityId ? { ...k, ...updated, community_id: communityId } : k
  );
  clearCached(CACHE_KEY); // a vote changes my_vote/tallies/status; drop the cache
  return updated;
}
