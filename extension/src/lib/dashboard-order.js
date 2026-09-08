export const DEFAULT_DASHBOARD_ORDER = [
  'network',
  'digest',
  'participation',
  'communityInput',
];

export function normalizeDashboardOrder(value) {
  const supplied = Array.isArray(value) ? value : [];
  const known = supplied.filter(
    (tab, index) => DEFAULT_DASHBOARD_ORDER.includes(tab) && supplied.indexOf(tab) === index
  );
  return [
    ...known,
    ...DEFAULT_DASHBOARD_ORDER.filter((tab) => !known.includes(tab)),
  ];
}

export function reorderDashboardTab(order, movedTab, targetTab, movableTabs = null) {
  const normalized = normalizeDashboardOrder(order);
  const movable = movableTabs
    ? normalized.filter((tab) => movableTabs.includes(tab))
    : normalized;
  const from = movable.indexOf(movedTab);
  const to = movable.indexOf(targetTab);
  if (from < 0 || to < 0 || from === to) return normalized;

  const reordered = [...movable];
  reordered.splice(from, 1);
  reordered.splice(to, 0, movedTab);

  let movableIndex = 0;
  const next = normalized.map((tab) =>
    movable.includes(tab) ? reordered[movableIndex++] : tab
  );
  return next;
}

export function moveDashboardTab(order, tab, delta, movableTabs = null) {
  const normalized = normalizeDashboardOrder(order);
  const movable = movableTabs
    ? normalized.filter((key) => movableTabs.includes(key))
    : normalized;
  const from = movable.indexOf(tab);
  const to = Math.max(0, Math.min(movable.length - 1, from + delta));
  if (from < 0 || from === to) return normalized;
  return reorderDashboardTab(normalized, tab, movable[to], movable);
}
