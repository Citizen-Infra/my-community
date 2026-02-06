import { signal } from '@preact/signals';
import { blueskySession } from './auth';
import { bskyFetch, bskyPost } from '../lib/atproto';

export const blueskyPosts = signal([]);
export const blueskyLoading = signal(false);
export const blueskyFeedUri = signal(localStorage.getItem('mc_bluesky_feed') || 'timeline');
export const blueskyTimeWindow = signal(localStorage.getItem('mc_bluesky_window') || '24h');
export const blueskyShowReposts = signal(localStorage.getItem('mc_bluesky_reposts') !== 'false');
export const blueskyWeightedSort = signal(localStorage.getItem('mc_bluesky_weighted') === 'true');
export const blueskyAvailableFeeds = signal([]);

const CACHE_KEY = 'mc_bluesky_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getTimeWindowMs(window) {
  const map = { '24h': 24 * 60 * 60 * 1000, '7d': 7 * 24 * 60 * 60 * 1000, '30d': 30 * 24 * 60 * 60 * 1000 };
  return map[window] || map['24h'];
}

const MAX_PAGES = { '24h': 2, '7d': 6, '30d': 10 };

function engagementScore(post) {
  return (post.likeCount || 0) + (post.repostCount || 0) * 2 + (post.replyCount || 0);
}

export async function loadBlueskyFeed() {
  const session = blueskySession.value;
  if (!session) return;

  // Check cache
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (cached && Date.now() - cached.timestamp < CACHE_TTL && cached.feedUri === blueskyFeedUri.value && cached.window === blueskyTimeWindow.value && cached.showReposts === blueskyShowReposts.value && cached.weightedSort === blueskyWeightedSort.value) {
      blueskyPosts.value = cached.posts;
      return;
    }
  } catch {}

  blueskyLoading.value = true;

  try {
    let posts = [];

    if (blueskyFeedUri.value === 'timeline') {
      const cutoff = Date.now() - getTimeWindowMs(blueskyTimeWindow.value);
      const maxPages = MAX_PAGES[blueskyTimeWindow.value] || 2;
      let cursor = undefined;

      for (let page = 0; page < maxPages; page++) {
        const url = `https://bsky.social/xrpc/app.bsky.feed.getTimeline?limit=50${cursor ? `&cursor=${cursor}` : ''}`;
        const res = await bskyFetch(url, session);
        if (!res || !res.ok) break;

        const data = await res.json();
        const items = data.feed || [];
        if (items.length === 0) break;

        // Check if we've gone past the time window
        const lastItem = items[items.length - 1];
        const lastTime = new Date(lastItem.post.record?.createdAt || lastItem.post.indexedAt).getTime();

        for (const item of items) {
          const isFollowed = !!item.post.author.viewer?.following;
          const isRepost = !!item.reason;
          if (isRepost && !blueskyShowReposts.value) continue;
          if (!isRepost && !isFollowed) continue;

          const createdAt = item.post.record?.createdAt || item.post.indexedAt;
          if (new Date(createdAt).getTime() < cutoff) continue;

          posts.push({
            uri: item.post.uri,
            cid: item.post.cid,
            author: {
              did: item.post.author.did,
              handle: item.post.author.handle,
              displayName: item.post.author.displayName || item.post.author.handle,
              avatar: item.post.author.avatar || null,
            },
            text: item.post.record?.text || '',
            createdAt,
            likeCount: item.post.likeCount || 0,
            repostCount: item.post.repostCount || 0,
            replyCount: item.post.replyCount || 0,
            embed: item.post.embed || null,
            reason: item.reason || null,
            viewer: item.post.viewer || null,
          });
        }

        // Stop if oldest post on this page is before the cutoff
        if (lastTime < cutoff) break;
        cursor = data.cursor;
        if (!cursor) break;
      }

      // Sort by likes or weighted engagement
      if (blueskyWeightedSort.value) {
        posts.sort((a, b) => engagementScore(b) - engagementScore(a));
      } else {
        posts.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
      }
    } else {
      // Determine API endpoint: list feeds use getListFeed, feed generators use getFeed
      const isList = blueskyFeedUri.value.includes('app.bsky.graph.list');
      const cutoff = Date.now() - getTimeWindowMs(blueskyTimeWindow.value);
      const maxPages = MAX_PAGES[blueskyTimeWindow.value] || 2;
      let cursor = undefined;

      for (let page = 0; page < maxPages; page++) {
        const url = isList
          ? `https://bsky.social/xrpc/app.bsky.feed.getListFeed?list=${encodeURIComponent(blueskyFeedUri.value)}&limit=50${cursor ? `&cursor=${cursor}` : ''}`
          : `https://bsky.social/xrpc/app.bsky.feed.getFeed?feed=${encodeURIComponent(blueskyFeedUri.value)}&limit=50${cursor ? `&cursor=${cursor}` : ''}`;
        const res = await bskyFetch(url, session);
        if (!res || !res.ok) break;

        const data = await res.json();
        const items = data.feed || [];
        if (items.length === 0) break;

        // Check if we've gone past the time window
        const lastItem = items[items.length - 1];
        const lastTime = new Date(lastItem.post.record?.createdAt || lastItem.post.indexedAt).getTime();

        for (const item of items) {
          const isRepost = !!item.reason;
          if (isRepost && !blueskyShowReposts.value) continue;

          const createdAt = item.post.record?.createdAt || item.post.indexedAt;
          if (new Date(createdAt).getTime() < cutoff) continue;

          posts.push({
            uri: item.post.uri,
            cid: item.post.cid,
            author: {
              did: item.post.author.did,
              handle: item.post.author.handle,
              displayName: item.post.author.displayName || item.post.author.handle,
              avatar: item.post.author.avatar || null,
            },
            text: item.post.record?.text || '',
            createdAt,
            likeCount: item.post.likeCount || 0,
            repostCount: item.post.repostCount || 0,
            replyCount: item.post.replyCount || 0,
            embed: item.post.embed || null,
            reason: item.reason || null,
            viewer: item.post.viewer || null,
          });
        }

        // Stop if oldest post on this page is before the cutoff
        if (lastTime < cutoff) break;
        cursor = data.cursor;
        if (!cursor) break;
      }

      // Sort by likes or weighted engagement
      if (blueskyWeightedSort.value) {
        posts.sort((a, b) => engagementScore(b) - engagementScore(a));
      } else {
        posts.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
      }
    }

    blueskyPosts.value = posts;

    // Cache
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      posts,
      feedUri: blueskyFeedUri.value,
      window: blueskyTimeWindow.value,
      showReposts: blueskyShowReposts.value,
      weightedSort: blueskyWeightedSort.value,
      timestamp: Date.now(),
    }));
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
    const prefsRes = await bskyFetch('https://bsky.social/xrpc/app.bsky.actor.getPreferences', session);
    if (!prefsRes || !prefsRes.ok) return;

    const prefsData = await prefsRes.json();
    const prefs = prefsData.preferences || [];

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

    // Build base list with Following timeline
    const feeds = [{ uri: 'timeline', name: 'Following', type: 'timeline' }];

    if (feedUris.length > 0) {
      // Get feed generator details for display names
      const feedsParam = feedUris.map(uri => `feeds=${encodeURIComponent(uri)}`).join('&');
      const feedsRes = await bskyFetch(
        `https://bsky.social/xrpc/app.bsky.feed.getFeedGenerators?${feedsParam}`,
        session
      );

      if (feedsRes && feedsRes.ok) {
        const feedsData = await feedsRes.json();
        for (const feed of feedsData.feeds || []) {
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
          `https://bsky.social/xrpc/app.bsky.graph.getList?list=${encodeURIComponent(listUri)}&limit=1`,
          session
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
    // Set default on error
    blueskyAvailableFeeds.value = [{ uri: 'timeline', name: 'Following', type: 'timeline' }];
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
        session,
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
        session,
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
  blueskyAvailableFeeds.value = [];
  blueskyFeedUri.value = 'timeline';
  localStorage.setItem('mc_bluesky_feed', 'timeline');
}
