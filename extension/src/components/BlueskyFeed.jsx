import { useState } from 'preact/hooks';
import { blueskyPosts, blueskyLoading, blueskyTimeWindow, setBlueskyTimeWindow, blueskyFeedUri, loadBlueskyFeed, blueskyAvailableFeeds, loadSavedFeeds } from '../store/bluesky';
import { isConnected, connectBluesky, disconnectBluesky, legacyBlueskySession } from '../store/auth';
import { BlueskyPostCard } from './BlueskyPostCard';
import '../styles/bluesky.css';
import '../styles/auth-modal.css';

export function BlueskyFeed() {
  const [feedHandle, setFeedHandle] = useState('');
  const [feedErr, setFeedErr] = useState(null);
  const [feedBusy, setFeedBusy] = useState(false);

  async function handleFeedConnect(e) {
    if (e) e.preventDefault();
    setFeedErr(null);
    const h = feedHandle.trim();
    if (!h) { setFeedErr('Enter your Bluesky handle.'); return; }
    setFeedBusy(true);
    try {
      await connectBluesky(h);
      await loadSavedFeeds();
      await loadBlueskyFeed();
    } catch (err) {
      setFeedErr(err.message);
    }
    setFeedBusy(false);
  }

  // Disconnecting the feed drops the Bluesky session (content only). A community
  // membership keyed on this DID stays signed in; the account section still shows
  // @handle. Full sign-out lives at the account.
  function handleDisconnect() {
    disconnectBluesky();
  }

  // The one place the feed-only Bluesky connect lives. When signed in with email
  // (or fully signed out), the Network feed prompts to connect here rather than in
  // the account settings, so there is never a second Bluesky control on the account.
  if (!isConnected.value) {
    return (
      <div class="bluesky-feed">
        <div class="feed-connect">
          <p class="feed-connect-lead">
            {legacyBlueskySession.value
              ? 'Reconnect Bluesky to restore your feed.'
              : 'Connect Bluesky to see popular posts from your network.'}
          </p>
          <form onSubmit={handleFeedConnect} class="auth-form-compact">
            <input
              type="text"
              class="auth-input"
              placeholder="Handle (e.g. alice.bsky.social)"
              value={feedHandle}
              onInput={(e) => setFeedHandle(e.target.value)}
            />
            {feedErr && <p class="auth-error">{feedErr}</p>}
            <button type="submit" class="auth-submit" disabled={feedBusy}>
              {feedBusy ? 'Connecting...' : 'Connect Bluesky'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (blueskyLoading.value) {
    return <div class="feed-empty">Loading Bluesky feed...</div>;
  }

  const isTimeline = blueskyFeedUri.value === 'timeline';
  const currentFeed = blueskyAvailableFeeds.value.find(f => f.uri === blueskyFeedUri.value);

  return (
    <div class="bluesky-feed">
      <div class="bsky-controls">
        <button class="bsky-disconnect" onClick={handleDisconnect}>Disconnect</button>
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
