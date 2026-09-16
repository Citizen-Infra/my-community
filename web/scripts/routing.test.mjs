const { pathForDashboardRoute, routeFromPath } = await import('../src/routing.js');

let failures = 0;
const assert = (condition, message) => {
  if (condition) console.log('ok:', message);
  else { console.error('FAIL:', message); failures += 1; }
};

for (const [path, tab] of [['/digest', 'digest'], ['/network', 'network'], ['/participation', 'participation'], ['/community-input', 'communityInput']]) {
  const route = routeFromPath(path);
  assert(route.mode === 'feed' && route.tab === tab, `${path} resolves to its focused feed`);
  assert(pathForDashboardRoute(route) === path, `${tab} round-trips to a stable URL`);
}
assert(routeFromPath('/settings').settings === true, 'settings has a real history route');
assert(routeFromPath('/stewardship').workspace === 'stewardship', 'stewardship has a real workspace route');
assert(routeFromPath('/unknown').mode === 'overview', 'unknown routes fail safely to the overview');

console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
