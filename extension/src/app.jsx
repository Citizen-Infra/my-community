import { useEffect, useState } from 'preact/hooks';
import { initTheme } from './store/theme';
import { loadCommunities, communitiesConfigured, selectedCommunityIds } from './store/communities';
import { loadDigest } from './store/digest';
import { activeTab } from './store/tabs';
import { TopBar } from './components/TopBar';
import { TabBar } from './components/TabBar';
import { DigestFeed } from './components/DigestFeed';
import './styles/layout.css';

export function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initTheme();
    (async () => {
      await loadCommunities();
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    const ids = selectedCommunityIds.value;
    if (ids.length > 0) {
      loadDigest(ids);
    }
  }, [ready, selectedCommunityIds.value]);

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
            {activeTab.value === 'participation' && (
              <div class="feed-empty">Participation — coming soon</div>
            )}
            {activeTab.value === 'network' && (
              <div class="feed-empty">Bluesky — coming soon</div>
            )}
          </main>
        </>
      ) : (
        <main class="dashboard">
          <div class="welcome-prompt">
            <h2>Welcome to My Community</h2>
            <p>Open settings to pick your communities.</p>
          </div>
        </main>
      )}
    </div>
  );
}
