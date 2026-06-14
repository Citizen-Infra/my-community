import { useEffect, useState } from 'preact/hooks';
import { initTheme } from './store/theme';
import { initAuth, isConnected } from './store/auth';
import { loadCommunities, selectedCommunityIds, selectedCommunities } from './store/communities';
import { loadDigest } from './store/digest';
import { loadSessions } from './store/sessions';
import { startJamPolling, stopJamPolling } from './store/jam';
import { startAvailsPolling, stopAvailsPolling } from './store/avails';
import { loadBlueskyFeed, loadSavedFeeds } from './store/bluesky';
import { TopBar } from './components/TopBar';
import { Dashboard } from './components/Dashboard';
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
      startJamPolling(ids);
      startAvailsPolling(ids);
    } else {
      stopJamPolling();
      stopAvailsPolling();
    }
    if (isConnected.value) {
      loadBlueskyFeed();
    }
    return () => { stopJamPolling(); stopAvailsPolling(); };
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
      <Dashboard />
    </div>
  );
}
