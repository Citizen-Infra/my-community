import { signal, computed } from '@preact/signals';
import { caSessionHeader } from './caAuth';
import { resolveHandles } from './handles';
import { getCached, setCached, clearCached, communityKey } from '../lib/cache';

const CA_URL = import.meta.env.VITE_CA_URL || 'https://community-admin-server-production.up.railway.app';
const CACHE_KEY = 'mc_proposals_cache';
const CACHE_TTL = 90 * 1000; // 90s — short, keeps the consent badge fresh

// The member-facing consent feed: open decisions across the member's selected
// communities, each with a computed status (open / ratified / objected), tallies,
// and the caller's own my_vote. Status is computed server-side at read time.
export const proposals = signal([]);
export const proposalsLoading = signal(false);

// Open decisions the member has not responded to — the Community Input tab badge.
export const openUnvotedCount = computed(() =>
  proposals.value.filter((p) => new Date(p.closes_at).getTime() > Date.now() && !p.my_vote).length
);

// Sort: open decisions first (soonest-closing at the top), then closed ones
// (most-recently-closed first). Keeps the actionable items in view.
function byUrgency(a, b) {
  const aOpen = new Date(a.closes_at).getTime() > Date.now();
  const bOpen = new Date(b.closes_at).getTime() > Date.now();
  if (aOpen !== bOpen) return aOpen ? -1 : 1;
  return aOpen
    ? new Date(a.closes_at) - new Date(b.closes_at)
    : new Date(b.closes_at) - new Date(a.closes_at);
}

// Fetch decisions for each selected community, aggregate, and sort. Non-members of a
// given community 403 there; those are skipped so the rest of the feed still renders
// (degrade gracefully). Clears when signed out or nothing is selected.
export async function loadProposals(communityIds) {
  const headers = caSessionHeader();
  if (!headers.Authorization || !communityIds || communityIds.length === 0) {
    proposals.value = [];
    return;
  }

  const selector = communityKey(communityIds);
  const cached = getCached(CACHE_KEY, CACHE_TTL, selector);
  if (cached) { proposals.value = cached; resolveHandles(cached.map((p) => p.created_by)); return; }

  proposalsLoading.value = true;
  try {
    const all = [];
    await Promise.all(
      communityIds.map(async (id) => {
        try {
          const res = await fetch(`${CA_URL}/communities/${id}/proposals`, { headers });
          if (!res.ok) return; // 403 (not a member here), 401, etc. — skip this one
          const rows = await res.json();
          for (const p of rows) all.push({ ...p, community_id: id });
        } catch {
          /* network error for this community — skip, keep the rest */
        }
      })
    );
    all.sort(byUrgency);
    proposals.value = all;
    resolveHandles(all.map((p) => p.created_by));
    setCached(CACHE_KEY, all, selector);
  } catch (err) {
    console.error('Failed to load decisions:', err);
  }
  proposalsLoading.value = false;
}

// Cast (or change) the caller's vote on one decision. The server upserts one vote per
// member and returns the recomputed { tallies, my_vote, status }; patch that decision
// in place so the card reflects the new state without a full refetch. Throws on failure
// (e.g. 400 window closed / block-without-reason) for the caller to surface.
export async function castVote(communityId, proposalId, value, reason) {
  const res = await fetch(`${CA_URL}/communities/${communityId}/proposals/${proposalId}/vote`, {
    method: 'POST',
    headers: { ...caSessionHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ value, reason: reason || undefined }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Could not record your response. Try again.');
  }
  const updated = await res.json(); // { tallies, my_vote, status }
  proposals.value = proposals.value.map((p) =>
    p.id === proposalId && p.community_id === communityId
      ? { ...p, tallies: updated.tallies, my_vote: updated.my_vote, status: updated.status }
      : p
  );
  clearCached(CACHE_KEY); // a vote changes my_vote/tallies; drop the cache so the next open refetches
  return updated;
}
