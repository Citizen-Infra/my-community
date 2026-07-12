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
import { activeTab } from './store/panels';
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

  // Always-on feeds: the consent badge (proposals) and the global jam strip.
  // These load on mount and on community / sign-in change regardless of the
  // active tab, so the Community Input badge is live on every open.
  useEffect(() => {
    if (!ready) return;
    const ids = selectedCommunityIds.value;
    loadProposals(caSignedIn.value ? ids : []);
    if (ids.length > 0) startJamPolling(ids);
    else stopJamPolling();
    return () => stopJamPolling();
  }, [ready, caSignedIn.value, selectedCommunityIds.value]);

  // Lazy-load the active tab's feed. Fires on mount for the current tab and on
  // every tab switch; the per-store caches dedup repeat activations, so a
  // return visit costs nothing. Network + Participation are never fetched until
  // visited. Bluesky stays single-owner HERE (see #33/#35): it loads only when
  // Network is the active tab and Bluesky is connected — no other caller.
  useEffect(() => {
    if (!ready) return;
    const ids = selectedCommunityIds.value;
    switch (activeTab.value) {
      case 'network':
        if (isConnected.value) { loadSavedFeeds(); loadBlueskyFeed(); }
        break;
      case 'digest':
        loadDigest(ids);
        break;
      case 'participation':
        loadSessions(selectedCommunities.value);
        break;
      // 'communityInput' -> proposals, already loaded by the always-on effect above
    }
  }, [ready, activeTab.value, selectedCommunityIds.value, isConnected.value]);

  // avails polling is scoped to the Participation tab being open (its banners
  // only show there). Starts on activation, stops when you leave.
  // (Slice 2 moves this into a shared service-worker loop.)
  useEffect(() => {
    if (!ready) return;
    const ids = selectedCommunityIds.value;
    if (activeTab.value === 'participation' && ids.length > 0) {
      startAvailsPolling(ids);
    } else {
      stopAvailsPolling();
    }
    return () => stopAvailsPolling();
  }, [ready, activeTab.value, selectedCommunityIds.value]);

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
