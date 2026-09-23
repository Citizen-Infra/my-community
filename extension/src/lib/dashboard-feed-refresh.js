// Revalidate every inactive data tile after first paint. Store loaders own their
// cache TTLs, so calling one here is cheap while its snapshot is fresh and
// refreshes it once stale. A hydrated snapshot deliberately does not suppress
// this pass: it should stay visible during revalidation, not become permanent.
export async function refreshInactiveDashboardFeeds({
  tabs,
  activeTab,
  isCancelled,
  isConnected,
  isLoading,
  refresh,
}) {
  for (const tab of tabs) {
    if (isCancelled()) return;
    if (tab === activeTab || tab === 'communityInput') continue;
    if (tab === 'network' && !isConnected()) continue;
    if (isLoading(tab)) continue;
    await refresh(tab);
  }
}
