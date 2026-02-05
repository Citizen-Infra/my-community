import { blueskyPosts, blueskyLoading, blueskyTimeWindow, setBlueskyTimeWindow, blueskyFeedUri, loadBlueskyFeed, blueskyAvailableFeeds } from '../store/bluesky';
import { BlueskyPostCard } from './BlueskyPostCard';
import '../styles/bluesky.css';

export function BlueskyFeed() {
  if (blueskyLoading.value) {
    return <div class="feed-empty">Loading Bluesky feed...</div>;
  }

  const isTimeline = blueskyFeedUri.value === 'timeline';
  const currentFeed = blueskyAvailableFeeds.value.find(f => f.uri === blueskyFeedUri.value);

  return (
    <div class="bluesky-feed">
      <div class="bsky-controls">
        {!isTimeline && currentFeed && (
          <span class="bsky-feed-label">{currentFeed.name}</span>
        )}
        <div class="bsky-window-btns">
          {['24h', '7d', '30d'].map((w) => (
            <button
              key={w}
              class={`bsky-window-btn ${blueskyTimeWindow.value === w ? 'active' : ''}`}
              onClick={() => {
                setBlueskyTimeWindow(w);
                loadBlueskyFeed();
              }}
            >
              {w}
            </button>
          ))}
        </div>
      </div>
      {blueskyPosts.value.length === 0 ? (
        <div class="feed-empty">No posts found in this time window. Try a longer range.</div>
      ) : (
        blueskyPosts.value.map((post) => (
          <BlueskyPostCard key={post.uri} post={post} />
        ))
      )}
    </div>
  );
}
