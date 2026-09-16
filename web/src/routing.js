const FEEDS = new Map([
  ['/digest', 'digest'],
  ['/network', 'network'],
  ['/participation', 'participation'],
  ['/community-input', 'communityInput'],
]);

export function routeFromPath(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (FEEDS.has(path)) return { mode: 'feed', tab: FEEDS.get(path) };
  if (path === '/stewardship') return { mode: 'workspace', workspace: 'stewardship' };
  if (path === '/settings') return { mode: 'overview', settings: true };
  if (path === '/auth/callback') return { mode: 'overview', callback: 'email' };
  if (path === '/auth/atproto/callback') return { mode: 'overview', callback: 'atproto' };
  return { mode: 'overview' };
}

export function pathForDashboardRoute(route) {
  if (route.mode === 'workspace') return `/${route.workspace}`;
  if (route.mode !== 'feed') return '/';
  return [...FEEDS.entries()].find(([, tab]) => tab === route.tab)?.[0] || '/';
}
