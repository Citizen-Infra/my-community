import { useEffect, useLayoutEffect } from 'preact/hooks';
import { blueskySession, isConnected } from './store/auth';
import { selectedCommunityIds, selectedCommunities } from './store/communities';
import { digestLoaded, digestLoading, hydrateDigest, loadDigest } from './store/digest';
import { hydrateSessions, loadSessions, sessionsLoaded, sessionsLoading } from './store/sessions';
import { caSignedIn, caSubject } from './store/caAuth';
import { hydrateProposals, loadProposals } from './store/proposals';
import { hydrateWikiQueue, loadWikiQueue } from './store/knowledge';
import { startJamPolling, stopJamPolling } from './store/jam';
import { startAvailsPolling, stopAvailsPolling } from './store/avails';
import {
  blueskyLoaded,
  blueskyLoading,
  hydrateBlueskyFeed,
  loadBlueskyFeed,
  loadSavedFeeds,
} from './store/bluesky';
import { activeTab, availableTabs, dashboardMode } from './store/panels';

export function hydrateDashboard() {
  const ids = selectedCommunityIds.value;
  hydrateDigest(ids, { allowStale: true });
  hydrateSessions(selectedCommunities.value, { allowStale: true });
  hydrateProposals(caSignedIn.value ? ids : []);
  hydrateWikiQueue(caSignedIn.value ? ids : []);
  if (isConnected.value) hydrateBlueskyFeed({ allowStale: true });
}

// Shared extension/web feed lifecycle. It preserves selector-matched stale
// previews, refreshes the focused source first, and fills never-seen tiles one
// at a time after first paint.
export function useDashboardFeeds(ready) {
  useEffect(() => {
    if (!ready) return undefined;
    const ids = selectedCommunityIds.value;
    loadProposals(caSignedIn.value ? ids : []);
    loadWikiQueue(caSignedIn.value ? ids : []);
    if (ids.length > 0) startJamPolling(ids);
    else stopJamPolling();
    return () => stopJamPolling();
  }, [ready, caSignedIn.value, selectedCommunityIds.value]);

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
    switch (activeTab.value) {
      case 'network':
        if (isConnected.value && !blueskyLoading.value) { loadSavedFeeds(); loadBlueskyFeed(); }
        break;
      case 'digest':
        if (!digestLoading.value) loadDigest(ids);
        break;
      case 'participation':
        if (!sessionsLoading.value) loadSessions(selectedCommunities.value);
        break;
      default:
        break;
    }
  }, [ready, activeTab.value, selectedCommunityIds.value, isConnected.value, caSubject.value]);

  useEffect(() => {
    if (!ready) return undefined;
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

  useEffect(() => {
    if (!ready) return undefined;
    const ids = selectedCommunityIds.value;
    if (dashboardMode.value === 'feed' && activeTab.value === 'participation' && ids.length > 0) {
      startAvailsPolling(ids);
    } else {
      stopAvailsPolling();
    }
    return () => stopAvailsPolling();
  }, [ready, dashboardMode.value, activeTab.value, selectedCommunityIds.value]);
}
