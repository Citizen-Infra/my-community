import { signal } from '@preact/signals';
import { blueskySession } from './auth';
import { bskyFetch } from '../lib/atproto';

export const blueskyPosts = signal([]);
export const blueskyLoading = signal(false);
export const blueskyFeedUri = signal(localStorage.getItem('mc_bluesky_feed') || 'timeline');
export const blueskyTimeWindow = signal(localStorage.getItem('mc_bluesky_window') || '24h');
export const blueskyShowReposts = signal(localStorage.getItem('mc_bluesky_reposts') !== 'false');
export const blueskyWeightedSort = signal(localStorage.getItem('mc_bluesky_weighted') === 'true');

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
      // Fetch custom feed generator
      const res = await bskyFetch(
        `https://bsky.social/xrpc/app.bsky.feed.getFeed?feed=${encodeURIComponent(blueskyFeedUri.value)}&limit=50`,
        session
      );
      if (res && res.ok) {
        const data = await res.json();
        posts = (data.feed || []).map((item) => ({
          uri: item.post.uri,
          cid: item.post.cid,
          author: {
            did: item.post.author.did,
            handle: item.post.author.handle,
            displayName: item.post.author.displayName || item.post.author.handle,
            avatar: item.post.author.avatar || null,
          },
          text: item.post.record?.text || '',
          createdAt: item.post.record?.createdAt || item.post.indexedAt,
          likeCount: item.post.likeCount || 0,
          repostCount: item.post.repostCount || 0,
          replyCount: item.post.replyCount || 0,
          embed: item.post.embed || null,
          reason: item.reason || null,
        }));
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
