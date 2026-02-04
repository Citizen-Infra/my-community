import { signal } from '@preact/signals';
import { blueskySession } from './auth';
import { bskyFetch } from '../lib/atproto';

export const blueskyPosts = signal([]);
export const blueskyLoading = signal(false);
export const blueskyFeedUri = signal(localStorage.getItem('mc_bluesky_feed') || 'timeline');
export const blueskyTimeWindow = signal(localStorage.getItem('mc_bluesky_window') || '24h');

const CACHE_KEY = 'mc_bluesky_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getTimeWindowMs(window) {
  const map = { '24h': 24 * 60 * 60 * 1000, '7d': 7 * 24 * 60 * 60 * 1000, '30d': 30 * 24 * 60 * 60 * 1000 };
  return map[window] || map['24h'];
}

function engagementScore(post) {
  return (post.likeCount || 0) + (post.repostCount || 0) * 2 + (post.replyCount || 0);
}

export async function loadBlueskyFeed() {
  const session = blueskySession.value;
  if (!session) return;

  // Check cache
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (cached && Date.now() - cached.timestamp < CACHE_TTL && cached.feedUri === blueskyFeedUri.value && cached.window === blueskyTimeWindow.value) {
      blueskyPosts.value = cached.posts;
      return;
    }
  } catch {}

  blueskyLoading.value = true;

  try {
    let posts = [];

    if (blueskyFeedUri.value === 'timeline') {
      // Fetch user's timeline
      const res = await bskyFetch(
        `https://bsky.social/xrpc/app.bsky.feed.getTimeline?limit=50`,
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
          reason: item.reason || null, // repost reason
        }));

        // Filter by time window
        const cutoff = Date.now() - getTimeWindowMs(blueskyTimeWindow.value);
        posts = posts.filter((p) => new Date(p.createdAt).getTime() > cutoff);

        // Sort by engagement
        posts.sort((a, b) => engagementScore(b) - engagementScore(a));
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
