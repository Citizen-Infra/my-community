import { decisionRoutePath, validateDecisionPath } from './decision-path.js';

const FEEDS = new Map([
  ['/digest', 'digest'],
  ['/network', 'network'],
  ['/participation', 'participation'],
  ['/community-input', 'communityInput'],
]);

export function routeFromPath(pathname) {
  if (pathname === '/decisions' || pathname.startsWith('/decisions/')) {
    const encodedPath = pathname.slice('/decisions/'.length);
    try {
      const segments = encodedPath.split('/').map((segment) => {
        const decoded = decodeURIComponent(segment);
        if (decoded.includes('/')) throw new Error('Encoded path separator');
        return decoded;
      });
      return { mode: 'decision', decisionPath: validateDecisionPath(segments.join('/')) };
    } catch {
      return { mode: 'decision', decisionPath: null };
    }
  }
  const path = pathname.replace(/\/+$/, '') || '/';
  if (FEEDS.has(path)) return { mode: 'feed', tab: FEEDS.get(path) };
  if (path === '/stewardship') return { mode: 'workspace', workspace: 'stewardship' };
  if (path === '/settings') return { mode: 'overview', settings: true };
  if (path === '/auth/callback') return { mode: 'overview', callback: 'email' };
  if (path === '/auth/atproto/callback') return { mode: 'overview', callback: 'atproto' };
  return { mode: 'overview' };
}

export function pathForDecisionRoute(path) {
  return decisionRoutePath(validateDecisionPath(path));
}

export function pathForDashboardRoute(route) {
  if (route.mode === 'workspace') return `/${route.workspace}`;
  if (route.mode !== 'feed') return '/';
  return [...FEEDS.entries()].find(([, tab]) => tab === route.tab)?.[0] || '/';
}
