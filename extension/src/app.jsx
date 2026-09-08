import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { initTheme } from './store/theme';
import { blueskySession, initAuth, isConnected } from './store/auth';
import { loadCommunities, selectedCommunityIds, selectedCommunities } from './store/communities';
import { digestLoaded, digestLoading, hydrateDigest, loadDigest } from './store/digest';
import { hydrateSessions, loadSessions, sessionsLoaded, sessionsLoading } from './store/sessions';
import { initCaAuth, caSignedIn } from './store/caAuth';
import { hydrateProposals, loadProposals } from './store/proposals';
import { hydrateWikiQueue, loadWikiQueue, refreshWikiQueue } from './store/knowledge';
import { startJamPolling, stopJamPolling } from './store/jam';
import { startAvailsPolling, stopAvailsPolling } from './store/avails';
import { blueskyLoaded, blueskyLoading, hydrateBlueskyFeed, loadBlueskyFeed, loadSavedFeeds } from './store/bluesky';
import { initDB } from './store/db';
import { loadCollections, collections, getOrCreateArchive } from './store/collections';
import { allTabs, loadTabs } from './store/tabs';
import { syncToStorage, restoreFromStorage } from './store/backup';
import { activeView } from './store/view';
import { activeTab, availableTabs, dashboardMode } from './store/panels';
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
      if (message?.type === 'WIKI_QUEUE_CHANGED') {
        refreshWikiQueue(caSignedIn.value ? selectedCommunityIds.value : []);
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
      // A selector-matched snapshot remains useful after its refresh TTL. The
      // focused feed refreshes below; only never-loaded inactive feeds populate
      // after first paint, so routine new tabs keep the request budget from #32.
      const ids = selectedCommunityIds.value;
      hydrateDigest(ids, { allowStale: true });
      hydrateSessions(selectedCommunities.value, { allowStale: true });
      hydrateProposals(caSignedIn.value ? ids : []);
      hydrateWikiQueue(caSignedIn.value ? ids : []);
      if (isConnected.value) hydrateBlueskyFeed({ allowStale: true });
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

  // Always-on feeds: the consent badge (proposals) and the global jam strip.
  // These load on mount and on community / sign-in change regardless of the
  // active tab, so the Community Input badge is live on every open.
  useEffect(() => {
    if (!ready) return;
    const ids = selectedCommunityIds.value;
    loadProposals(caSignedIn.value ? ids : []);
    loadWikiQueue(caSignedIn.value ? ids : []);
    if (ids.length > 0) startJamPolling(ids);
    else stopJamPolling();
    return () => stopJamPolling();
  }, [ready, caSignedIn.value, selectedCommunityIds.value]);

  // Community-scoped inactive tiles must never retain another selection's or
  // account's content. Matching stale snapshots remain visible during refresh.
  useLayoutEffect(() => {
    if (!ready) return;
    const ids = selectedCommunityIds.value;
    hydrateDigest(ids, { allowStale: true });
    hydrateSessions(selectedCommunities.value, { allowStale: true });
    hydrateProposals(caSignedIn.value ? ids : []);
    hydrateWikiQueue(caSignedIn.value ? ids : []);
  }, [ready, caSignedIn.value, selectedCommunityIds.value, selectedCommunities.value]);

  // Refresh one feed at a time: the member's most recently focused feed (Digest
  // by default), whether the overview or a focused feed is open. Other overview
  // tiles use selector-matched snapshots, preserving the request budget from #32.
  // Bluesky stays single-owner HERE (see #33/#35).
  useEffect(() => {
    if (!ready) return;
    const ids = selectedCommunityIds.value;
    const requestedTab = activeTab.value;
    switch (requestedTab) {
      case 'network':
        if (isConnected.value && !blueskyLoading.value) { loadSavedFeeds(); loadBlueskyFeed(); }
        break;
      case 'digest':
        if (!digestLoading.value) loadDigest(ids);
        break;
      case 'participation':
        if (!sessionsLoading.value) loadSessions(selectedCommunities.value);
        break;
      // 'communityInput' -> proposals, already loaded by the always-on effect above
    }
  }, [ready, activeTab.value, selectedCommunityIds.value, isConnected.value]);

  // Populate only enabled previews that have never produced a selector-matched
  // snapshot. Work starts after first paint and runs one feed at a time. Once an
  // empty or non-empty result is cached, future new tabs hydrate it without this
  // background work; normal freshness remains owned by the focused-feed loader.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    const populateMissingPreviews = async () => {
      for (const tab of availableTabs.value) {
        if (cancelled) return;
        if (tab === activeTab.value || tab === 'communityInput') continue;

        if (tab === 'digest' && !digestLoaded.value && !digestLoading.value) {
          await loadDigest(selectedCommunityIds.value);
        } else if (tab === 'participation' && !sessionsLoaded.value && !sessionsLoading.value) {
          await loadSessions(selectedCommunities.value);
        } else if (tab === 'network' && isConnected.value && !blueskyLoaded.value && !blueskyLoading.value) {
          await loadSavedFeeds();
          await loadBlueskyFeed();
        }
      }
    };

    const run = () => { if (!cancelled) void populateMissingPreviews(); };
    const idleHandle = globalThis.requestIdleCallback
      ? globalThis.requestIdleCallback(run, { timeout: 1500 })
      : globalThis.setTimeout(run, 300);

    return () => {
      cancelled = true;
      if (globalThis.cancelIdleCallback) globalThis.cancelIdleCallback(idleHandle);
      else globalThis.clearTimeout(idleHandle);
    };
  }, [ready, availableTabs.value, selectedCommunityIds.value, selectedCommunities.value, caSignedIn.value, blueskySession.value?.did]);

  // avails polling is scoped to the Participation tab being open (its banners
  // only show there). Starts on activation, stops when you leave.
  // (Slice 2 moves this into a shared service-worker loop.)
  useEffect(() => {
    if (!ready) return;
    const ids = selectedCommunityIds.value;
    if (dashboardMode.value === 'feed' && activeTab.value === 'participation' && ids.length > 0) {
      startAvailsPolling(ids);
    } else {
      stopAvailsPolling();
    }
    return () => stopAvailsPolling();
  }, [ready, dashboardMode.value, activeTab.value, selectedCommunityIds.value]);

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
