import { useState } from 'preact/hooks';
import { blueskyPosts, blueskyLoading } from '../store/bluesky';
import { isConnected, connectBluesky, disconnectBluesky, blueskyUser, legacyBlueskySession } from '../store/auth';
import { caType, caSubject, signOut } from '../store/caAuth';
import { loadCommunities, selectedCommunityIds, selectedCommunities } from '../store/communities';
import { loadDigest } from '../store/digest';
import { loadSessions } from '../store/sessions';
import { BlueskyPostCard } from './BlueskyPostCard';
import { BlueskyFilterBar } from './BlueskyFilterBar';
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
      // Just connect. Flipping isConnected re-triggers the connection-state
      // effect in app.jsx, which owns loadSavedFeeds() + loadBlueskyFeed().
      // Loading here too double-fetched the timeline on connect (#35).
      await connectBluesky(h);
    } catch (err) {
      setFeedErr(err.message);
    }
    setFeedBusy(false);
  }

  // Disconnect the Bluesky session. If that Bluesky account IS the community
  // login (an atproto identity matching the feed session), this ends the whole
  // session: one login, one sign-out, no "signed in but feed off" split. If the
  // community login is email, only the feed is dropped.
  async function handleDisconnect() {
    const endsCommunity = caType.value === 'atproto' && blueskyUser.value?.did === caSubject.value;
    await disconnectBluesky();
    if (endsCommunity) {
      signOut();
      await loadCommunities();
      if (selectedCommunityIds.value.length > 0) {
        loadDigest(selectedCommunityIds.value);
        loadSessions(selectedCommunities.value);
      }
    }
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

  return (
    <div class="bluesky-feed">
      <div class="bsky-controls">
        <BlueskyFilterBar />
        <button class="bsky-disconnect" onClick={handleDisconnect}>Disconnect</button>
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
