import { signal } from '@preact/signals';
import { blueskySession } from './auth';
import { bskyFetch, bskyPost } from '../lib/atproto';

const PUBLIC_APPVIEW = 'https://public.api.bsky.app';
const MAX_URIS = 25; // app.bsky.feed.getPosts caps one batch here

// Live support for each call-proposal's Bluesky post, keyed by post URI:
//   { cid, likeCount, likeUri }   likeUri = this member's own like record, or null.
//
// community-admin reports its own voter count on the proposal row and we
// deliberately never render it. That number is a TTL-cached snapshot refreshed on
// CA's read, so a member who just clicked would watch their own click fail to
// appear. Bluesky holds the tally that actually decides whether the call books,
// and it answers likeCount and viewer.like in the same call — so reading it
// directly is both the honest count and the only source for "have I already said
// yes", with no second endpoint and no CA write.
export const support = signal({});

// Fill in (or refresh) support state for a list of call-proposals. Best-effort by
// design: a Bluesky outage leaves the previous values in place and the card
// renders without a count rather than with a wrong one.
export async function syncSupport(list) {
  const uris = [...new Set((list || []).map((p) => p.post_uri).filter(Boolean))];
  if (uris.length === 0) return;

  const session = blueskySession.value;
  const next = { ...support.value };
  let changed = false;

  for (let i = 0; i < uris.length; i += MAX_URIS) {
    const qs = new URLSearchParams();
    for (const uri of uris.slice(i, i + MAX_URIS)) qs.append('uris', uri);
    try {
      // Signed in: go through the member's own PDS, which is what populates
      // viewer.like — the whole reason the toggle can start in the right state on
      // first paint. Signed out: the public appview still reports likeCount, so
      // the card shows the real count and simply cannot offer the button.
      const res = session
        ? await bskyFetch(`${session.pdsUrl}/xrpc/app.bsky.feed.getPosts?${qs}`)
        : await fetch(`${PUBLIC_APPVIEW}/xrpc/app.bsky.feed.getPosts?${qs}`);
      if (!res || !res.ok) continue;
      const { posts } = await res.json();
      for (const post of posts || []) {
        next[post.uri] = {
          cid: post.cid,
          likeCount: post.likeCount ?? 0,
          likeUri: post.viewer?.like || null,
        };
        changed = true;
      }
    } catch {
      // Leave what we had; never block the tab on Bluesky.
    }
  }

  if (changed) support.value = next;
}

// Say yes (or take it back). The vote is a like record in the member's OWN repo —
// that is precisely what makes it a DID the scheduler can count, and why this
// writes nothing to community-admin.
export async function toggleSupport(proposal) {
  const session = blueskySession.value;
  const uri = proposal.post_uri;
  if (!session || !uri) return;

  const prev = support.value[uri];
  if (prev?.likeUri === 'pending') return; // a write is already in flight

  // CA stores post_cid alongside post_uri, so a proposal whose Bluesky state has
  // not synced yet is still actionable.
  const cid = prev?.cid || proposal.post_cid;
  if (!cid) return;

  const wasIn = !!prev?.likeUri;
  const base = prev || { cid, likeCount: 0, likeUri: null };

  // Optimistic — the one click IS the feature, so it has to land instantly.
  support.value = {
    ...support.value,
    [uri]: {
      ...base,
      cid,
      likeCount: Math.max(0, base.likeCount + (wasIn ? -1 : 1)),
      likeUri: wasIn ? null : 'pending',
    },
  };

  try {
    if (wasIn) {
      const res = await bskyPost(`${session.pdsUrl}/xrpc/com.atproto.repo.deleteRecord`, {
        repo: session.did,
        collection: 'app.bsky.feed.like',
        rkey: prev.likeUri.split('/').pop(),
      });
      if (!res || !res.ok) throw new Error('Could not take back your response.');
    } else {
      const res = await bskyPost(`${session.pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
        repo: session.did,
        collection: 'app.bsky.feed.like',
        record: {
          $type: 'app.bsky.feed.like',
          subject: { uri, cid },
          createdAt: new Date().toISOString(),
        },
      });
      if (!res || !res.ok) throw new Error('Could not record your response.');
      const data = await res.json();
      // Swap the placeholder for the real record URI — taking it back needs its rkey.
      support.value = { ...support.value, [uri]: { ...support.value[uri], likeUri: data.uri } };
    }
  } catch (err) {
    // Restore exactly what was there, including "nothing" — an unsynced proposal
    // must go back to having no count rather than to a fabricated zero.
    const reverted = { ...support.value };
    if (prev) reverted[uri] = prev;
    else delete reverted[uri];
    support.value = reverted;
    throw err;
  }
}
