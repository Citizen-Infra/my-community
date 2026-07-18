import { signal, computed } from '@preact/signals';
import { blueskySession } from './auth';
import { bskyFetch, bskyPost } from '../lib/atproto';
import { parseModerationPrefs, isPostHidden, EMPTY_PREFS } from '../lib/moderation';

// Bluesky's own feed generators that already do "popular posts from people you
// follow" server-side, over the whole graph, in one getFeed call. We offer them
// as first-class options regardless of whether the user has saved them, and
// Best of Follows is the default Network feed (it is our tagline, verbatim).
// These are ordinary community feeds with no uptime SLA, so a failed load falls
// back to the Following timeline — see loadBlueskyFeed.
const CURATED_FEEDS = [
  { uri: 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/best-of-follows', name: 'Best of Follows', type: 'feed' },
  { uri: 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/with-friends', name: 'Popular With Friends', type: 'feed' },
];
const DEFAULT_FEED_URI = CURATED_FEEDS[0].uri;

// The always-available feed sources: the Following timeline plus the curated
// generators. loadSavedFeeds augments this with the user's own saved feeds/lists.
function baseFeeds() {
  return [{ uri: 'timeline', name: 'Following', type: 'timeline' }, ...CURATED_FEEDS.map((f) => ({ ...f }))];
}

export const blueskyPosts = signal([]);
export const blueskyLoading = signal(false);
export const blueskyFeedUri = signal(localStorage.getItem('mc_bluesky_feed') || DEFAULT_FEED_URI);
export const blueskyTimeWindow = signal(localStorage.getItem('mc_bluesky_window') || '24h');
export const blueskyShowReposts = signal(localStorage.getItem('mc_bluesky_reposts') !== 'false');
export const blueskyWeightedSort = signal(localStorage.getItem('mc_bluesky_weighted') === 'true');
export const blueskyAvailableFeeds = signal(baseFeeds());

const CACHE_KEY = 'mc_bluesky_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const PREFS_CACHE_KEY = 'mc_bluesky_prefs';

// The user's Bluesky content preferences (muted words, hidden posts, per-feed
// view settings). Seeded synchronously from the localStorage cache so filtering
// applies on the very first paint of a return visit; loadSavedFeeds refreshes it
// from getPreferences (the same call it makes for the feed picker).
function loadCachedPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_CACHE_KEY) || 'null') || EMPTY_PREFS;
  } catch {
    return EMPTY_PREFS;
  }
}
export const blueskyPrefs = signal(loadCachedPrefs());

// The posts actually shown: raw feed posts minus reposts (when the toggle hides
// them) and anything the user's Bluesky preferences hide. A computed, so it
// re-filters reactively when the feed, the toggle, or the preferences change —
// preferences that arrive after the posts self-correct without a refetch.
export const blueskyVisiblePosts = computed(() => {
  const prefs = blueskyPrefs.value;
  const uri = blueskyFeedUri.value;
  const showReposts = blueskyShowReposts.value;
  const now = Date.now();
  return blueskyPosts.value.filter((p) => {
    if (!showReposts && p.reason) return false;
    return !isPostHidden(p, prefs, uri, now);
  });
});

function getTimeWindowMs(window) {
  const map = { '24h': 24 * 60 * 60 * 1000, '7d': 7 * 24 * 60 * 60 * 1000, '30d': 30 * 24 * 60 * 60 * 1000 };
  return map[window] || map['24h'];
}

const MAX_PAGES = { '24h': 2, '7d': 6, '30d': 10 };

function engagementScore(post) {
  return (post.likeCount || 0) + (post.repostCount || 0) * 2 + (post.replyCount || 0);
}

// Order posts for the active sort mode (mutates in place).
// "Most liked" ranks by like count. "Most discussed" ranks by reply volume (the
// conversation axis) rather than an engagement score dominated by likes, so the
// two modes surface genuinely different posts and the label stays honest;
// engagement is only the tie-break when reply counts are equal.
function sortPosts(posts) {
  if (blueskyWeightedSort.value) {
    posts.sort((a, b) => (b.replyCount || 0) - (a.replyCount || 0) || engagementScore(b) - engagementScore(a));
  } else {
    posts.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
  }
}

// Algorithmic feeds have no time window, so they page to a flat budget (~150 posts).
const ALGO_MAX_PAGES = 3;

// Build the XRPC URL for the active feed source: the Following timeline, a list
// feed (chronological), or a feed generator (algorithmic).
function feedUrl(session, uri, cursor) {
  const c = cursor ? `&cursor=${cursor}` : '';
  if (uri === 'timeline') {
    return `${session.pdsUrl}/xrpc/app.bsky.feed.getTimeline?limit=50${c}`;
  }
  if (uri.includes('app.bsky.graph.list')) {
    return `${session.pdsUrl}/xrpc/app.bsky.feed.getListFeed?list=${encodeURIComponent(uri)}&limit=50${c}`;
  }
  return `${session.pdsUrl}/xrpc/app.bsky.feed.getFeed?feed=${encodeURIComponent(uri)}&limit=50${c}`;
}

// Map a raw feed item into the post shape the UI renders.
function mapPost(item) {
  const embedType = item.post.embed?.$type || '';
  return {
    uri: item.post.uri,
    cid: item.post.cid,
    author: {
      did: item.post.author.did,
      handle: item.post.author.handle,
      displayName: item.post.author.displayName || item.post.author.handle,
      avatar: item.post.author.avatar || null,
    },
    text: item.post.record?.text || '',
    facets: item.post.record?.facets || null,
    createdAt: item.post.record?.createdAt || item.post.indexedAt,
    likeCount: item.post.likeCount || 0,
    repostCount: item.post.repostCount || 0,
    replyCount: item.post.replyCount || 0,
    embed: item.post.embed || null,
    reason: item.reason || null,
    viewer: item.post.viewer || null,
    // Flags for the user's feed-view preferences (hide replies / quote posts).
    isReply: !!item.post.record?.reply,
    isQuote: embedType === 'app.bsky.embed.record#view' || embedType === 'app.bsky.embed.recordWithMedia#view',
  };
}

// A feed generator (getFeed) is algorithmic; the Following timeline and Lists
// (getListFeed) are reverse-chronological.
function isAlgorithmicFeed(uri) {
  return uri !== 'timeline' && !uri.includes('app.bsky.graph.list');
}

// Fetch and shape posts for one feed source. Chronological feeds get the
// time-window filter, age-based pagination, and engagement re-sort; algorithmic
// feed generators are returned in the order the feed served, at whatever ages.
async function fetchFeedPosts(session, uri) {
  const isTimeline = uri === 'timeline';
  const isAlgorithmic = isAlgorithmicFeed(uri);

  const cutoff = Date.now() - getTimeWindowMs(blueskyTimeWindow.value);
  const maxPages = isAlgorithmic ? ALGO_MAX_PAGES : (MAX_PAGES[blueskyTimeWindow.value] || 2);
  let cursor = undefined;
  const posts = [];

  for (let page = 0; page < maxPages; page++) {
    const res = await bskyFetch(feedUrl(session, uri, cursor));
    if (!res || !res.ok) break;

    const data = await res.json();
    const items = data.feed || [];
    if (items.length === 0) break;

    for (const item of items) {
      const isRepost = !!item.reason;
      // The Following timeline mixes in non-followed context posts; keep only
      // followed authors. Reposts are kept here regardless (a repost by someone
      // you follow is legitimate); the Reposts toggle hides them at render time.
      if (isTimeline && !isRepost && !item.post.author.viewer?.following) continue;
      // Chronological feeds honour the selected time window; algorithmic feeds
      // keep whatever the feed served, regardless of age.
      if (!isAlgorithmic) {
        const createdAt = item.post.record?.createdAt || item.post.indexedAt;
        if (new Date(createdAt).getTime() < cutoff) continue;
      }
      posts.push(mapPost(item));
    }

    // A chronological feed is time-ordered, so once a page ends before the
    // window there is nothing older worth fetching. That test is meaningless
    // for an algorithmic feed (its posts are not in time order), so those page
    // straight to the budget instead.
    if (!isAlgorithmic) {
      const lastItem = items[items.length - 1];
      const lastTime = new Date(lastItem.post.record?.createdAt || lastItem.post.indexedAt).getTime();
      if (lastTime < cutoff) break;
    }
    cursor = data.cursor;
    if (!cursor) break;
  }

  // Chronological feeds re-rank by the active sort; algorithmic feeds keep the
  // feed's own ranking.
  if (!isAlgorithmic) sortPosts(posts);
  return posts;
}

export async function loadBlueskyFeed() {
  const session = blueskySession.value;
  if (!session) return;

  // Check cache
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (cached && Date.now() - cached.timestamp < CACHE_TTL && cached.feedUri === blueskyFeedUri.value && cached.window === blueskyTimeWindow.value && cached.weightedSort === blueskyWeightedSort.value) {
      blueskyPosts.value = cached.posts;
      return;
    }
  } catch {}

  blueskyLoading.value = true;

  try {
    const uri = blueskyFeedUri.value;
    let posts = await fetchFeedPosts(session, uri);

    // Curated/community feed generators have no uptime SLA and can be renamed or
    // retired. If one is unavailable (errored or empty) — and it may be the
    // default view — fall back to the Following timeline so the feed never
    // renders blank. Don't cache the fallback, so a transient outage recovers on
    // the next refresh rather than being pinned for the cache TTL.
    let servedFallback = false;
    if (isAlgorithmicFeed(uri) && posts.length === 0) {
      console.warn('[MC feed] feed generator returned nothing; falling back to the Following timeline');
      posts = await fetchFeedPosts(session, 'timeline');
      servedFallback = true;
    }

    blueskyPosts.value = posts;

    if (!servedFallback) {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        posts,
        feedUri: blueskyFeedUri.value,
        window: blueskyTimeWindow.value,
        weightedSort: blueskyWeightedSort.value,
        timestamp: Date.now(),
      }));
    }
  } catch (err) {
    console.error('Failed to load Bluesky feed:', err);
  }

  blueskyLoading.value = false;
}

export function setBlueskyFeedUri(uri) {
  blueskyFeedUri.value = uri;
  localStorage.setItem('mc_bluesky_feed', uri);
}

export function setBlueskyTimeWindow(w) {
  blueskyTimeWindow.value = w;
  localStorage.setItem('mc_bluesky_window', w);
}

export function setBlueskyShowReposts(show) {
  blueskyShowReposts.value = show;
  localStorage.setItem('mc_bluesky_reposts', show ? 'true' : 'false');
}

export function setBlueskyWeightedSort(on) {
  blueskyWeightedSort.value = on;
  localStorage.setItem('mc_bluesky_weighted', on ? 'true' : 'false');
}

export async function loadSavedFeeds() {
  const session = blueskySession.value;
  if (!session) return;

  try {
    // Get user's saved feed preferences
    const prefsRes = await bskyFetch(`${session.pdsUrl}/xrpc/app.bsky.actor.getPreferences`);
    if (!prefsRes || !prefsRes.ok) return;

    const prefsData = await prefsRes.json();
    const prefs = prefsData.preferences || [];

    // Parse + cache the user's content preferences (muted words, hidden posts,
    // per-feed view settings) from the same getPreferences response the feed
    // picker uses. The render-time computed applies them.
    const mod = parseModerationPrefs(prefs);
    blueskyPrefs.value = mod;
    try { localStorage.setItem(PREFS_CACHE_KEY, JSON.stringify(mod)); } catch {}

    // Seed the Reposts toggle from the user's Bluesky "hide reposts" setting for
    // the home feed, but only until they set it themselves in MC. Set the signal
    // only (not localStorage) so it stays "unset" and re-seeds each session;
    // toggling it in MC writes mc_bluesky_reposts and MC wins from then on.
    if (localStorage.getItem('mc_bluesky_reposts') === null) {
      const home = mod.feedViews.find((f) => f.feed === 'home');
      if (home) blueskyShowReposts.value = !home.hideReposts;
    }

    // Find savedFeedsPrefV2 (newer format) or fall back to savedFeedsPref
    const savedFeedsPrefV2 = prefs.find(p => p.$type === 'app.bsky.actor.defs#savedFeedsPrefV2');
    const savedFeedsPref = prefs.find(p => p.$type === 'app.bsky.actor.defs#savedFeedsPref');

    let feedUris = [];
    let listUris = [];

    if (savedFeedsPrefV2 && savedFeedsPrefV2.items) {
      // V2 format: array of { type: 'feed' | 'list' | 'timeline', value: uri, pinned: bool }
      feedUris = savedFeedsPrefV2.items
        .filter(item => item.type === 'feed')
        .map(item => item.value);
      listUris = savedFeedsPrefV2.items
        .filter(item => item.type === 'list')
        .map(item => item.value);
    } else if (savedFeedsPref && savedFeedsPref.saved) {
      // V1 format: just an array of URIs
      feedUris = savedFeedsPref.saved.filter(uri => uri.includes('app.bsky.feed.generator'));
      listUris = savedFeedsPref.saved.filter(uri => uri.includes('app.bsky.graph.list'));
    }

    // Start from the always-available sources (Following + curated generators),
    // then append the user's own saved feeds. Skip any saved feed we already
    // offer as a curated one so it never appears twice.
    const feeds = baseFeeds();
    const curatedUris = new Set(CURATED_FEEDS.map((f) => f.uri));

    if (feedUris.length > 0) {
      // Get feed generator details for display names
      const feedsParam = feedUris.map(uri => `feeds=${encodeURIComponent(uri)}`).join('&');
      const feedsRes = await bskyFetch(
        `${session.pdsUrl}/xrpc/app.bsky.feed.getFeedGenerators?${feedsParam}`
      );

      if (feedsRes && feedsRes.ok) {
        const feedsData = await feedsRes.json();
        for (const feed of feedsData.feeds || []) {
          if (curatedUris.has(feed.uri)) continue;
          feeds.push({
            uri: feed.uri,
            name: feed.displayName || feed.uri.split('/').pop(),
            type: 'feed',
          });
        }
      }
    }

    // Fetch list metadata for display names
    for (const listUri of listUris) {
      try {
        const listRes = await bskyFetch(
          `${session.pdsUrl}/xrpc/app.bsky.graph.getList?list=${encodeURIComponent(listUri)}&limit=1`
        );
        if (listRes && listRes.ok) {
          const listData = await listRes.json();
          feeds.push({
            uri: listUri,
            name: listData.list?.name || listUri.split('/').pop(),
            type: 'list',
          });
        }
      } catch {}
    }

    blueskyAvailableFeeds.value = feeds;

    // Validate current selection still exists
    const currentUri = blueskyFeedUri.value;
    if (currentUri !== 'timeline' && !feeds.some(f => f.uri === currentUri)) {
      setBlueskyFeedUri('timeline');
    }
  } catch (err) {
    console.error('Failed to load saved feeds:', err);
    // Fall back to the always-available sources on error.
    blueskyAvailableFeeds.value = baseFeeds();
  }
}

export async function toggleLike(post) {
  const session = blueskySession.value;
  if (!session) return;

  const isLiked = !!post.viewer?.like;
  const postIndex = blueskyPosts.value.findIndex(p => p.uri === post.uri);
  if (postIndex === -1) return;

  // Optimistic update
  const prev = blueskyPosts.value[postIndex];
  const updated = {
    ...prev,
    likeCount: prev.likeCount + (isLiked ? -1 : 1),
    viewer: isLiked ? { ...prev.viewer, like: undefined } : { ...prev.viewer, like: 'pending' },
  };
  const newPosts = [...blueskyPosts.value];
  newPosts[postIndex] = updated;
  blueskyPosts.value = newPosts;

  try {
    if (isLiked) {
      // Delete the like record
      const rkey = post.viewer.like.split('/').pop();
      const res = await bskyPost(
        `${session.pdsUrl}/xrpc/com.atproto.repo.deleteRecord`,
        { repo: session.did, collection: 'app.bsky.feed.like', rkey },
      );
      if (!res || !res.ok) throw new Error('Failed to unlike');
    } else {
      // Create a like record
      const res = await bskyPost(
        `${session.pdsUrl}/xrpc/com.atproto.repo.createRecord`,
        {
          repo: session.did,
          collection: 'app.bsky.feed.like',
          record: {
            $type: 'app.bsky.feed.like',
            subject: { uri: post.uri, cid: post.cid },
            createdAt: new Date().toISOString(),
          },
        },
      );
      if (!res || !res.ok) throw new Error('Failed to like');
      const data = await res.json();
      // Update with the real like URI
      const finalPosts = [...blueskyPosts.value];
      const idx = finalPosts.findIndex(p => p.uri === post.uri);
      if (idx !== -1) {
        finalPosts[idx] = { ...finalPosts[idx], viewer: { ...finalPosts[idx].viewer, like: data.uri } };
        blueskyPosts.value = finalPosts;
      }
    }
  } catch (err) {
    console.error('toggleLike failed, reverting:', err);
    // Revert optimistic update
    const revertPosts = [...blueskyPosts.value];
    const idx = revertPosts.findIndex(p => p.uri === post.uri);
    if (idx !== -1) {
      revertPosts[idx] = prev;
      blueskyPosts.value = revertPosts;
    }
  }
}

export function clearBlueskyState() {
  blueskyPosts.value = [];
  blueskyAvailableFeeds.value = baseFeeds();
  blueskyFeedUri.value = DEFAULT_FEED_URI;
  localStorage.setItem('mc_bluesky_feed', DEFAULT_FEED_URI);
  blueskyPrefs.value = EMPTY_PREFS;
  localStorage.removeItem(PREFS_CACHE_KEY);
}
