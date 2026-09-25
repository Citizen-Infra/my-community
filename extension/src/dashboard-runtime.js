import { useEffect, useLayoutEffect } from 'preact/hooks';
import { blueskySession, isConnected } from './store/auth';
import { selectedCommunityIds, selectedCommunities } from './store/communities';
import { digestLoading, hydrateDigest, loadDigest } from './store/digest';
import { hydrateSessions, loadSessions, sessionsLoading } from './store/sessions';
import { caSignedIn, caSubject } from './store/caAuth';
import { hydrateProposals, loadProposals } from './store/proposals';
import { hydrateWikiQueue, loadWikiQueue } from './store/knowledge';
import { loadBrainDecisions } from './store/brain-decisions';
import { startJamPolling, stopJamPolling } from './store/jam';
import {
  loadAvailsPolls,
  startAvailsPolling,
  stopAvailsPolling,
} from './store/avails';
import { visibleAvailsCommunityIds } from './lib/avails-preview';
import {
  blueskyLoading,
  hydrateBlueskyFeed,
  loadBlueskyFeed,
  loadSavedFeeds,
} from './store/bluesky';
import { activeTab, availableTabs, dashboardMode } from './store/panels';
import { refreshInactiveDashboardFeeds } from './lib/dashboard-feed-refresh';
import { deploymentConfig } from './lib/deployment-config';
import { refreshSkins } from './store/skin';

export function hydrateDashboard() {
  const ids = selectedCommunityIds.value;
  hydrateDigest(ids, { allowStale: true });
  hydrateSessions(selectedCommunities.value, { allowStale: true });
  hydrateProposals(caSignedIn.value ? ids : []);
  hydrateWikiQueue(caSignedIn.value ? ids : []);
  if (isConnected.value) hydrateBlueskyFeed({ allowStale: true });
}

// Shared extension/web feed lifecycle. It preserves selector-matched stale
// previews, refreshes the focused source first, and revalidates inactive tiles
// one at a time after first paint.
export function useDashboardFeeds(ready) {
  useEffect(() => {
    if (!ready) return undefined;
    const ids = selectedCommunityIds.value;
    loadProposals(caSignedIn.value ? ids : []);
    loadWikiQueue(caSignedIn.value ? ids : []);
    loadBrainDecisions();
    if (ids.length > 0) startJamPolling(ids);
    else stopJamPolling();
    return () => stopJamPolling();
  }, [ready, caSignedIn.value, selectedCommunityIds.value]);

  // Skin pointer refresh (#18): discovers official skins for the dashboard's
  // communities and re-checks the pinned revision. Cheap (no-cache + ETag), and
  // re-run when the account changes because private skins depend on it.
  useEffect(() => {
    if (!ready) return;
    void refreshSkins(selectedCommunityIds.value);
  }, [ready, caSubject.value, selectedCommunityIds.value]);

  useLayoutEffect(() => {
    if (!ready) return;
    const ids = selectedCommunityIds.value;
    hydrateDigest(ids, { allowStale: true });
    hydrateSessions(selectedCommunities.value, { allowStale: true });
    hydrateProposals(caSignedIn.value ? ids : []);
    hydrateWikiQueue(caSignedIn.value ? ids : []);
  }, [ready, caSignedIn.value, selectedCommunityIds.value, selectedCommunities.value]);

  useEffect(() => {
    if (!ready) return;
    const ids = selectedCommunityIds.value;
    const visibleIds = visibleAvailsCommunityIds(selectedCommunities.value, {
      signedIn: caSignedIn.value,
      requireSignIn: deploymentConfig.linksRequireSignIn,
    });
    switch (activeTab.value) {
      case 'network':
        if (isConnected.value && !blueskyLoading.value) { loadSavedFeeds(); loadBlueskyFeed(); }
        break;
      case 'digest':
        if (!digestLoading.value) loadDigest(ids);
        break;
      case 'participation':
        if (!sessionsLoading.value) loadSessions(selectedCommunities.value);
        if (dashboardMode.value !== 'feed') loadAvailsPolls(visibleIds);
        break;
      default:
        break;
    }
  }, [ready, dashboardMode.value, activeTab.value, selectedCommunityIds.value, selectedCommunities.value, isConnected.value, caSubject.value]);

  useEffect(() => {
    if (!ready) return undefined;
    let cancelled = false;

    const refreshInactivePreviews = () => refreshInactiveDashboardFeeds({
      tabs: availableTabs.value,
      activeTab: activeTab.value,
      isCancelled: () => cancelled,
      isConnected: () => isConnected.value,
      isLoading: (tab) => (
        (tab === 'digest' && digestLoading.value)
        || (tab === 'participation' && sessionsLoading.value)
        || (tab === 'network' && blueskyLoading.value)
      ),
      refresh: (tab) => {
        if (tab === 'digest') return loadDigest(selectedCommunityIds.value);
        if (tab === 'participation') {
          return Promise.all([
            loadSessions(selectedCommunities.value),
            loadAvailsPolls(visibleAvailsCommunityIds(selectedCommunities.value, {
              signedIn: caSignedIn.value,
              requireSignIn: deploymentConfig.linksRequireSignIn,
            })),
          ]);
        }
        // Saved-feed metadata belongs to the focused Network experience. The
        // post loader is independently TTL-gated and is enough to refresh its tile.
        if (tab === 'network') return loadBlueskyFeed();
        return undefined;
      },
    });

    const run = () => { if (!cancelled) void refreshInactivePreviews(); };
    const idleHandle = globalThis.requestIdleCallback
      ? globalThis.requestIdleCallback(run, { timeout: 1500 })
      : globalThis.setTimeout(run, 300);

    return () => {
      cancelled = true;
      if (globalThis.cancelIdleCallback) globalThis.cancelIdleCallback(idleHandle);
      else globalThis.clearTimeout(idleHandle);
    };
  }, [ready, availableTabs.value, selectedCommunityIds.value, selectedCommunities.value, caSignedIn.value, blueskySession.value?.did]);

  useEffect(() => {
    if (!ready) return undefined;
    const ids = visibleAvailsCommunityIds(selectedCommunities.value, {
      signedIn: caSignedIn.value,
      requireSignIn: deploymentConfig.linksRequireSignIn,
    });
    if (dashboardMode.value === 'feed' && activeTab.value === 'participation' && ids.length > 0) {
      startAvailsPolling(ids);
    } else {
      stopAvailsPolling();
    }
    return () => stopAvailsPolling();
  }, [ready, dashboardMode.value, activeTab.value, selectedCommunities.value, caSignedIn.value, caSubject.value]);
}
