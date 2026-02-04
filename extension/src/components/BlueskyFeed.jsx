import { blueskyPosts, blueskyLoading, blueskyTimeWindow, setBlueskyTimeWindow, blueskyFeedUri, loadBlueskyFeed } from '../store/bluesky';
import { BlueskyPostCard } from './BlueskyPostCard';
import '../styles/bluesky.css';

export function BlueskyFeed() {
  if (blueskyLoading.value) {
    return <div class="feed-empty">Loading Bluesky feed...</div>;
  }

  const isTimeline = blueskyFeedUri.value === 'timeline';

  return (
    <div class="bluesky-feed">
      {isTimeline && (
        <div class="bsky-controls">
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
      )}
      {blueskyPosts.value.length === 0 ? (
        <div class="feed-empty">No posts to show.</div>
      ) : (
        blueskyPosts.value.map((post) => (
          <BlueskyPostCard key={post.uri} post={post} />
        ))
      )}
    </div>
  );
}
