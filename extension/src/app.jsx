import { useEffect, useRef, useState } from 'preact/hooks';
import { initTheme } from './store/theme';
import { initAuth } from './store/auth';
import { loadCommunities, selectedCommunityIds, selectedCommunities } from './store/communities';
import { initCaAuth, caSignedIn, caSubject } from './store/caAuth';
import { refreshWikiQueue } from './store/knowledge';
import { stopJamPolling } from './store/jam';
import { stopAvailsPolling } from './store/avails';
import { initDB } from './store/db';
import { loadCollections, collections, getOrCreateArchive } from './store/collections';
import { allTabs, loadTabs } from './store/tabs';
import { syncToStorage, restoreFromStorage } from './store/backup';
import { activeView } from './store/view';
import { searchQuery } from './store/search';
import { initTabManager, tabManagerEnabled } from './store/tab-manager';
import { hydrateDashboard, useDashboardFeeds } from './dashboard-runtime';
import { beginPreferenceContinuity, endPreferenceContinuity, startSignedOutPreferenceProfile } from './store/preferences';
import { PreferenceReconciliation } from './components/PreferenceReconciliation';
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
  const preferenceAccount = useRef(null);
  useDashboardFeeds(ready);

  useEffect(() => {
    if (!ready) return;
    const account = caSubject.value;
    if (account && preferenceAccount.current !== account) {
      preferenceAccount.current = account;
      void beginPreferenceContinuity(account);
    } else if (!account && preferenceAccount.current) {
      preferenceAccount.current = null;
      endPreferenceContinuity();
    } else if (!account) {
      startSignedOutPreferenceProfile();
    }
  }, [ready, caSubject.value]);

  // Boot: tab manager (local) first, then feeds (network), then reveal.
  useEffect(() => {
    initTheme();

    const listener = (message) => {
      if (message?.type === 'DATA_CHANGED') {
        loadCollections();
        loadTabs();
      }
      if (message?.type === 'WIKI_QUEUE_CHANGED') {
        refreshWikiQueue(caSignedIn.value ? selectedCommunityIds.value : []);
      }
    };
    chrome.runtime?.onMessage?.addListener(listener);

    (async () => {
      await initTabManager();
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
      // A selector-matched snapshot remains useful after its refresh TTL. The
      // focused feed refreshes below; only never-loaded inactive feeds populate
      // after first paint, so routine new tabs keep the request budget from #32.
      hydrateDashboard();
      setReady(true);
    })();

    return () => {
      chrome.runtime?.onMessage?.removeListener(listener);
      stopJamPolling();
      stopAvailsPolling();
    };
  }, []);

  // Mirror the member's selected communities for the service worker, so the
  // suggest-to-wiki action (Sub-project C) can resolve a target community without
  // reading this page's localStorage.
  useEffect(() => {
    try {
      chrome.storage?.local?.set({
        mc_communities_bg: selectedCommunities.value.map((c) => ({ id: c.id, name: c.name })),
      });
    } catch {}
  }, [selectedCommunities.value]);

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
      <div class={`app-body ${tabManagerEnabled.value ? '' : 'dashboard-only'}`}>
        {tabManagerEnabled.value && <Sidebar />}
        <main class="app-main">
          {tabManagerEnabled.value && searchQuery.value
            ? <SearchResults />
            : (activeView.value === 'dashboard' ? <Dashboard /> : <MainContent />)}
        </main>
      </div>
      <PreferenceReconciliation />
    </div>
  );
}
