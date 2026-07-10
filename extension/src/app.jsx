import { useEffect, useRef, useState } from 'preact/hooks';
import { initTheme } from './store/theme';
import { initAuth, isConnected } from './store/auth';
import { loadCommunities, selectedCommunityIds, selectedCommunities } from './store/communities';
import { loadDigest } from './store/digest';
import { loadSessions } from './store/sessions';
import { initCaAuth, caSignedIn } from './store/caAuth';
import { loadProposals } from './store/proposals';
import { startJamPolling, stopJamPolling } from './store/jam';
import { startAvailsPolling, stopAvailsPolling } from './store/avails';
import { loadBlueskyFeed, loadSavedFeeds } from './store/bluesky';
import { initDB } from './store/db';
import { loadCollections, collections, getOrCreateArchive } from './store/collections';
import { allTabs, loadTabs } from './store/tabs';
import { syncToStorage, restoreFromStorage } from './store/backup';
import { activeView } from './store/view';
import { searchQuery } from './store/search';
import { TopBar } from './components/TopBar';
import { JamBanner } from './components/JamBanner';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { MainContent } from './components/MainContent';
import { SearchResults } from './components/SearchResults';
import './styles/layout.css';
import './styles/sidebar.css';
import './styles/main-content.css';
import './styles/tab-card.css';
import './styles/search.css';
import './styles/modal.css';
import './styles/animations.css';

export function App() {
  const [ready, setReady] = useState(false);
  const skipFirst = useRef(true);

  // Boot: tab manager (local) first, then feeds (network), then reveal.
  useEffect(() => {
    initTheme();

    const listener = (message) => {
      if (message?.type === 'DATA_CHANGED') {
        loadCollections();
        loadTabs();
      }
    };
    chrome.runtime?.onMessage?.addListener(listener);

    (async () => {
      await initDB();
      await loadCollections();
      await loadTabs();
      const hasData = collections.value.length > 0 || allTabs.value.length > 0;
      if (!hasData) {
        const restored = await restoreFromStorage();
        if (restored) {
          await loadCollections();
          await loadTabs();
        }
      }
      await getOrCreateArchive();
      // Restore the community-admin session (and pick up a just-completed sign-in
      // stashed by the service worker) BEFORE loading communities, so private
      // communities resolve on first paint.
      await initCaAuth();
      // Preserve original feed ordering: communities + auth resolve before reveal.
      await Promise.all([loadCommunities(), initAuth()]);
      setReady(true);
    })();

    return () => {
      chrome.runtime?.onMessage?.removeListener(listener);
      stopJamPolling();
      stopAvailsPolling();
    };
  }, []);

  // Feeds react to community selection.
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

  // Consent feed is member-gated: reacts to community selection AND sign-in state.
  useEffect(() => {
    if (!ready) return;
    loadProposals(caSignedIn.value ? selectedCommunityIds.value : []);
  }, [ready, caSignedIn.value, selectedCommunityIds.value]);

  useEffect(() => {
    if (ready && isConnected.value) {
      loadSavedFeeds();
      loadBlueskyFeed();
    }
  }, [ready, isConnected.value]);

  // Debounced mirror of tab data to chrome.storage.local.
  useEffect(() => {
    if (!ready) return;
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    const timer = setTimeout(syncToStorage, 2000);
    return () => clearTimeout(timer);
  }, [ready, collections.value, allTabs.value]);

  if (!ready) {
    return (
      <div class="loading-screen" role="status" aria-label="Loading your community">
        <span class="loading-mark">My Community</span>
        <span class="loading-rule" aria-hidden="true" />
        <span class="loading-line" aria-hidden="true">Setting today's page</span>
      </div>
    );
  }

  return (
    <div class="app-shell">
      <TopBar />
      <JamBanner />
      <div class="app-body">
        <Sidebar />
        <main class="app-main">
          {searchQuery.value
            ? <SearchResults />
            : (activeView.value === 'dashboard' ? <Dashboard /> : <MainContent />)}
        </main>
      </div>
    </div>
  );
}
