import { useEffect, useState } from 'preact/hooks';
import { initTheme } from './store/theme';
import { initAuth, isConnected } from './store/auth';
import { loadCommunities, communitiesConfigured, selectedCommunityIds, selectedCommunities } from './store/communities';
import { loadDigest } from './store/digest';
import { loadSessions } from './store/sessions';
import { loadBlueskyFeed, loadSavedFeeds } from './store/bluesky';
import { activeTab } from './store/tabs';
import { TopBar } from './components/TopBar';
import { TabBar } from './components/TabBar';
import { DigestFeed } from './components/DigestFeed';
import { SessionsPanel } from './components/SessionsPanel';
import { BlueskyFeed } from './components/BlueskyFeed';
import './styles/layout.css';

export function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initTheme();
    (async () => {
      await Promise.all([
        loadCommunities(),
        initAuth(),
      ]);
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    const ids = selectedCommunityIds.value;
    if (ids.length > 0) {
      loadDigest(ids);
      loadSessions(selectedCommunities.value);
    }
    if (isConnected.value) {
      loadBlueskyFeed();
    }
  }, [ready, selectedCommunityIds.value]);

  useEffect(() => {
    if (ready && isConnected.value) {
      loadSavedFeeds();
      loadBlueskyFeed();
    }
  }, [ready, isConnected.value]);

  if (!ready) {
    return <div class="loading-screen"><p>Loading...</p></div>;
  }

  return (
    <div class="app">
      <TopBar />
      {communitiesConfigured.value ? (
        <>
          <TabBar />
          <main class="dashboard">
            {activeTab.value === 'digest' && <DigestFeed />}
            {activeTab.value === 'participation' && <SessionsPanel />}
            {activeTab.value === 'network' && (
              isConnected.value ? (
                <BlueskyFeed />
              ) : (
                <div class="bsky-connect-prompt">
                  <p>Connect your Bluesky account to see your network feed.</p>
                  <p class="bsky-connect-hint">Open Settings to connect with an app password.</p>
                </div>
              )
            )}
          </main>
        </>
      ) : (
        <main class="dashboard">
          <div class="welcome-prompt">
            <h2>Welcome to My Community</h2>
            <p>Select your communities to start seeing digest links, sessions, and events.</p>
            <p class="welcome-hint">Click the gear icon above to get started.</p>
          </div>
        </main>
      )}
    </div>
  );
}
